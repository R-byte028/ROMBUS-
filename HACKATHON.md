# Hackathon Submission & Judge Guide

## Project
**ROMBUS — Move value. Without boundaries.**

ROMBUS is an intent-powered cross-chain payment infrastructure prototype. Its goal is to let a payer fund a payment using a supported asset/network while the recipient requests settlement in a different supported asset/network, using NEAR Intents where a route is available.

## Submission checklist

The team must complete and verify each item before submitting:

- [ ] Public GitHub repository URL.
- [ ] Complete README describing the problem, solution, architecture, technologies, setup, tests, limitations, and demo.
- [ ] This judge guide with reproducible steps and expected outcomes.
- [ ] Working public demo or clear local run instructions.
- [ ] Screenshots and/or a short demo video showing the real implemented flow.
- [ ] Public X post that mentions **NEAR HACKATHON**, links this repository, and includes the demo video or screenshots.
- [ ] Submission form details checked before final submission (project description, team details, track, payout address, repository URL, and public demo post URL).

The hackathon information recorded by the team is: build period Nov 1–14, 2026 (23:59 UTC deadline); judging Nov 16–18, 2026. Confirm the official event page for any changes before submitting. Nigeria is UTC+1, so 23:59 UTC on Nov 14 is 00:59 on Nov 15 in Nigeria.

## Judge testing

> **Current status:** The application flow is not yet implemented. The steps below are the intended acceptance path, not a claim that the prototype currently passes them. Replace this notice with verified commands, URLs, screenshots, and observed results as each feature is completed.

### Intended end-to-end flow

1. Open the public ROMBUS demo → See the ROMBUS landing page and a clear explanation of the payment flow.
2. Open the merchant dashboard → See the connected merchant identity and payment-request controls.
3. Create a request with amount, recipient address, destination asset/network, and expiry → See a new pending request and a unique checkout URL.
4. Open the checkout URL in a separate browser session → See the request details and only payment routes confirmed by the live quote integration.
5. Select a supported source asset/network → See a live quote, estimated output, fees, quote expiry, and the 1Click deposit instructions returned by the provider.
6. Review the quote and deposit details → The payer can choose to proceed or stop; no payment is initiated without the payer's explicit wallet action.
7. Send the requested deposit from a compatible wallet → See the payment move to processing only after the provider reports the relevant deposit state.
8. Wait for destination settlement → See completed only after settlement is verified against provider status and destination details.
9. Test an expired or failed request → See an accurate expired/failed state, with no false paid confirmation.
10. Refresh the checkout and merchant dashboard → See the same persisted request and consistent status.

### Evidence required for each test

Record the environment (testnet/mainnet), date, request ID, quote/provider reference, transaction identifiers where safe to publish, expected result, actual result, and pass/fail outcome. Never publish API secrets, private keys, seed phrases, or sensitive customer data.

## Local setup

Exact commands will be added after the application scaffold and dependency versions are committed. Do not assume the project is runnable until those instructions are present and tested.

## Known limitations

- Supported source/destination networks and assets are not yet confirmed in this repository.
- The live 1Click API integration has not yet been verified here.
- No payment execution, settlement, expiry, or refund behavior is currently claimed as implemented.
- No production deployment or security audit is claimed.
