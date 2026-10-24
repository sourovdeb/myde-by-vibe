# Verified provider endpoints (2026-10-24)

All shapes below were verified live on 2026-10-24 from this PC. Re-verify
before relying on them after provider changes. Keys are env vars, never
printed: `TYPESAFE_API_KEY`, `AGNES_API_KEY`, `MISTRAL_API_KEY`.

## TypeSafe (jev-latest) - verification gates

`POST https://api.typesafe.ai/v1/systemone` (Bearer TYPESAFE_API_KEY):

```json
{
  "model": "jev-latest",
  "state": "<the text/data to judge, max ~50k chars>",
  "questions": {
    "selection": {
      "type": "choice",
      "instructions": "<question>",
      "criteria": {"SUPPORTED": null, "CONTRADICTED": null, "UNPROVEN": null,
                   "UNKNOWN": "Insufficient evidence"}
    }
  }
}
```

Response: `answers.selection` = `{"type": "choice", "choice": "<option>",
"probabilities": {option: float}, "confidence": float}`. Probabilities sum
to 1. Source: `H:\00_SKILLS_AGENTS\1_system_manager\skills\cost-aware-provider-router\scripts\provider_router.py`
(the installed helper; base URL without `/v1`).

## Agnes 2.5 flash - bulk extraction

`POST https://apihub.agnes-ai.com/v1/chat/completions` (Bearer AGNES_API_KEY),
OpenAI-compatible body: `model: "agnes-2.5-flash"`,
`response_format: {"type": "json_object"}` works.

## Mistral - debate, synthesis, embeddings, code

Base `https://api.mistral.ai/v1` (Bearer MISTRAL_API_KEY). Model IDs verified
in the live catalog 2026-10-24:

| Purpose | Model | Notes |
| --- | --- | --- |
| Debate (reasoning) | `zai-glm-5-3-flash` | content arrives as a LIST of chunks: a `{"type":"thinking"}` chunk first, then `{"type":"text"}`; parse only text chunks. Heavy prompt schemas make it spend 6000+ tokens on reasoning with zero answer text (verified 2026-10-24: finish=length) - keep prompts lean and budget max_tokens 6000; no reliable json_object mode - parse with a `{...}` regex fallback |
| Synthesis | `mistral-large-latest` | plain chat |
| Embeddings (dedupe) | `mistral-embed-2312` | 1024 dims; `POST /embeddings` |
| Embeddings (code) | `codestral-embed-2505` | 1536 dims |
| Code review | `codestral-2508` | chat endpoint |
| Transcription | `voxtral-mini-transcribe-3-0` | `/v1/audio/transcriptions`, $0.0035/min, diarization + timestamps, 32k context, Public Preview |
| TTS | `voxtral-mini-tts-3-0` | catalog-verified |

Cosine similarity threshold for near-duplicate claims: 0.92 (tunable).
