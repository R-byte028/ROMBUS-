# Security Notes

**Status:** Initial requirements; no independent security audit has been performed.

## Non-negotiable rules
- Never request, collect, store, or transmit wallet seed phrases or private keys.
- Never claim ROMBUS can move funds without the payer's explicit wallet authorization.
- Keep provider API secrets and Supabase secret/service-role credentials server-side.
- Validate all user input and all provider responses.
- Enforce merchant ownership and authorization on the server.
- Do not trust client-provided payment status, amounts, recipient addresses, or provider references.
- Use idempotency protections for callbacks and status updates.
- Avoid logging secrets, authentication tokens, seed phrases, or unnecessary personal data.

## Wallet authentication
- Merchant wallet sign-in uses SIWE (EIP-4361); the wallet signs a human-readable message, not a transaction.
- Challenges are random, short-lived, host/URI/address/chain-bound, and consumed atomically after server-side signature verification.
- Challenge storage is service-role-only; no public or authenticated client table access is granted.
- Wallet addresses are normalized before lookup and have a case-insensitive unique index.
- Supabase Auth sessions are issued server-side after wallet verification. Internal non-routable email identities are not contact addresses.
- Legacy email accounts remain available for migration and can link a wallet after signing in.
- Current verifier supports EOA EVM signatures only. Smart-contract wallet verification, WalletConnect and non-EVM wallet auth remain limitations.
- Shared database-backed rate limits are implemented on wallet nonce/verify and public quote/commit/status routes. Apply the rate-limit migration and verify enforcement on the Vercel preview before production. Abuse monitoring remains outstanding.

## Payment integrity
- Two narrowly scoped public-link lookup RPCs intentionally use `SECURITY DEFINER` and are executable by `anon` only. They return a small, fixed set of fields for an unguessable UUID and do not grant table-level reads. Supabase's advisor flags public `SECURITY DEFINER` execution; this is an intentional trade-off for public checkout and should be re-reviewed if the public-link design changes. All mutation RPCs and the individual-attempt lookup remain server-only.
- Bind each quote and transfer to one ROMBUS payment request.
- Use `EXACT_OUTPUT` for a merchant-fixed destination amount; the requested amount is denominated in destination-asset atomic units.
- Use the provider's `dry: true` quote for preview and create a deposit address only after explicit payer confirmation with `dry: false`.
- Verify token, network, amount, destination, and provider reference before completion.
- Handle late, partial, duplicate, and unexpected deposits explicitly.
- Do not mark a request completed based only on a transaction hash supplied by the browser.
- Keep an auditable state-transition history.
- Never let anonymous callers invoke database mutation RPCs or write provider status.

## Deployment checklist
- [ ] Secrets configured only in server environment variables.
- [ ] Row-level security policies and RPC execute grants reviewed and tested.
- [ ] Wallet nonce and signature verification tested with supported EVM wallets.
- [ ] Rate limits and abuse controls added to public auth and quote endpoints.
- [ ] Callback authenticity/verification method confirmed from provider docs.
- [ ] Dependency and build checks passing.
- [ ] Threat review completed before production use.

No audit or production security certification is claimed.
