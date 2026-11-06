# NEAR Intents Integration Notes

**Status:** Research required; no working integration is claimed yet.

## Integration model to validate

The intended 1Click lifecycle is:

1. Request a quote for the payer's source asset/network and recipient's destination asset/network.
2. Receive quote details and a deposit address (plus any required memo/tag or instructions).
3. Present the quote, fees, minimums, expiry, and deposit instructions to the payer.
4. Payer explicitly sends the required source funds from a compatible wallet.
5. Track the transfer using the provider's status mechanism.
6. Verify destination settlement and recipient details before marking the ROMBUS request completed.

ROMBUS must not treat quote creation as payment, deposit submission as settlement, or an unverified callback as proof of completion.

## Research checklist

Before coding against the API, record source links and date checked for:

- Official API base URL and environment(s).
- Authentication requirements and secret handling.
- Quote request/response schema.
- Supported source and destination chains/assets and how to retrieve current support.
- Deposit address, memo/tag, amount, precision, and minimum/maximum constraints.
- Quote expiry and behavior when a quote expires.
- Status endpoint, polling guidance, webhooks/callback signatures, and status values.
- Destination transaction identifiers and settlement finality semantics.
- Partial deposits, underpayments, overpayments, duplicate deposits, and late deposits.
- Failed transfers, refund eligibility, refund address requirements, and refund status.
- Rate limits, fees, and operational error responses.

## Implementation safeguards

- Validate provider responses at the server boundary.
- Persist provider quote/transfer identifiers and timestamps.
- Make callbacks and status processing idempotent.
- Never trust a browser-supplied status as authoritative.
- Do not expose API credentials to client-side code.
- Keep provider status distinct from ROMBUS business status.
- Log identifiers and state transitions without logging secrets or sensitive wallet data.

## Evidence log

No endpoints, route lists, or API payloads have been verified for this project yet. Add dated links, sanitized examples, and test results here after official documentation review.
