# ROMBUS Database

**Supabase project:** \`Rombus Project\` (Near Org)

## Initial payment core

The first schema migration creates:

- \`merchant_profiles\`: authenticated merchant profile metadata.
- \`payment_requests\`: public payment request identifier, destination asset, exact atomic amount, recipient wallet, expiry, and request state.
- \`payment_attempts\`: individual provider quote/deposit attempts and provider lifecycle state.
- \`payment_events\`: append-oriented status/event history for audit and reconciliation.

All four tables have Row Level Security enabled. Merchants can read their own records. Authenticated merchants can create their own profile and open payment requests. Attempts and events are read-only to merchant clients; trusted server-side operations write them. Public checkout is exposed through narrowly scoped database functions, not anonymous table SELECT policies.

Amounts are stored as \`numeric(78,0)\` atomic units to avoid floating-point precision loss. The application uses token decimals from the provider's supported-token list for display and conversion.

## Public checkout functions

The checkout migrations add narrowly scoped \`SECURITY DEFINER\` RPCs with a fixed search path:

- \`get_public_payment_request\`: returns only the payment details needed for a public link identified by its random UUID.
- \`get_public_payment_attempt\`: returns deposit instructions and state for a random attempt UUID.
- \`create_public_payment_attempt\`: creates a pending attempt after rechecking that the request is open and unexpired; it also prevents overlapping active attempts.
- \`store_public_payment_quote\`: persists the executable provider quote, provider signature, and full response for dispute/audit evidence. Status polling also retains the full provider status response, including settlement transaction details.
- \`fail_public_payment_attempt\`: closes a pending attempt when quote creation fails.
- \`apply_public_payment_status\`: maps trusted provider states to ROMBUS states and marks the request paid only on provider \`SUCCESS\`.

Only the two read functions are executable by \`anon\` and \`authenticated\`. All mutation functions are executable only by \`service_role\`; API routes call them through a server-only Supabase secret key. Never grant anonymous clients permission to set provider statuses or write deposit addresses.

## Payment state model

A request starts as \`open\` and becomes \`paid\` only after the authenticated provider status endpoint reports \`SUCCESS\`. Each attempt records its own provider state, including deposit, processing, completion, incomplete deposit, failure, expiry, and refund states. A transaction hash or browser claim alone never marks a request paid.

## Security boundary

- Supabase publishable key is configured in Vercel for browser and server clients; it is not a secret and must always be paired with RLS.
- \`SUPABASE_SECRET_KEY\` is server-only and must never be exposed to the browser or committed with a value.
- Provider credentials remain server-only.
- Public UUIDs act as unguessable link/attempt capabilities; do not expose internal merchant or database IDs.
- Checkout mutations are performed only by trusted server routes using the Supabase secret key.

## Migration history

- \`20261106200500_initial_payment_core.sql\`
- \`20261106200600_index_payment_event_attempt_fk.sql\`
- \`20261107015256_public_checkout_payment_lifecycle.sql\`
- \`20261107015305_restrict_public_checkout_writes.sql\`
