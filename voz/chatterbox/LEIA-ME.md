# Serviço de voz — Chatterbox

O app instala e inicia este serviço sozinho (Configurações → Voz → 📦 Instalar / ⚡ Carregar voz).

Teste manual, com o Python do app (ou qualquer um com `chatterbox-tts`):

```bash
python -u servico.py            # modelos reais (baixa ~3 GB do Hugging Face na 1ª vez)
python -u servico.py --falso    # sintetizador de teste, sem modelos
```

Digite uma linha JSON por comando:

```json
{"id":1,"cmd":"iniciar","dados":".","dispositivo":"auto","ingles":"turbo","idiomas":["pt"]}
{"id":2,"cmd":"falar","texto":"Bem-vindo à taverna, viajante!","idioma":"pt","ref":null,"exagero":0.6,"cfg":0.45,"temperatura":0.8,"saida":"teste.wav","lote":"a"}
{"id":3,"cmd":"falar","texto":"[chuckle] Well met, traveler.","idioma":"en","saida":"en.wav"}
{"id":4,"cmd":"cancelar","lote":"a"}
{"id":5,"cmd":"sair"}
```

- `ref`: um .wav de 10–20 s com a voz a copiar (o Turbo exige mais de 5 s). `null` usa a voz embutida.
- `exagero` (exaggeration) 0.25–1.2, `cfg` (cfg_weight) e `temperatura` vêm da emoção da fala (`src/main/voz-presets.js`).
- `semear` cria os clipes das 16 vozes-base transpondo a voz embutida (librosa `pitch_shift` + `time_stretch`).
- Tudo que as bibliotecas imprimem vai para o stderr; o stdout é só do protocolo.
