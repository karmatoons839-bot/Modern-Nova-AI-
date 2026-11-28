# Professional Text-to-Thumbnail API

Self-hosted API for turning a story/video idea into a high-impact 16:9 thumbnail.

Styles: YouTube, Horror, Story, Moral Story, Gaming, Cinematic, Kids, News, Custom.

Endpoint:
POST /v1/thumbnails/generations

Header:
X-API-Key: YOUR_SECRET

Example:
{"prompt":"A boy discovers a mysterious abandoned house at midnight","style":"horror","width":1280,"height":720}

The backend analyzes the supplied concept through a style-specific prompt enhancer and generates a 16:9 thumbnail image.

For production, keep the API key server-side and add authentication, rate limits, moderation, queueing and object storage before public launch.
