# Picturize

Web app where users can:
- upload a photo of clothing, or
- capture a photo from the camera,

and receive AI-extracted metadata (garment type, brand hints, composition estimate, style tags, and more).

## Stack

- Node.js + Express backend
- Vanilla HTML/CSS/JS frontend
- OpenAI Vision model for image analysis

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   copy .env.example .env
   ```
3. Set `OPENAI_API_KEY` in `.env`.
4. Start app:
   ```bash
   npm start
   ```
5. Open [http://localhost:3000](http://localhost:3000).

If port `3000` is busy, the server now automatically tries `3001`, `3002`, and so on (up to 10 retries).

## API

`POST /api/analyze`
- multipart form field: `image` (image file)
- returns structured JSON metadata about visible clothing.

If `OPENAI_API_KEY` is not configured, the app returns a placeholder response so UI flow can still be tested.
