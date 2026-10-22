# AI Finance Lab

A research-first financial analysis dashboard for public companies. It calculates transparent financial ratios, flags potential patterns worth investigating, and compares user-defined scenarios. This is a starter project, not investment advice.

## Features

- Financial statement input and financial ratio calculations
- Rule-based "Company Truth Scanner" for research prompts
- Transparent scenario calculator
- Market quotes, historical prices, and financial statements through Financial Modeling Prep
- Source/status labels and error states
- Responsive dark UI

## Important data and security notes

- The browser app does **not** contain an API key.
- Never commit API keys, `.env` files, tokens, or secrets to GitHub.
- The backend proxy in `server/` reads `FMP_API_KEY` from an environment variable. The key is only used server-side.
- Financial Modeling Prep endpoint access and rate limits depend on your account and provider plan.
- A successful quote does not guarantee that financial statements are available for the same symbol.
- Do not present illustrative/user-entered values as verified financial data.
- This is educational software, not financial advice or a buy/sell recommendation.

## Run locally

Requires Node.js 18+.

1. Copy `.env.example` to `.env` and add your own key:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies and start the API:
   ```bash
   npm install
   npm start
   ```
3. Open `http://localhost:3000`.

On Windows PowerShell, copy the file with:
```powershell
Copy-Item .env.example .env
```

## Deploy

### GitHub
1. Upload all files in this repository, including `package.json`, `server/`, `public/`, and `.gitignore`.
2. Do **not** upload `.env`.
3. For production, deploy the Node backend to a server host that supports environment variables. Set `FMP_API_KEY` in that host's environment settings.
4. Set `API_BASE_URL` in `public/app.js` to your deployed backend URL if it is different from the same-origin `/api` route.

GitHub Pages cannot run the Node backend. You may host the static frontend on GitHub Pages, but the API must run elsewhere. Do not put the secret key in the frontend to make GitHub Pages work.

## API endpoints

- `GET /api/health` — server status
- `GET /api/quote?symbol=IBM` — FMP quote
- `GET /api/daily?symbol=IBM` — historical daily prices
- `GET /api/fundamentals?symbol=IBM` — income statement, balance sheet, and cash flow; defaults to annual only; add `&period=quarter` for quarterly only

## Suggested next steps

1. Add a company search / ticker mapping source.
2. Add source links, reporting period, currency, and last-updated labels to each financial data field.
3. Validate statement data and units before calculations.
4. Store forecast assumptions and measure forecasts against actual outcomes.
5. Run `npm test` before inviting users.

## Accounts, Google sign-in, and private AI history

This project uses Supabase Auth for email/password and Google sign-in, plus a Postgres table with row-level security (RLS) for each user's AI history. The OpenAI key stays securely on the backend server. The browser receives only the Supabase project URL and public anon key; never expose a Supabase service-role key.

### One-time setup required before account features work

1. Create a Supabase project at https://supabase.com/ and open **Project Settings → API**. Copy the project URL and the **anon/public** key.
2. In Supabase **SQL Editor**, run the complete script in `supabase/schema.sql`. This creates `analysis_history` and policies that restrict reads/inserts/deletes to the signed-in user's own rows. Do not disable RLS.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed domain (or `http://localhost:3000` when testing locally) and add that same origin to the allowed redirect URLs.
4. In Supabase **Authentication → Providers → Google**, enable Google and configure the Google OAuth Client ID and Client Secret from the Google Cloud OAuth credentials setup. Add the Supabase-provided callback URL to the Google OAuth client's authorized redirect URIs. Google sign-in will not work until both sides are configured.
5. In your server host's **Environment Settings** (or local `.env`), configure:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_ANON_KEY` = your Supabase anon/public key
   - `OPENAI_API_KEY` = your OpenAI API key
   - `FMP_API_KEY` = your Financial Modeling Prep key
   Then restart or deploy the service. Never put secret keys in frontend files, commits, screenshots, or chat.
6. Visit the site, create an account, and test email sign-in first. Test Google only after completing its provider setup.

### Security and behavior

- Signed-in AI requests verify the Supabase access token; guest AI access remains enabled. The separate AI throttle is 60 requests per rolling hour per process/account (all guests share a bucket). Market-data allowances do not limit OpenAI billing.
- AI answers are saved to Supabase under the signed-in user's account. Database RLS isolates each user's history; the app does not give one user access to another user's records.
- Market quote/history and the manual calculator remain available without an account. AI assistant and automatic company analysis require sign-in.
- The OpenAI API is billed separately from a ChatGPT subscription. Set billing/usage limits in your OpenAI platform account before inviting other people.
- The app stores AI answers and signed-in users' manual scanner results under that user's account; passwords and API keys are never stored in the history table. Avoid entering sensitive personal data.
- Email confirmation settings can require users to verify their email before their first sign-in.
- The in-memory rate limit resets on server restart and is not shared across multiple server instances; treat it as a basic safeguard, not a complete abuse-prevention system.


## Financial Modeling Prep market data

Market-data calls use FMP's Stable API from the server: `/stable/quote`, `/stable/historical-price-eod/full`, `/stable/income-statement`, `/stable/balance-sheet-statement`, and `/stable/cash-flow-statement`. Set `FMP_API_KEY` in Render's environment settings; never put the key in frontend code or GitHub. FMP endpoint access, historical coverage, and annual/quarterly statement availability depend on your FMP plan. The API endpoints are normalized to the existing dashboard response format so the current frontend can continue working.


## Reliability checks and provider budget

Run `npm test` for the regression checks.

Market endpoints retain a 120-request/minute process throttle. Actual FMP attempts are atomically limited in shared Postgres to four per signed-in account and 225 site-wide in any rolling 24 hours. Cached reads do not consume either limit. Failed/reserved attempts count conservatively; counters survive restarts. Unauthenticated requests can read saved data but cannot start provider calls. A statement analysis loads one requested period (three calls), rather than annual and quarterly together (six). FMP_DAILY_REQUEST_LIMIT is superseded by the database-enforced cap.

Company analysis includes selected financial fields from the two latest annual reports for each statement, with periods, currencies, and missing values preserved. Automatic analysis runs only on Enter or the Analyze company button and ignores duplicate submissions while a request is running.
Market-data calls use FMP's Stable API from the server: `/stable/quote`, `/stable/historical-price-eod/full`, `/stable/income-statement`, `/stable/balance-sheet-statement`, and `/stable/cash-flow-statement`. Set `FMP_API_KEY` in your backend environment settings (.env); never put the key in frontend code or GitHub. FMP endpoint access, historical coverage, and annual/quarterly statement availability depend on your FMP plan. The API endpoints are normalized to the existing dashboard response format so the current frontend can continue working.


## Tester market-data policy

- Four actual upstream attempts per signed-in account in any rolling 24 hours; 30 accounts using all four make at most 120 attempts from those accounts. Accounts are not pre-created and signup is not restricted to an invitation list.
- Shared site ceiling: 225 attempts in any rolling 24 hours. Calls from another application using the same FMP key are outside this ledger.
- Cache freshness: statements and historical prices 24 hours, quotes 60 minutes, news four hours. Stale data remains available with timestamps when a limit or provider failure prevents refresh. No background provider polling.
- Annual and quarterly statements are loaded separately. News loads on explicit request. A three-statement analysis can use three calls; a quote can use one. AI and TradingView are separate services.
- `GET /api/market-usage` shows the authenticated user's remaining allowance and next call expiry. The client sends a Supabase bearer token; client-supplied user IDs are never used.
- The private `market_private` schema holds cache leases and attempt records. A database advisory lock makes reservations atomic across deployments. Tables deny direct anonymous/authenticated access. The public RPC is an invoker wrapper; its private definer requires a server-only 256-bit cache secret.
- Configure `MARKET_CACHE_SECRET` in the backend environment, and privately provision `market_private.config.secret_hash` with its SHA-256 hexadecimal digest. Do not commit the secret or expose it to browsers. The migration intentionally contains no credential. Production has been provisioned; other environments fail closed until separately configured.
- Missing/unavailable quota storage prevents new upstream requests. Reservations are not refunded after network errors because the provider may have counted them.
