# NEAR Intents Integration Notes

**Research checked:** 2026-11-06  
**Status:** API lifecycle researched from NEAR-maintained documentation. No working ROMBUS integration is claimed yet.

## Verified 1Click lifecycle

The NEAR-maintained 1Click API material describes this sequence:

1. Discover currently supported assets with `GET /v0/tokens`.
2. Request a quote with `POST /v0/quote`.
3. Use `dry: true` for a preview quote; it does not create a deposit address.
4. After the payer confirms the quote, request an executable quote with `dry: false`; the response includes a unique deposit address. The NEAR agent guide describes this address as having approximately 10 minutes of validity. Treat the returned deadline/expiry fields as authoritative rather than hardcoding this estimate.
5. The payer sends the origin asset to the returned deposit address using a compatible wallet.
6. Optionally notify 1Click of the deposit transaction using `POST /v0/deposit/submit`.
7. Query `GET /v0/status` and track the transfer until a terminal state.

The standard 1Click API base URL documented by NEAR is `https://1click.chaindefuser.com`.

## Provider statuses

The NEAR-maintained agent guide lists:

| Provider status | Meaning | Terminal |
|---|---|---|
| `PENDING_DEPOSIT` | Waiting for deposit | No |
| `KNOWN_DEPOSIT_TX` | Deposit transaction detected | No |
| `PROCESSING` | Solver execution in progress | No |
| `SUCCESS` | Destination tokens delivered | Yes |
| `INCOMPLETE_DEPOSIT` | Deposit below required amount | Yes |
| `REFUNDED` | Funds returned to refund address | Yes |
| `FAILED` | Error occurred | Yes |

Map provider statuses into ROMBUS business statuses explicitly. Do not assume the provider status strings are identical to ROMBUS's own lifecycle.

## Authentication and fees

NEAR's maintained agent documentation says developers can register through the Partners Portal for an API key and send it as a Bearer token. It describes a different fee schedule for authenticated and unauthenticated use. Confirm the current partner terms and exact fee schedule when obtaining credentials; do not hardcode fee assumptions in the UI.

API credentials must remain server-side. The client must never receive the partner secret.

## Quote and amount integrity

- For merchant-fixed invoices, use `swapType: EXACT_OUTPUT`. In this mode, `amount` is the requested destination token amount in destination-asset atomic units; the payer's source amount is quoted by 1Click. Do not calculate it using source-token decimals.
- The checkout flow previews with `dry: true` and requests an executable quote with `dry: false` only after the payer explicitly confirms. The executable quote is persisted before deposit instructions are shown.

- Use the live supported-token catalogue; do not manually invent asset IDs.
- Use the exact asset IDs and decimal precision returned by the provider.
- Use integer/string atomic token amounts for calculations.
- NEAR's guide explicitly warns that `amountOutUsd` is display-only. Never use it for settlement or business logic; use actual token amount fields.
- Show quote expiry, fees, slippage, minimums, and any deposit memo/tag returned by the provider.
- Requote if the executable quote expires before the payer deposits.

## Test environment caution

The standard 1Click API is a real payment route, so a dry quote is not a testnet payment and does not prove deposit/settlement behavior. A community project named Tidepool announced a 1Click-compatible testnet sandbox on the NEAR Forum on 2026-11-02. It is not the official 1Click production service; before using it, independently verify its operator, endpoints, asset support, faucet, settlement behavior, and suitability for hackathon evidence. Never present sandbox behavior as proof of a live official 1Click mainnet payment.

## Implementation safeguards

- Validate provider responses at the server boundary.
- Persist request IDs, quote IDs/references, deposit addresses, expiry, and transfer references.
- Make deposit notifications and status processing idempotent.
- Never trust a browser-supplied status as authoritative.
- Verify the destination asset, amount, recipient, and transaction evidence before marking a ROMBUS request completed.
- Handle late, partial, duplicate, and unexpected deposits explicitly.
- Keep provider status distinct from ROMBUS business status.
- Log identifiers and state transitions without logging secrets or unnecessary personal data.

## Research sources

- [NEAR-maintained 1Click API concepts](https://github.com/near/agent-skills/blob/main/skills/near-intents/references/concepts.md) — lifecycle, statuses, quote preview/commit, API key guidance, and amount handling.
- [NEAR / Defuse 1Click API documentation](https://github.com/defuse-protocol/gitbook-docs/blob/main/integration/distribution-channels/1click-api.md) — endpoint overview, base URL, supported-token discovery, quote, deposit notification, and status tracking. This GitHub documentation repository is marked archived, so check the live OpenAPI spec and partner portal before implementation.
- [1Click OpenAPI specification](https://1click.chaindefuser.com/docs/v0/openapi.yaml) — authoritative request/response schema to consult during implementation.
- [NEAR Forum: Tidepool announcement](https://gov.near.org/t/tidepool-a-1click-compatible-testnet-sandbox-for-near-intents/42746) — community sandbox announcement, not official 1Click production documentation.

## Evidence log

As of 2026-11-06, the documented endpoint names and lifecycle have been researched, but no ROMBUS endpoint calls, partner credentials, test transactions, or end-to-end settlement have been executed. Add sanitized request/response examples and observed results here after implementation.
