# Temporary guest market access — approval pending
This change is not enabled in production. Apply database/pending_guest_access.sql only after explicit approval.
It adds a separate private guest-attempt ledger and a server-secret-protected RPC. Existing account foreign keys remain intact. Both ledgers share the same atomic 225-call cap and cache; each signed browser cookie gets four attempts per rolling 24 hours.
The cookie is HttpOnly, Secure and SameSite=Lax. Clearing cookies can obtain another browser allowance; the shared site cap still limits total use.
Enable with MARKET_GUEST_ACCESS=true only after the database migration and code are deployed. Set false to restore sign-in requirements.
Automatic approval review rejected this production database expansion; no guest database migration has been applied.
