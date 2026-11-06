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


## 2026-11-06 — Vercel environment and first successful build

### Completed
- Confirmed the Vercel project contains `NEAR_INTENTS_JWT` as an encrypted server-side environment variable for Development, Preview, and Production.
- Upgraded Next.js from 15.5.6 to 15.5.9 after the initial build warned that the earlier patch release had a known security issue.
- Changed the TypeScript target to ES2020 so BigInt-based token amount conversion compiles.
- Confirmed the latest main-branch deployment reached Vercel state `READY`.
- Build output confirms the landing page and both API routes were included.

### Verification boundaries
- The first build failed because TypeScript targeted ES2017; this was corrected.
- The later build completed successfully.
- Vercel SSO deployment protection prevented an unauthenticated external request from being used to validate the live API endpoints.
- The API key is configured in Vercel, but an authenticated `GET /v0/tokens` and `dry: true` quote have not yet been confirmed.
- No real payment or deposit address has been created.

### Next
1. Confirm the ROMBUS Supabase organization and create its project.
2. Add payment-request persistence with strict ownership and status-transition controls.
3. Test token discovery and a dry quote through an authenticated deployment request.
4. Build hosted payment links and payment-status tracking.


## 2026-11-06 — Merchant authentication and payment-request foundation

### Implemented
- Added Supabase SSR session refresh middleware for the Next.js 15 app.
- Added email/password merchant registration and sign-in actions and pages.
- Added the PKCE email-confirmation callback route.
- Added a protected merchant dashboard using server-verified `auth.getUser()`.
- Added merchant profile upsert under the existing row-level security policies.
- Added payment-request creation with server-side NEAR Intents token lookup.
- Converts decimal amounts to atomic units using integer arithmetic; validates token precision and the database's 78-digit numeric limit.
- Added recent payment-request listing and request status display.
- Added responsive styling and sign-in/register entry points on the landing page.

### Security boundaries
- Browser and server Supabase clients use only the publishable key; no service-role key was added.
- Payment requests are created through authenticated Supabase sessions and existing RLS policies.
- Amount decimals and asset metadata are resolved again on the server; client-supplied token metadata is not trusted.
- The dashboard cannot update payment status or create payment attempts/events.
- Creating a payment request does not call the executable NEAR Intents quote flow, create a deposit address, or move funds.
- Public hosted checkout is not implemented yet. The dashboard explicitly labels the reserved checkout URL as inactive.

### Verification status
- GitHub source commits completed.
- Vercel deployment for the latest commit is building; GitHub's Vercel status is pending.
- End-to-end registration, email confirmation, sign-in, RLS writes, and payment-request creation still require a successful deployment and live browser test.
