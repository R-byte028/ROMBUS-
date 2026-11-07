# ROMBUS

**Move value. Without boundaries.**

ROMBUS is an intent-powered cross-chain payment infrastructure concept. It aims to let a payer use a supported asset and network while a recipient requests settlement in a different supported asset and network, using NEAR Intents where the route is available.

> **Development status:** Early-stage hackathon project. This repository is the source of truth for implementation progress. No payment route, asset, wallet, or settlement flow is considered supported until it has been integrated and tested end to end.

## Problem
Web3 payments often require the payer to hold the exact token on the exact network requested by the recipient. This creates friction for customers, merchants, and applications operating across ecosystems.

## Proposed solution
ROMBUS is being built around payment requests and hosted checkout:

1. A recipient creates a payment request with an amount, destination asset/network, recipient address, and expiry.
2. ROMBUS creates a shareable checkout link.
3. The payer selects from routes and assets that the integration can actually quote.
4. ROMBUS requests a live quote through NEAR Intents 1Click.
5. The payer reviews the quote and explicitly sends funds to the returned deposit address using a compatible wallet.
6. ROMBUS tracks the transfer and marks the request paid only after settlement is verified.

## Core principles
- **Non-custodial:** users retain control of their wallets and explicitly authorise payments.
- **Wallet-first merchant access:** new merchants authenticate by signing a wallet message, not by creating an email/password account.
- **Accountless checkout:** customers can open public payment links without registering with ROMBUS.
- **Evidence-based status:** a payment is not marked complete merely because a deposit was initiated.
- **Route transparency:** only routes, assets, and networks confirmed by the live integration will be presented as available.
- **Secure by design:** provider credentials and secrets stay on the server.

## Planned MVP
- Wallet-first merchant authentication
- Merchant dashboard and payment request creation
- Shareable hosted checkout
- Live quote retrieval
- Payer-directed deposit to a 1Click deposit address
- Settlement status tracking and verification
- Expiry and failure handling
- Responsive merchant and checkout interfaces
- Developer API and authorised AI-agent payment flows as longer-term directions

## Technology direction
- Next.js, TypeScript, and Tailwind CSS
- Supabase for persistence and authentication
- Vercel for hosting
- SIWE (EIP-4361) for initial EVM wallet proof
- NEAR Intents 1Click for supported cross-chain payment routes

## Repository guide
- [Hackathon evaluator guide](HACKATHON.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development log](docs/DEVELOPMENT_LOG.md)
- [Technical decisions](docs/TECHNICAL_DECISIONS.md)
- [Wallet authentication](docs/WALLET_AUTH.md)
- [NEAR Intents integration notes](docs/NEAR_INTENTS_INTEGRATION.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Changelog](CHANGELOG.md)

## Current status
The application includes a responsive ROMBUS quote-preview interface, a public token-discovery proxy, a server-only 1Click quote endpoint, merchant payment requests, and public hosted checkout with payment-attempt tracking. Wallet-first merchant authentication is being introduced on a feature branch. It uses SIWE challenge/verification routes and preserves legacy email accounts for migration. The first connector is injected EVM wallets; WalletConnect and non-EVM wallet authentication remain future work. No real-funds end-to-end payment test is claimed.

## License
License not yet selected. All rights reserved by default until a license is added.
