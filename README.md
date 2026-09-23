<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1ad809be-68dd-4324-b185-d7818eecb21e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Render deployment (zero-cost test deployment)

This project is configured for a Render web service via `render.yaml`. Render provides the `PORT` environment variable; the server reads it at runtime.

Required server secrets must be entered as Render environment variables. Never commit `.env` files or access tokens.

Health check: `/healthz`
WhatsApp webhook: `/api/webhooks/whatsapp`

Production tenant mappings are resolved from the persisted `business_integrations` records after the authenticated WhatsApp onboarding flow. Development/test fixture mappings are not loaded in production.
