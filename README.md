# AI Finance Lab

A research-first financial analysis dashboard for public companies. It calculates transparent financial ratios, flags potential patterns worth investigating, and compares user-defined scenarios. This is a starter project, not investment advice.

## Features

- Financial statement input and financial ratio calculations
- Rule-based "Company Truth Scanner" for research prompts
- Transparent scenario calculator
- Optional market quote/history integration through a backend API
- Source/status labels and error states
- Responsive dark UI

## Important data and security notes

- The browser app does **not** contain an API key.
- Never commit API keys, `.env` files, tokens, or secrets to GitHub.
- The backend proxy in `server/` reads `ALPHA_VANTAGE_API_KEY` from an environment variable.
- Alpha Vantage endpoint access and rate limits depend on your account and provider plan.
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
3. For production, deploy the Node backend to a server host that supports environment variables. Set `ALPHA_VANTAGE_API_KEY` in that host's environment settings.
4. Set `API_BASE_URL` in `public/app.js` to your deployed backend URL if it is different from the same-origin `/api` route.

GitHub Pages cannot run the Node backend. You may host the static frontend on GitHub Pages, but the API must run elsewhere. Do not put the secret key in the frontend to make GitHub Pages work.

## API endpoints

- `GET /api/health` — server status
- `GET /api/quote?symbol=IBM` — Alpha Vantage global quote
- `GET /api/daily?symbol=IBM` — compact daily time series
- `GET /api/fundamentals?symbol=IBM` — income statement, balance sheet, cash flow; individual endpoints may be unavailable due to provider permissions/coverage

## Suggested next steps

1. Add a company search / ticker mapping source.
2. Add source links, reporting period, currency, and last-updated labels to each financial data field.
3. Validate statement data and units before calculations.
4. Store forecast assumptions and measure forecasts against actual outcomes.
5. Add automated tests and rate limiting before inviting users.
