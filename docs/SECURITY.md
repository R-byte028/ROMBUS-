# Security Notes

**Status:** Initial requirements; no security audit has been performed.

## Non-negotiable rules
- Never request, collect, store, or transmit wallet seed phrases or private keys.
- Never claim ROMBUS can move funds without the payer's explicit wallet authorization.
- Keep provider API secrets and Supabase service-role credentials server-side.
- Validate all user input and all provider responses.
- Enforce merchant ownership and authorization on the server.
- Do not trust client-provided payment status, amounts, recipient addresses, or provider references.
- Use idempotency protections for callbacks and status updates.
- Avoid logging secrets, authentication tokens, seed phrases, or unnecessary personal data.

## Payment integrity
- Bind each quote and transfer to one ROMBUS payment request.
- Verify token, network, amount, destination, and provider reference before completion.
- Handle late, partial, duplicate, and unexpected deposits explicitly.
- Do not mark a request completed based only on a transaction hash supplied by the browser.
- Keep an auditable state-transition history.

## Deployment checklist
- [ ] Secrets configured only in server environment variables.
- [ ] Row-level security policies reviewed and tested.
- [ ] Server-side authorization checks in place.
- [ ] Callback authenticity/verification method confirmed from provider docs.
- [ ] Rate limits and abuse controls added to public request/quote endpoints.
- [ ] Dependency and build checks passing.
- [ ] Threat review completed before production use.

No audit or production security certification is claimed.
