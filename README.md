# RIVA

**Move value. Without boundaries.**

RIVA is a non-custodial, intent-powered payment prototype built around merchant payment requests and hosted checkout. It is designed to let a merchant request a destination asset while a payer can explore supported source assets and routes through NEAR Intents 1Click.

## The problem

Web3 payments often require a payer to hold the exact token on the exact network requested by a recipient. That creates friction for merchants and customers operating across ecosystems.

## The approach

RIVA brings the payment request and checkout experience into one flow:

1. A merchant signs in and creates a payment request with an amount, receiving asset/network, recipient details, and expiry.
2. RIVA stores the request and provides a shareable hosted checkout link.
3. A payer opens the link without needing a RIVA account.
4. The checkout presents request details and the available payment/quote experience.
5. The payer reviews payment details and remains in control of any wallet action.
6. RIVA tracks payment attempts and displays status based on the information available to the application/provider.

## Current prototype

The public preview includes:
- RIVA landing page and responsive interface.
- Merchant wallet sign-in flow and protected dashboard.
- Merchant payment-request creation and request history.
- Public hosted checkout pages for payment requests.
- NEAR Intents 1Click server-side token discovery and quote integration.
- Searchable asset/network selection, including clearer BNB Smart Chain (BEP20) labels.
- Payment-attempt tracking and request status UI.

**Verification boundary:** The latest feature-branch Vercel preview build completed successfully. A checkout URL returned the checkout page when fetched through the deployment inspection environment, but a browser-side 404 was also reported and is still under investigation. Wallet connection and a complete real-funds payment-to-settlement flow have not been independently verified end to end. Do not treat a quote preview or payment attempt as proof of settlement.

## Technology

- Next.js 15, React 19, TypeScript
- Supabase authentication and persistence
- NEAR Intents 1Click API
- Vercel hosting

Provider credentials remain server-side. RIVA does not ask users for seed phrases or private keys. A payer must independently review and authorise any wallet transaction.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure the required Supabase project values and the server-side `NEAR_INTENTS_JWT` in `.env.local`. Never commit secrets. Then open http://localhost:3000.

Checks:

```bash
npm run typecheck
npm run build
```

## Evaluator guide

See [HACKATHON.md](HACKATHON.md) for the prototype walkthrough, verification boundaries, and known limitations.

## Project status

RIVA is a hackathon prototype, not a production payment service. Supported assets and routes depend on the live provider catalogue and quote response. Wallet connectivity, quote expiry handling, deposit monitoring, destination settlement verification, refunds, and failure recovery require further end-to-end validation. No security audit or production readiness is claimed.

## Repository

Public source: https://github.com/R-byte028/ROMBUS-
