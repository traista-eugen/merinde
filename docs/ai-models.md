# AI models

_Checked 2026-10-28 against Meta's docs. Pay-as-you-go prices in USD, Standard mode. Model choice: [0003](decisions/0003-meta-muse-models.md)._

## Summary

| Model | Used for | Why | Cost per call (est.) |
|-------|----------|-----|----------------------|
| `muse-spark-1.3` | Recipes (generate, edit, variant), pantry parsing, meal plans, receipts, expiry labels, nutrition gaps, allergen labels, stock scan photos | One model reads text, photos and PDFs and returns schema-checked JSON. Meta's recommended version, same price as 1.2 | $0.004–0.05 |
| `muse-image-1.0` | Recipe photos (optional, `new` in brainstorm) | Flat $0.01 per image, generates and edits | $0.01 |
| On-device (Apple) | Barcode scanning, speech-to-text | No Meta model runs on an iPhone, and Muse Voice Transcribe doesn't support Romanian | $0 |

## What Meta offers (Oct 2026)

**Hosted on the Meta Model API** (`https://api.meta.ai/v1`, OpenAI-SDK compatible):

| Model | ID | Input → output | Price | Rate limit (per team) |
|-------|----|----------------|-------|-----------------------|
| Muse Spark 1.3 | `muse-spark-1.3` | text, image, video, PDF → text (audio "not fully supported") | $1.25 in, $0.15 cached in, $4.25 out per 1M tokens | 3,000 RPM, 4M TPM |
| Muse Spark 1.2 | `muse-spark-1.2` | text, image, video, audio, PDF → text | same as 1.3 | 3,000 RPM, 4M TPM |
| Muse Wonder (preview) | `muse-wonder-1.0` | same as Spark | $4 in, $0.20 cached, $20 out per 1M | 3,000 RPM, 4M TPM |
| Muse Image | `muse-image-1.0` | text, image → image (WebP, PNG, JPEG) | $0.01 per image | 150 RPM |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | audio (16-bit PCM WAV ≤ 10 min, or a live stream) → text | $0.18 per audio hour | 256 concurrent streams |
| SAM 3.1 | `sam-3.1` | noun phrase or boxes/points + image/video → boxes and masks | $2.50 per 1,000 images | 3,000 RPM |
| Contributor tier | `muse-spark-1.3-contributor`, `-1.2-contributor` | same as Spark | $0.10 in, $0.20 out per 1M | 150 RPM |

- **Spark and Wonder:** 1,048,576-token context, structured output (JSON Schema, constrained decoding), tool calling, web search ($2.50 per 1,000 searches), automatic prompt caching.
- **Reasoning can't be turned off.** Levels are `minimal` to `max`; reasoning tokens are billed as output and count against `max_output_tokens`.
- **Contributor tier:** Meta may train on what we send. Never used ([0003](decisions/0003-meta-muse-models.md)).

**Open weights** (no Meta API; self-host or a third-party provider):

| Model | Size | Input → output | Runs on | iPhone? |
|-------|------|----------------|---------|---------|
| Muse Glimmer | 30B dense, Apache 2.0 | text, image → text, 128K context | Quantized builds are 17–20 GB; smallest verified Apple target is a Mac with 48 GB or more | No |
| Muse Spark Open | 816B MoE (42B active), Muse Model License | text, image, audio, video → text, 1M context | 4–8 Blackwell GPUs, or hosted: Together AI, Fireworks, Baseten, Groq, Nebius, Modal, OpenRouter | No |

## Task → model

All calls go through Supabase edge functions with `response_format: json_schema`. Token counts are estimates and include reasoning.

| Function | Model, effort | Tokens in / out | Cost | Notes |
|----------|---------------|-----------------|------|-------|
| `recipe-generate` | Spark 1.3, medium | 3,000 / 2,500 | $0.015 | Prompt carries pantry, household diets and allergies |
| `recipe-edit`, `recipe-variant` | Spark 1.3, low | 3,000 / 2,000 | $0.012 | Send the current version only, never the chat history |
| `pantry-parse` | Spark 1.3, low | 2,500 / 800 | $0.007 | Same function for typed and transcribed text |
| `meal-plan`, 1 day / 7 days | Spark 1.3, medium | 5,000 / 4,000; 7,000 / 10,000 | $0.023 / $0.05 | Pantry sorted by expiry; returns meals and missing items |
| `receipt-parse` | Spark 1.3 + photo, low–medium | 6,000 / 3,000 | $0.02 | Shop, date, lines, discounts; schema has no field for card or loyalty numbers |
| `label-read` | Spark 1.3 + photo, low | 2,000 / 400 | $0.004 | Could try Apple Vision OCR first and call AI only when that fails |
| Stock scan (optional) | Spark 1.3 + 1–5 photos, low | 7,000 / 3,000 | $0.02 | See [Stock scan](#stock-scan-photos-not-video-for-now) |
| Nutrition per recipe | Open Food Facts first; Spark 1.3 for gaps, low | 2,000 / 1,200 | $0.008 | Save estimates on `product.nutrition` so each product is estimated once |
| Allergy check | Code first, plus Spark inside recipe calls | — | $0 extra | Model labels allergens per ingredient; code re-checks against product allergen tags and the 14 EU allergens. Never trust the model alone |
| Recipe photo (optional) | Muse Image, `reasoning_strength: low` | — | $0.01 | Generate once per recipe, store in Supabase Storage |

## Stock scan: photos, not video (for now)

`new` in [brainstorm](brainstorm.md). How it would work:

1. **Capture:** the user takes 1–5 photos of a shelf or the fridge. Or they sweep the camera while the app grabs a sharp still about once a second, using an on-device blur check. Convert HEIC to JPEG, ~1,600 px.
2. **One AI call:** Spark 1.3 gets all the photos, the current pantry and candidate products.
   - For each item it returns a name, count or rough quantity, unit, confidence, and a box per photo (0–1000 grid).
   - It merges duplicates across photos.
3. **Reuse:** the output has the same shape as `pantry-parse`, so matching and expiry estimates are reused.
4. **Review:** the app draws the boxes on the photos; the user fixes and confirms.
   - The scan only adds items, because it can't see hidden items, drawer contents, fill levels or expiry dates.

| | Photos (chosen) | Video |
|---|---|---|
| Input | JPEG, PNG or WebP, sent inline | MP4 only (export the iPhone's HEVC `.mov` to H.264 MP4); inline ≤ 50 MB or Files API |
| Label reading | Sharp | Motion blur |
| Review boxes | One set per photo | Per frame, so the review UI is harder |
| Duplicates | Model merges them across a few photos | Same item in many frames; counting untested |
| Cost | ~$0.02 per scan | Unknown: frame rate, max length and tokens per second aren't published |
| Narration | — | Spark reads the audio track, but audio is degraded on 1.3 and Romanian is untested |

- **SAM 3.1 video tracking** keeps each object's identity across frames, so counts would be reliable. But it needs one request per item type, at $0.20 per 1,000 frames (at least 50 billed). That's ~$0.06 per item type for 10 s at 30 fps, or ~$1 per fridge. Not worth it.
- **Revisit video** after measuring real token counts with `POST /v1/responses/input_tokens`.

## Not used, and why

| Model | Verdict |
|-------|---------|
| Muse Wonder | 3–5× Spark's price; built for long agent and coding runs, not short structured calls |
| Muse Voice Transcribe | Its 25 languages don't include Romanian. Keep on-device speech-to-text. Muse Spark 1.2 takes audio directly, but its Romanian quality is untested |
| SAM 3.1 | Returns masks for a named object; it can't tell what's in a fridge. Spark already lists items with boxes. Video tracking would count reliably but costs ~$1 per fridge scan |
| Muse Glimmer, Muse Spark Open | Too big for a phone; self-hosting or a second provider adds work with no gain while API credits last |
| Muse Code | Coding agent for building the app, not part of the app |

## Budget for the $150 credit

| Use | Volume | Cost |
|-----|--------|------|
| Hackathon build: prompt tuning, tests, demo runs | ~3,000 calls | ~$45 |
| Demo recipe photos | ~200 images | ~$2 |
| One family (4 people), daily: 2 recipes, 4 edits, 1 day plan, 2 pantry lists, ½ receipt, 1 label, 2 nutrition, 2 photos | ~14 calls/day | ~$0.17/day ≈ $5/month |

- About $100 is left after the hackathon: roughly 20 months for one family, or about 600 household-days of use.
- High reasoning effort can triple output tokens, so plan for up to ~$15 per family per month.
- Contributor tier would be 12–20× cheaper, but Meta may train on what we send, so it's ruled out.

## Integration notes

- **Photos:** JPEG, PNG, WebP or GIF only; **no HEIC**, so convert on the iPhone. Send inline as base64 (≤ 50 MB, max 50 images per request). A ~1,280 px image costs ~1,300–1,500 input tokens. Measure exact counts with `POST /v1/responses/input_tokens`.
- **Don't use the Files API for receipts:** uploads never expire unless `expires_after` is set, so inline sending keeps nothing stored at Meta.
- **Schemas:** no recursive schemas, nesting depth ≤ 10.
- **Caching:** put the system prompt and schema first, so repeated calls pay the cached rate ($0.15 per 1M).
- **Data:** Standard-mode content isn't used to train Meta models (Data Commitments). Retention is "as described in the Terms"; zero data retention is available for qualified accounts through Meta sales.
- **Availability:** Romania isn't restricted (Geographic Use Policy, 12 Oct 2026). Muse Image is blocked only in India.

## Unverified

- **$150 credit:** the amount and expiry aren't on the official hackathon page (third-party reports only). Partner credits for Baseten, Modal and Fireworks weren't found either.
- **Costs:** all per-call token counts and costs are estimates. Check them against `usage` once we have a key.
- **Romanian quality:** receipt reading (diacritics, discount and VAT lines) and Spark 1.2 audio in Romanian are untested.
- **On-device speech:** Apple's on-device speech recognition for Romanian: check on a device.
- **Data handling:** how long Meta keeps Standard-mode content, where it's processed, and whether a DPA exists aren't published in what I found. Check before opening to other households (GDPR).
- **Token savings:** "1.3 uses ~25% fewer tokens than 1.2" is Meta's own claim, reported by the press.
- **Video input:** frame sampling, max length and tokens per second aren't documented, nor which codecs inside MP4 work (H.264 assumed). Stock scan quality is untested.

## Sources

- Meta docs: [models](https://dev.meta.ai/docs/models), [pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits), [image understanding](https://dev.meta.ai/docs/image-understanding), [structured output](https://dev.meta.ai/docs/structured-output), [reasoning](https://dev.meta.ai/docs/reasoning), [video and audio](https://dev.meta.ai/docs/video-understanding), [speech to text](https://dev.meta.ai/docs/speech-to-text), [image generation](https://dev.meta.ai/docs/image-generation), [segmentation](https://dev.meta.ai/docs/media-segmentation) ([SAM 3.1](https://dev.meta.ai/docs/sam/overview)), [file handling](https://dev.meta.ai/docs/file-handling)
- Open weights: [Muse Glimmer](https://dev.meta.ai/docs/muse-glimmer) ([deploy](https://dev.meta.ai/docs/muse-glimmer/deploy)), [Muse Spark Open](https://dev.meta.ai/docs/muse-spark-open) ([deploy](https://dev.meta.ai/docs/muse-spark-open/deploy))
- Terms: [Geographic Use Policy](https://dev.meta.ai/legal/geographic-use-policy), [Data Commitments](https://dev.meta.ai/legal/commitments), [zero data retention](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention)
- [Hackathon page](https://dev.meta.ai/events/global-hackathon); $150 credit: [CourseJoiner](https://coursejoiner.com/hackathon/meta-global-hackathon-2026-1/) (third party)
- Muse Spark 1.3 launch, 2 Sep 2026: [Let's Data Science](https://letsdatascience.com/news/meta-releases-muse-spark-13-model-7b4da902), [ProPakistani](https://propakistani.pk/2026/09/03/meta-launches-muse-spark-1-3-with-faster-coding-and-smarter-agents/)
