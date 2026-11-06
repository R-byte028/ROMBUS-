# Development Log

This log records what was actually done, why decisions were made, and what evidence exists. Add an entry whenever a meaningful implementation, integration, test, or architectural decision is completed.

## 2026-11-06 — Repository and documentation foundation

### Completed
- Confirmed public repository: `R-byte028/ROMBUS-`.
- Confirmed default branch: `main`.
- Confirmed repository is owned by the primary GitHub account and has admin/push access.
- Confirmed the repository was empty before the initial documentation commit.
- Added the initial README and evaluator guide.
- Established documentation for architecture, technical decisions, NEAR Intents integration, testing, security, and changelog.

### Decisions / rationale
- Keep ROMBUS separate from all other projects.
- Focus the MVP on a working payment-request → hosted-checkout → quote → payer deposit → verified settlement path.
- Treat NEAR Intents 1Click as a quote/deposit/status flow, not as an automatic wallet transfer.
- Do not claim routes, assets, networks, or features work until verified.

### Tests
- Repository metadata/access check: passed.
- Initial README fetch before creation: confirmed repository was empty.
- Application tests: not applicable; application code has not yet been added.

### Next
1. Verify current official NEAR Intents 1Click documentation and API behavior.
2. Record supported environments, endpoints, authentication, quote/deposit/status fields, expiry, and failure/refund behavior.
3. Scaffold the application and establish automated checks.
4. Implement the smallest end-to-end testable payment flow.


## 2026-11-06 — First application scaffold

### Completed
- Added a Next.js 15 / React 19 / TypeScript application foundation.
- Added a responsive dark ROMBUS landing and quote-preview screen.
- Added server-side token discovery through `GET /v0/tokens`.
- Added a validated server-side quote proxy for `POST /v0/quote`.
- The quote proxy always sends `dry: true`; it does not generate a deposit address or move funds.
- Added `.env.example` documenting `NEAR_INTENTS_JWT` as a server-only secret.
- Added basic request validation and safe error responses.

### Security and scope
- No API credential was committed.
- No browser-exposed environment variable is used for the provider credential.
- No real payment, wallet signing, deposit address, or settlement is implemented.
- The UI uses the provider's supported-token response rather than a hardcoded list of networks or assets.

### Tests / verification
- GitHub writes completed successfully for the application files.
- Live token discovery and authenticated quote calls have not yet been executed.
- A local or CI production build has not yet been run; compile status remains unverified.

### Next
1. Add automated build/type checks and run them.
2. Configure the API credential securely in the deployment environment.
3. Verify live token discovery and an authenticated `dry: true` quote.
4. Add persistence for merchant payment requests, then hosted checkout and payment status tracking.
