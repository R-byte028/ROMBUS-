# RIVA — NEAR Hackathon Submission & Judge Guide

## Project

**RIVA — Move value. Without boundaries.**

RIVA is a non-custodial, intent-powered payment prototype. Merchants create payment requests and share hosted checkout links. The project integrates NEAR Intents 1Click for supported-asset discovery and quote flows, with the goal of reducing the friction of paying across different tokens and networks.

## Public links

- Source repository: https://github.com/R-byte028/ROMBUS-
- Preview deployment: https://rombus-j4k8re55l-rombus1.vercel.app
- Feature branch: `design/futuristic-blue-purple-ui`

## What is implemented in the prototype

- Responsive RIVA landing page.
- Merchant wallet sign-in and protected dashboard.
- Merchant payment-request creation and request history.
- Shareable public checkout route for payment requests.
- Server-side NEAR Intents token discovery and quote endpoint.
- Asset/network selection with searchable options.
- Payment-attempt and request-status interface.

## Suggested judge walkthrough

1. Open the public preview and introduce RIVA's purpose.
2. Open Merchant access and show the wallet sign-in experience. Do not expose private keys, seed phrases, or personal account information.
3. If already authenticated, show the merchant dashboard and existing payment requests.
4. Create or open a demo payment request and show its hosted checkout URL.
5. Open the checkout in a separate browser tab and show the merchant, amount, receiving asset/network, and payment details.
6. Show the supported-asset/quote experience if the provider responds successfully.
7. Explain that a payer must review and authorise any wallet action; RIVA does not take custody of wallet keys.

Use a demo request with no real funds. Do not imply that a quote preview, deposit instruction, or pending payment is a completed settlement.

## Verification status and limitations

- Latest feature-branch Vercel build: **READY**.
- The public repository is accessible.
- A checkout URL returned the checkout page through deployment inspection, but a browser-side 404 was reported and remains under investigation.
- Wallet connection has had an unresolved loading/prompt issue in a prior test.
- A complete end-to-end payment using real funds and independently verified destination settlement has **not** been confirmed.
- Do not claim production readiness, audited security, or universal cross-chain support.

## Build and local setup

Requirements: Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure Supabase environment values and the server-side `NEAR_INTENTS_JWT` locally. Never commit secrets.

Validation commands:

```bash
npm run typecheck
npm run build
```

## Submission checklist

- [ ] Confirm the public repository URL.
- [ ] Confirm README and this evaluator guide are current.
- [ ] Confirm the public demo URL opens in a normal browser.
- [ ] Record a short demo video showing only verified features.
- [ ] Publish a public X post mentioning **NEAR HACKATHON**, linking the repository, and attaching the demo video or screenshots.
- [ ] Prepare the submission description (20–2,000 characters), team details, track, payout address, repository URL, and public demo-post URL.
- [ ] Review every field carefully before the final form submission; the form is understood to be uneditable after submission.

## Demo video guidance

Aim for 60–90 seconds:
- 0–10s: State the Web3 payment friction and introduce RIVA.
- 10–25s: Show the landing page and merchant access.
- 25–45s: Show the merchant dashboard and a payment request.
- 45–65s: Open the hosted checkout and explain the request and quote experience.
- 65–80s: Explain the NEAR Intents integration and the prototype's current verification boundary.
- 80–90s: Show the repository and close with the project name.

Record the actual browser, not a mock-up. Keep wallet secrets, private information, and any real transaction details off-screen.

## Deadline recorded by the team

The team recorded the build deadline as **14 November 2026 at 23:59 UTC** (15 November at 00:59 in Nigeria, UTC+1). Verify the official event page and submission portal before submitting.
