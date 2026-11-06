# ROMBUS Database

**Supabase project:** `Rombus Project` (Near Org)

## Initial payment core

The first schema migration creates:

- `merchant_profiles`: authenticated merchant profile metadata.
- `payment_requests`: public payment request identifier, destination asset, exact atomic amount, recipient wallet, expiry, and request state.
- `payment_attempts`: individual provider quote/deposit attempts and provider lifecycle state.
- `payment_events`: append-oriented status/event history for audit and reconciliation.

All four tables have Row Level Security enabled. Merchants can read their own records. Authenticated merchants can create their own profile and open payment requests. Attempts and events are read-only to merchant clients; trusted server-side operations will write them. The public checkout must be implemented through validated server routes rather than granting anonymous table access.

Amounts are stored as `numeric(78,0)` atomic units to avoid floating-point precision loss. The application must use token decimals from the provider's supported-token list for display and conversion.

## Payment state model

A request starts as `open` and can become `paid`, `cancelled`, or `expired` only through trusted application logic. Each attempt records its own provider state, including deposit, processing, completion, incomplete deposit, failure, expiry, and refund states. A request is not considered paid merely because a payer submits a transaction; settlement must be confirmed by provider status.

## Security boundary

- Supabase publishable key is configured in Vercel for browser and server clients; it is not a secret and must always be paired with RLS.
- No Supabase secret/service-role key is exposed to the browser or committed to Git.
- Provider credentials remain server-only.
- Never trust browser-supplied merchant IDs or payment statuses.

## Migration history

- `20261106200500_initial_payment_core.sql`
- `20261106200600_index_payment_event_attempt_fk.sql`

The migrations are mirrored in the Supabase project and should remain the source-controlled schema history.
