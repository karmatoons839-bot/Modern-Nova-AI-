# Professional Text-to-Image API

A self-hosted FastAPI image-generation backend designed for animation and story artwork.

## Supported style presets
2D animation, 3D animation, anime, cartoon, comic, horror, moral-story, cinematic,
realistic, fantasy, storybook, watercolor, pixel-art, and custom.

## Run
1. Copy `.env.example` to `.env`.
2. Set a strong `API_KEY`.
3. Install dependencies:
   `pip install -r requirements.txt`
4. Start:
   `uvicorn app.main:app --host 0.0.0.0 --port 8000`

Open `/docs` for interactive API documentation.

## Request
POST `/v1/images/generations`

Header:
`X-API-Key: YOUR_SECRET`

JSON:
```json
{
  "prompt": "A village at night, a mysterious old house in the distance",
  "style": "horror",
  "width": 1024,
  "height": 1024,
  "steps": 30,
  "guidance_scale": 7
}
```

The endpoint returns a JSON object containing the generated PNG URL and generation metadata.

## Production notes
- Run behind HTTPS and a reverse proxy.
- Keep `API_KEY` only on your server; never expose it in browser JavaScript.
- For public SaaS use, add authentication, per-user quotas, a job queue, object storage,
  rate limiting, logging, moderation and billing before exposing the endpoint publicly.
- SDXL is a baseline model. For higher quality, replace `MODEL_ID` with a compatible
  production image model and verify its license and VRAM requirements.
