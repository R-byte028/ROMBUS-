# ROMBUS Architecture

**Status:** Proposed architecture; implementation is pending.

## Product boundary

ROMBUS coordinates payment requests and cross-chain settlement. It must not custody user private keys or represent a payment as successful before settlement evidence is verified.

## Proposed components

1. **Merchant interface** — creates and manages payment requests.
2. **Hosted checkout** — displays request details and available, live-quoted routes to the payer.
3. **Application backend** — validates requests, calls provider APIs, stores quote/payment references, and verifies status transitions.
4. **Persistence layer** — stores merchant identity, payment requests, quote metadata, and status history.
5. **NEAR Intents 1Click** — provides a quote and deposit instructions for supported routes, then exposes transfer status for tracking.

## Proposed payment sequence

`request → quote → payer review → deposit → provider tracking → settlement verification → completed`

The 1Click flow is not assumed to be a direct wallet-to-wallet transfer. A quote can return a deposit address; the payer must send the required funds from a compatible wallet. ROMBUS then tracks the provider's status.

## Trust boundaries

- Browser: public UI and non-secret request data only.
- Server: provider credentials, quote creation, callback/status verification, and database access.
- Wallet: payer-controlled signing and sending. ROMBUS must not request seed phrases or private keys.
- Provider: quote, deposit instructions, and transfer status. Provider responses must be validated and treated as external input.

## Proposed status model

- `pending`: request created; no accepted payment is in progress.
- `processing`: a deposit/transfer is underway according to verified provider state.
- `completed`: destination settlement is confirmed and matches the request.
- `expired`: request or quote expired without a completed payment.
- `failed`: provider reports a terminal failure or a validated internal failure occurs.
- `refunded`: refund is confirmed, not merely requested.

Allowed transitions and race handling must be enforced server-side and covered by tests. The exact provider status mapping remains to be validated.

## Planned technology

- Next.js + TypeScript + Tailwind CSS
- Supabase for database/authentication
- Vercel for hosting
- NEAR Intents 1Click for supported routes

These are planned choices until corresponding code and deployment evidence exist.
