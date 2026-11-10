## Unreleased — wallet-first merchant access

- Replaced the new-merchant email/password registration entry point with SIWE wallet sign-in.
- Added short-lived, single-use EVM wallet challenges and server-side signature recovery.
- Added wallet linking for existing email-based merchant accounts and retained a legacy sign-in route.
- Added wallet identity fields and service-role-only challenge storage.
- Kept public customer checkout accountless.
- Restricted provider quote/status mutation RPC execution to the service role after the security advisor exposed broad grants.
- Initial wallet connector supports injected EVM EOA wallets only; WalletConnect, smart-contract wallets, non-EVM wallets, and rate limiting remain follow-up work.

# Changelog

All notable project changes are recorded here. This project is in early development; entries describe repository changes, not unverified product capabilities.

## [Unreleased]

### Added
- Initial project README and hackathon evaluator guide.
- Architecture, development log, technical decision, NEAR Intents, testing, and security documentation foundations.

### Not yet implemented
- Application scaffold and user interface.
- Supabase schema/authentication.
- NEAR Intents 1Click quote/deposit/status integration.
- Checkout and payment-request lifecycle.
- Automated tests and public demo.
