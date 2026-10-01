// Serviço de voz do Crônicas — KokoroSharp (Kokoro TTS 82M em ONNX, pronúncia pt-BR nativa via MisakiSharp, sem espeak).
//
// Conversa com o Electron por JSON, uma linha por mensagem (stdin → stdout, UTF-8).
// Tudo que não é protocolo vai para o stderr.
//
// Comandos (cada um com "id"):
//   iniciar  {dados, modelo?}                        carrega (ou baixa, ~320 MB) o kokoro.onnx para a pasta "dados"
//   falar    {texto, mix:[[voz,peso],...], velocidade, saida, lote}   sintetiza e grava um WAV (24 kHz)
//   cancelar {lote}                                   descarta as falas pendentes daquele lote
//   vozes    {}                                       lista as vozes disponíveis
//   sair     {}
// Eventos sem id: {"evento":"progresso","pct":0..1} durante o download, {"evento":"pronto"}.
//
// Vozes pt-BR do Kokoro: pf_dora, pm_alex, pm_santa. Misturas sempre começam por uma delas
// (o prefixo da 1ª voz define o idioma da mistura).

using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using KokoroSharp;
using KokoroSharp.Core;
using KokoroSharp.Processing;

var proto = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" };
Console.SetOut(Console.Error); // bibliotecas que escrevem no console não sujam o protocolo
var trava = new object();
void Enviar(object o) { var s = JsonSerializer.Serialize(o); lock (trava) proto.WriteLine(s); }
void Log(string s) => Console.Error.WriteLine($"[voz] {s}");

KokoroWavSynthesizer synth = null;
// as vozes vêm ao lado do executável; o KokoroSharp as procura em "voices" relativo à pasta atual,
// que vira a pasta de dados no 'iniciar' — então o caminho absoluto é guardado antes
var dirVozes = Path.Combine(AppContext.BaseDirectory, "voices");
var dirInicial = Directory.GetCurrentDirectory();
void CarregarVozes() {
    if (KokoroVoiceManager.Voices.Count > 0) return;
    var candidatos = new List<string> { dirVozes, Path.GetFullPath("voices"), Path.Combine(dirInicial, "voices") };
    // cache do NuGet: o pacote KokoroSharp traz as vozes em content/voices
    var pkgs = Path.Combine(Environment.GetEnvironmentVariable("NUGET_PACKAGES") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nuget", "packages"), "kokorosharp");
    if (Directory.Exists(pkgs)) candidatos.AddRange(Directory.GetDirectories(pkgs).OrderByDescending(x => x).Select(v => Path.Combine(v, "content", "voices")));
    var achou = candidatos.FirstOrDefault(d => Directory.Exists(d) && Directory.EnumerateFiles(d, "*.npy").Any());
    if (achou == null) throw new DirectoryNotFoundException($"Pasta de vozes do Kokoro não encontrada ({dirVozes}). Reinstale a voz em Configurações.");
    KokoroVoiceManager.LoadVoicesFromPath(achou);
}
var vozesMix = new ConcurrentDictionary<string, KokoroVoice>();
var cancelados = new ConcurrentDictionary<string, DateTime>();
var fila = Channel.CreateUnbounded<JsonObject>();

KokoroVoice VozDoMix(JsonArray mix) {
    var itens = (mix ?? new JsonArray()).Select(x => (nome: x[0]!.GetValue<string>(), peso: x.AsArray().Count > 1 ? x[1]!.GetValue<float>() : 1f))
        .Where(x => x.peso > 0).ToList();
    if (itens.Count == 0) itens.Add(("pm_alex", 1f));
    var chave = string.Join("|", itens.Select(x => $"{x.nome}:{x.peso:0.###}"));
    return vozesMix.GetOrAdd(chave, _ => {
        if (itens.Count == 1) return KokoroVoiceManager.GetVoice(itens[0].nome);
        return KokoroVoiceManager.Mix(itens.Select(x => (KokoroVoiceManager.GetVoice(x.nome), x.peso)).ToArray());
    });
}

async Task<object> Processar(JsonObject m) {
    var cmd = (string)m["cmd"];
    var lote = (string)m["lote"];
    if (lote != null && cancelados.ContainsKey(lote)) throw new OperationCanceledException();
    switch (cmd) {
        case "iniciar": {
            var dados = (string)m["dados"] ?? ".";
            Directory.CreateDirectory(dados);
            Directory.SetCurrentDirectory(dados); // o kokoro.onnx é baixado/lido na pasta atual
            CarregarVozes();
            var caminho = (string)m["modelo"];
            if (synth == null) {
                if (!string.IsNullOrWhiteSpace(caminho) && File.Exists(caminho)) synth = KokoroWavSynthesizer.LoadModel(caminho);
                else {
                    var ultimo = -1;
                    synth = await KokoroWavSynthesizer.LoadModelAsync(KModel.float32, p => {
                        var pct = (int)(p * 100);
                        if (pct != ultimo) { ultimo = pct; Enviar(new { evento = "progresso", pct = Math.Round(p, 3) }); }
                    });
                }
                // aquece: a 1ª síntese carrega o fonemizador e as vozes
                try { synth.Synthesize("Olá.", KokoroVoiceManager.GetVoice("pf_dora")); } catch (Exception e) { Log($"aquecimento: {e.Message}"); }
                Enviar(new { evento = "pronto" });
            }
            return new { vozes = KokoroVoiceManager.Voices.Count };
        }
        case "falar": {
            if (synth == null) throw new InvalidOperationException("Chame 'iniciar' antes de 'falar'.");
            CarregarVozes();
            var texto = ((string)m["texto"] ?? "").Trim();
            if (texto.Length == 0) throw new ArgumentException("Texto vazio.");
            var saida = (string)m["saida"] ?? throw new ArgumentException("Falta 'saida'.");
            var vel = m["velocidade"] is JsonNode v ? Math.Clamp(v.GetValue<float>(), 0.5f, 1.6f) : 1f;
            var voz = VozDoMix(m["mix"] as JsonArray);
            var cfg = new KokoroTTSPipelineConfig { Speed = vel };
            var bytes = await synth.SynthesizeAsync(texto, voz, cfg);
            if (lote != null && cancelados.ContainsKey(lote)) throw new OperationCanceledException();
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(saida))!);
            var tmp = saida + ".tmp";
            KokoroWavSynthesizer.SaveAudioToFile(bytes, tmp);
            File.Move(tmp, saida, true);
            return new { segundos = Math.Round(bytes.Length / 2.0 / 24000, 2) };
        }
        case "vozes":
            CarregarVozes();
            return new { vozes = KokoroVoiceManager.Voices.Select(x => x.Name).OrderBy(x => x).ToArray() };
        default:
            throw new ArgumentException($"comando desconhecido: {cmd}");
    }
}

// um único trabalhador: as falas saem na ordem em que foram pedidas
var trabalhador = Task.Run(async () => {
    await foreach (var m in fila.Reader.ReadAllAsync()) {
        var id = m["id"]?.GetValue<int>() ?? 0;
        try {
            var r = await Processar(m);
            var o = JsonSerializer.SerializeToNode(r)!.AsObject();
            o["id"] = id; o["ok"] = true;
            lock (trava) proto.WriteLine(o.ToJsonString());
        } catch (OperationCanceledException) {
            Enviar(new { id, ok = false, erro = "cancelado", cancelado = true });
        } catch (Exception e) {
            Log(e.ToString());
            var msg = (e is AggregateException ae ? ae.InnerException?.Message : null) ?? e.Message;
            Enviar(new { id, ok = false, erro = msg });
        }
    }
});

Enviar(new { evento = "vivo", motor = "kokoro" });
var entrada = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)); // UTF-8 mesmo no console do Windows
string linha;
while ((linha = entrada.ReadLine()) != null) {
    linha = linha.Trim();
    if (linha.Length == 0) continue;
    JsonObject m;
    try { m = JsonNode.Parse(linha)!.AsObject(); } catch { continue; }
    var cmd = (string)m["cmd"];
    if (cmd == "sair") break;
    if (cmd == "cancelar") {
        var lote = (string)m["lote"];
        if (lote != null) cancelados[lote] = DateTime.UtcNow;
        foreach (var k in cancelados.Where(x => (DateTime.UtcNow - x.Value).TotalMinutes > 10).Select(x => x.Key).ToList()) cancelados.TryRemove(k, out _);
        Enviar(new { id = m["id"]?.GetValue<int>() ?? 0, ok = true });
        continue;
    }
    fila.Writer.TryWrite(m);
}
fila.Writer.TryComplete();
