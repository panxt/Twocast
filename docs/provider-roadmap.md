# Provider integration plan

The Vercel workflow currently calls MiniMax TTS per script line, stores temporary
MP3 segments in private Supabase Storage, then normalizes and tags the final MP3.
The original local queue also contains a Fish Audio implementation, but the
serverless workflow does not call it. LLM requests use a configurable
OpenAI-compatible chat-completions URL and model. Chat and optional search
settings can be supplied by each user or by an administrator grant.

## Next providers

| Capability | Provider | Integration work | Notes |
| --- | --- | --- | --- |
| LLM | OpenRouter, DeepSeek, OpenAI-compatible MiniMax | Already configurable through chat URL/model/key | Test JSON output and reasoning cleanup for each model. A separate search-capable endpoint is needed for topic discovery. |
| TTS | Fish Audio | Move the existing `genVoiceFishAudio` function behind a serverless provider adapter; configure private keys per user | Verify current API schema and selected voice IDs before enabling. |
| TTS | Gemini | Add a provider adapter using the existing `@google/genai` dependency | Output is commonly PCM/WAV; transcode each line before MP3 finalization. Preview models and voices may change. |
| TTS | OpenAI speech | Add an adapter for `/v1/audio/speech` | MP3 output simplifies the existing finalizer. Check voice licensing and language quality with real samples. |

Define a common adapter interface: `synthesize(text, voice, credentials) ->
{audio, format}` and `listVoices(credentials)`. Keep credentials in encrypted
server-side settings. Select LLM and TTS independently per task, reserve
administrator episode quotas before starting the workflow, then normalize all
provider outputs to one MP3 format. Add a provider-specific health check and
sample-generation test before exposing each new provider in the UI.

Sources: [OpenRouter chat API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request),
[OpenAI speech API](https://platform.openai.com/docs/api-reference/audio),
[Gemini speech generation](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation),
[Fish Audio documentation](https://docs.fish.audio/).
