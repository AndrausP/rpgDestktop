#!/usr/bin/env python3
"""
Serviço de voz do Crônicas — Chatterbox (Resemble AI).

Conversa com o Electron por JSON, uma linha por mensagem (stdin → stdout, UTF-8).
Tudo que as bibliotecas imprimirem vai para o stderr; o stdout é só do protocolo.

Comandos (cada um com "id"):
  iniciar  {dados, dispositivo: auto|cuda|mps|cpu, ingles: turbo|multilingual, idiomas: ["pt","en"]}
  falar    {texto, idioma: pt|en, ref: caminho.wav|null, exagero, cfg, temperatura, velocidade, saida, lote}
  semear   {pasta, presets: {id: {f0, ritmo, estilo, efeito}}}   cria as vozes-base (clipes de referência)
  cancelar {lote}      descarta as falas pendentes daquele lote (o jogador saiu / pulou a narração)
  estado   {}
  sair     {}

Eventos sem id: {"evento": "progresso", "etapa": "baixando|carregando|semeando", "pct": 0..1, "texto": "..."}

Modelos:
  pt (e qualquer outro idioma) → ChatterboxMultilingualTTS (ResembleAI/chatterbox, 23 idiomas)
  en                           → ChatterboxTurboTTS (ResembleAI/chatterbox-turbo) — mais rápido e aceita
                                  tags como [laugh] [chuckle] [sigh] [gasp] [cough]; ou o multilíngue, se preferir.

`--falso` (ou CRONICAS_VOZ_FALSO=1) troca os modelos por um sintetizador de teste (senoides),
para testar o app sem baixar nada.
"""
import json
import math
import os
import queue
import re
import sys
import threading
import time
import traceback

# ─── protocolo num descritor próprio; o stdout "de verdade" vira stderr ───
_fd_proto = os.dup(1)
os.dup2(2, 1)
PROTO = os.fdopen(_fd_proto, "w", encoding="utf-8", buffering=1, newline="\n")
sys.stdout = sys.stderr
try:
    sys.stdin.reconfigure(encoding="utf-8")
except Exception:
    pass

_trava_saida = threading.Lock()


def enviar(obj):
    with _trava_saida:
        PROTO.write(json.dumps(obj, ensure_ascii=False) + "\n")
        PROTO.flush()


def log(*a):
    print("[voz]", *a, file=sys.stderr, flush=True)


FALSO = "--falso" in sys.argv or os.environ.get("CRONICAS_VOZ_FALSO") == "1"
SR = 24000

# tamanho aproximado dos pesos, só para a barra de progresso do download
TAMANHO_MB = {"multilingual": 3250, "turbo": 2100}

TEXTO_BASE = (
    "Era noite de tempestade quando o viajante chegou à taverna. "
    "Sacudiu a capa molhada, pediu vinho quente e sentou-se perto do fogo. "
    "Então olhou para todos nós e começou a contar a sua história."
)


class Cancelado(Exception):
    pass


# ───────────────────────── utilidades de áudio ─────────────────────────

def np():
    import numpy
    return numpy


def dividir_texto(texto, limite=260):
    """Quebra em frases e junta até ~limite caracteres (o modelo se perde em textos longos)."""
    texto = re.sub(r"\s+", " ", texto).strip()
    if len(texto) <= limite:
        return [texto] if texto else []
    frases = re.split(r"(?<=[.!?…])\s+", texto)
    partes, atual = [], ""
    for f in frases:
        while len(f) > limite:  # frase gigante: corta na vírgula/ponto-e-vírgula mais próximo
            corte = max(f.rfind(",", 0, limite), f.rfind(";", 0, limite), f.rfind(" ", 0, limite))
            corte = corte if corte > limite // 3 else limite
            pedaco, f = f[: corte + 1].strip(), f[corte + 1 :].strip()
            if atual:
                partes.append(atual)
                atual = ""
            partes.append(pedaco)
        if not f:
            continue
        if len(atual) + len(f) + 1 <= limite:
            atual = f"{atual} {f}".strip()
        else:
            if atual:
                partes.append(atual)
            atual = f
    if atual:
        partes.append(atual)
    return partes


def medir_f0(y, sr):
    """Altura média da voz (Hz), só nos trechos com voz."""
    import librosa
    N = np()
    f0, voz, _ = librosa.pyin(y, fmin=55, fmax=500, sr=sr, frame_length=2048)
    f0 = f0[voz & N.isfinite(f0)] if voz is not None else f0[N.isfinite(f0)]
    return float(N.median(f0)) if len(f0) else 150.0


def finalizar(y, sr, velocidade=1.0):
    """Velocidade, pico normalizado e fades curtos (sem estalos)."""
    N = np()
    y = N.asarray(y, dtype=N.float32).reshape(-1)
    if abs(velocidade - 1.0) > 0.03 and len(y) > sr // 4:
        import librosa
        y = librosa.effects.time_stretch(y, rate=float(velocidade))
    pico = float(N.max(N.abs(y))) if len(y) else 0.0
    if pico > 1e-4:
        y = y * (0.89 / pico)
    f = min(len(y) // 4, int(sr * 0.012))
    if f > 1:
        y[:f] *= N.linspace(0, 1, f, dtype=N.float32)
        y[-f:] *= N.linspace(1, 0, f, dtype=N.float32)
    return y


def gravar_wav(caminho, y, sr):
    import soundfile as sf
    os.makedirs(os.path.dirname(os.path.abspath(caminho)), exist_ok=True)
    tmp = caminho + ".tmp.wav"
    sf.write(tmp, y, sr, subtype="PCM_16")
    os.replace(tmp, caminho)


def tamanho_pasta_mb(p):
    total = 0
    for raiz, _, arqs in os.walk(p):
        for a in arqs:
            try:
                total += os.path.getsize(os.path.join(raiz, a))
            except OSError:
                pass
    return total / 1e6


# ───────────────────────── modelo de teste ─────────────────────────

class _CondFalsa:
    def __init__(self, f0):
        self.f0 = f0


class ModeloFalso:
    """Imita a API do Chatterbox com senoides (altura = da referência)."""
    sr = SR

    def __init__(self, nome):
        self.nome = nome
        self.conds = _CondFalsa(150.0)

    def prepare_conditionals(self, caminho, exaggeration=0.5, **_):
        import soundfile as sf
        y, sr = sf.read(caminho, dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        if self.nome == "turbo" and len(y) / sr <= 5.0:
            raise AssertionError("Audio prompt must be longer than 5 seconds!")
        try:
            f0 = medir_f0(y[: sr * 4], sr)
        except Exception:
            f0 = 150.0
        self.conds = _CondFalsa(f0)

    def gerar(self, texto, **kw):
        N = np()
        dur = max(0.4, min(14.0, len(texto) * 0.055))
        t = N.arange(int(SR * dur), dtype=N.float32) / SR
        f = self.conds.f0 * (1 + 0.04 * N.sin(2 * math.pi * 3 * t))
        fase = 2 * math.pi * N.cumsum(f) / SR
        y = 0.5 * N.sin(fase) + 0.2 * N.sin(2 * fase) + 0.1 * N.sin(3 * fase)
        y *= 0.6 + 0.4 * N.abs(N.sin(2 * math.pi * 2.2 * t))
        time.sleep(min(0.4, dur * 0.05))
        return y.astype(N.float32)


# ───────────────────────── motor ─────────────────────────

class Motor:
    def __init__(self):
        self.mtl = None
        self.turbo = None
        self.base = {}          # nome do modelo → conds embutidas
        self.cache_conds = {}   # (modelo, ref, mtime) → conds
        self.dispositivo = "cpu"
        self.ingles = "turbo"
        self.dados = "."
        self.trava = threading.Lock()

    # ── carga ──
    def iniciar(self, m):
        self.dados = m.get("dados") or "."
        self.ingles = m.get("ingles") or "turbo"
        pasta_modelos = os.path.join(self.dados, "modelos")
        os.makedirs(pasta_modelos, exist_ok=True)
        # precisa ser antes de importar huggingface_hub
        os.environ.setdefault("HF_HOME", pasta_modelos)
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

        if FALSO:
            self.dispositivo = "falso"
        else:
            import torch
            pedido = (m.get("dispositivo") or "auto").lower()
            if pedido == "auto":
                if torch.cuda.is_available():
                    pedido = "cuda"
                elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
                    pedido = "mps"
                else:
                    pedido = "cpu"
            self.dispositivo = pedido
            if pedido == "cpu":
                torch.set_num_threads(max(1, (os.cpu_count() or 4) - 1))

        idiomas = m.get("idiomas") or ["pt"]
        if any(i != "en" for i in idiomas) or self.ingles != "turbo":
            self.garantir("multilingual")
        if "en" in idiomas and self.ingles == "turbo":
            self.garantir("turbo")
        return {"dispositivo": self.dispositivo, "modelos": [k for k in ("multilingual", "turbo") if self.modelo(k)]}

    def modelo(self, nome):
        return self.mtl if nome == "multilingual" else self.turbo

    def garantir(self, nome):
        if self.modelo(nome) is not None:
            return self.modelo(nome)
        with self.trava:
            if self.modelo(nome) is not None:
                return self.modelo(nome)
            rotulo = "multilíngue (pt, en e mais 21 idiomas)" if nome == "multilingual" else "Turbo (inglês)"
            if FALSO:
                enviar({"evento": "progresso", "etapa": "carregando", "pct": 0.5, "texto": f"Carregando modelo {rotulo}…"})
                mod = ModeloFalso(nome)
            else:
                pasta = os.environ["HF_HOME"]
                antes = tamanho_pasta_mb(pasta)
                parar = threading.Event()

                def vigiar():  # mostra o download pelo tamanho da pasta
                    while not parar.wait(1.0):
                        mb = tamanho_pasta_mb(pasta) - antes
                        if mb > 5:
                            pct = min(0.97, mb / TAMANHO_MB[nome])
                            enviar({"evento": "progresso", "etapa": "baixando", "pct": pct,
                                    "texto": f"Baixando modelo {rotulo}: {mb:,.0f} de ~{TAMANHO_MB[nome]:,} MB".replace(",", ".")})

                threading.Thread(target=vigiar, daemon=True).start()
                enviar({"evento": "progresso", "etapa": "carregando", "pct": 0.02, "texto": f"Preparando modelo {rotulo}…"})
                try:
                    if nome == "multilingual":
                        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
                        mod = ChatterboxMultilingualTTS.from_pretrained(device=self.dispositivo)
                    else:
                        from chatterbox.tts_turbo import ChatterboxTurboTTS
                        mod = ChatterboxTurboTTS.from_pretrained(device=self.dispositivo)
                finally:
                    parar.set()
            self.base[nome] = mod.conds
            if nome == "multilingual":
                self.mtl = mod
            else:
                self.turbo = mod
            enviar({"evento": "progresso", "etapa": "pronto", "pct": 1, "texto": f"Modelo {rotulo} pronto."})
            return mod

    # ── referência de voz (clonagem) ──
    def aplicar_ref(self, nome, mod, ref, exagero):
        if not ref or not os.path.isfile(ref):
            mod.conds = self.base[nome]
            return False
        chave = (nome, os.path.abspath(ref), os.path.getmtime(ref))
        conds = self.cache_conds.get(chave)
        if conds is None:
            try:
                if nome == "turbo":
                    mod.prepare_conditionals(ref, exaggeration=0.0)
                else:
                    mod.prepare_conditionals(ref, exaggeration=exagero)
            except AssertionError as e:  # turbo exige > 5 s de referência
                log("referência recusada:", ref, e)
                mod.conds = self.base[nome]
                return False
            conds = mod.conds
            if len(self.cache_conds) > 48:
                self.cache_conds.pop(next(iter(self.cache_conds)))
            self.cache_conds[chave] = conds
        mod.conds = conds
        return True

    # ── síntese ──
    def sintetizar(self, texto, idioma, ref, exagero, cfg, temperatura, verificar=lambda: None):
        N = np()
        idioma = (idioma or "pt").lower()
        usar_turbo = idioma == "en" and self.ingles == "turbo"
        nome = "turbo" if usar_turbo else "multilingual"
        mod = self.garantir(nome)
        self.aplicar_ref(nome, mod, ref, exagero)
        if not usar_turbo:
            texto = re.sub(r"\[[^\]]{1,20}\]", "", texto)  # tags paralinguísticas só o Turbo entende
        partes = dividir_texto(texto, 300 if usar_turbo else 260)
        audio = []
        pausa = N.zeros(int(SR * 0.14), dtype=N.float32)
        for p in partes:
            verificar()
            if FALSO:
                y = mod.gerar(p)
            elif usar_turbo:
                y = mod.generate(p, temperature=temperatura).squeeze(0).cpu().numpy()
            else:
                y = mod.generate(p, language_id=idioma, exaggeration=exagero, cfg_weight=cfg,
                                 temperature=temperatura).squeeze(0).cpu().numpy()
            if audio:
                audio.append(pausa)
            audio.append(N.asarray(y, dtype=N.float32).reshape(-1))
        if not audio:
            raise ValueError("Texto vazio.")
        return N.concatenate(audio)

    def falar(self, m, verificar):
        y = self.sintetizar(m.get("texto", ""), m.get("idioma"), m.get("ref"),
                            float(m.get("exagero", 0.5)), float(m.get("cfg", 0.5)),
                            float(m.get("temperatura", 0.8)), verificar)
        y = finalizar(y, SR, float(m.get("velocidade", 1.0)))
        gravar_wav(m["saida"], y, SR)
        return {"segundos": round(len(y) / SR, 2)}

    # ── vozes-base: uma gravação da voz embutida, transposta para cada personagem ──
    def semear(self, m, verificar):
        import librosa
        N = np()
        pasta = m["pasta"]
        presets = m.get("presets") or {}
        os.makedirs(pasta, exist_ok=True)
        faltando = [k for k in presets if not os.path.isfile(os.path.join(pasta, f"{k}.wav"))]
        if not faltando:
            return {"criadas": []}
        enviar({"evento": "progresso", "etapa": "semeando", "pct": 0.02, "texto": "Gravando a voz-base dos personagens…"})
        bases = {}
        for estilo, ex in (("neutro", 0.45), ("intenso", 0.85)):
            if not any((presets[k].get("estilo") or "neutro") == estilo for k in faltando):
                continue
            verificar()
            y = self.sintetizar(TEXTO_BASE, "pt", None, ex, 0.5, 0.75, verificar)
            y = finalizar(y, SR)
            bases[estilo] = (y, medir_f0(y, SR))
            log(f"voz-base {estilo}: {len(y) / SR:.1f}s, f0 {bases[estilo][1]:.0f} Hz")
        criadas = []
        for i, k in enumerate(faltando):
            verificar()
            p = presets[k]
            y, f0 = bases.get(p.get("estilo") or "neutro") or next(iter(bases.values()))
            semitons = max(-12.0, min(12.0, 12 * math.log2(float(p.get("f0", f0)) / f0)))
            z = librosa.effects.pitch_shift(y, sr=SR, n_steps=semitons) if abs(semitons) > 0.2 else y.copy()
            ritmo = float(p.get("ritmo", 1.0))
            if abs(ritmo - 1) > 0.02:
                z = librosa.effects.time_stretch(z, rate=ritmo)
            efeito = p.get("efeito")
            if efeito == "rouco":  # saturação leve: garganta de criatura
                z = N.tanh(z * 2.4) / N.tanh(2.4)
            elif efeito == "sopro":  # sussurro: mistura um ruído soprado no envelope da voz
                env = N.convolve(N.abs(z), N.ones(480) / 480, mode="same")
                ruido = N.random.default_rng(7).normal(0, 1, len(z)).astype(N.float32)
                ruido = librosa.effects.preemphasis(ruido)
                z = 0.7 * z + 0.6 * ruido * env
            gravar_wav(os.path.join(pasta, f"{k}.wav"), finalizar(z, SR), SR)
            criadas.append(k)
            enviar({"evento": "progresso", "etapa": "semeando", "pct": (i + 1) / len(faltando),
                    "texto": f"Voz de {p.get('nome', k)} criada ({i + 1}/{len(faltando)})"})
        return {"criadas": criadas}


# ───────────────────────── laço principal ─────────────────────────

motor = Motor()
fila = queue.Queue()
cancelados = {}  # lote → quando


def lote_cancelado(lote):
    return bool(lote) and lote in cancelados


def trabalhador():
    while True:
        m = fila.get()
        if m is None:
            return
        mid, cmd, lote = m.get("id"), m.get("cmd"), m.get("lote")

        def verificar():
            if lote_cancelado(lote):
                raise Cancelado()

        try:
            verificar()
            if cmd == "iniciar":
                r = motor.iniciar(m)
            elif cmd == "falar":
                r = motor.falar(m, verificar)
            elif cmd == "semear":
                r = motor.semear(m, verificar)
            else:
                raise ValueError(f"comando desconhecido: {cmd}")
            enviar({"id": mid, "ok": True, **r})
        except Cancelado:
            enviar({"id": mid, "ok": False, "erro": "cancelado", "cancelado": True})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            msg = str(e) or e.__class__.__name__
            if "out of memory" in msg.lower():
                msg = "Memória de vídeo insuficiente. Em Configurações → Voz, troque o dispositivo para CPU."
            elif e.__class__.__name__ in ("ModuleNotFoundError", "ImportError"):
                msg = f"Dependência ausente ({msg}). Rode a instalação da voz de novo."
            enviar({"id": mid, "ok": False, "erro": msg})


def main():
    threading.Thread(target=trabalhador, daemon=True).start()
    enviar({"evento": "vivo", "falso": FALSO, "python": sys.version.split()[0]})
    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        try:
            m = json.loads(linha)
        except json.JSONDecodeError:
            continue
        cmd = m.get("cmd")
        if cmd == "sair":
            break
        if cmd == "cancelar":
            agora = time.time()
            cancelados[m.get("lote")] = agora
            for k in [k for k, t in cancelados.items() if agora - t > 600]:
                cancelados.pop(k, None)
            enviar({"id": m.get("id"), "ok": True})
        elif cmd == "estado":
            enviar({"id": m.get("id"), "ok": True, "dispositivo": motor.dispositivo, "fila": fila.qsize(),
                    "modelos": [k for k in ("multilingual", "turbo") if motor.modelo(k)]})
        else:
            fila.put(m)
    fila.put(None)


if __name__ == "__main__":
    main()
