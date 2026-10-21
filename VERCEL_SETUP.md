# Vercel deployment

Import this GitHub repository into Vercel with the Express framework preset and repository root. Keep the default build and output settings. The root app.js exports the API; public/ contains the landing page, dashboard, account page and static assets.

Configure these environment variables in Vercel before production deployment:
- SUPABASE_URL: existing project URL
- SUPABASE_ANON_KEY: existing publishable key (never a service-role key)
- FMP_API_KEY: existing Financial Modeling Prep credential
- OPENAI_API_KEY: required for AI requests

Use the existing Supabase project; no database migration is needed. After Vercel assigns the production domain, add that exact HTTPS origin to Supabase Auth's allowed redirect URLs and set the Site URL to it. Add the new origin to the Google OAuth web client's authorized JavaScript origins. Keep the existing Supabase /auth/v1/callback URI in Google. The Google client ID and secret stay in Supabase, not Vercel or the browser.

Verify /api/health, /api/config, /account.html, /account.html#settings, Google login, email signup, and authenticated private history. A hosting move does not repair invalid Google client credentials. Ensure the deployment passes these checks before sending user traffic.

The existing market cache and AI request limiter are process-local and reset on cold starts. They are best-effort, not a deployment-wide quota across Vercel instances. Set provider spending controls; migrate quotas to shared storage before relying on them as a billing boundary.

## Local development / Antigravity

Open this repository in your editor, run npm install, configure local environment variables in an uncommitted .env file, then run npm start. The local URL is http://localhost:3000. Never commit provider keys or OAuth secrets.
