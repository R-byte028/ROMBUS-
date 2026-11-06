# Merchant authentication setup

## Vercel

The ROMBUS Vercel project must have these public variables in Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL=https://rombus-rombus1.vercel.app`

The NEAR Intents JWT remains server-only.

## Supabase Auth URL configuration

In the ROMBUS Supabase project, open **Authentication → URL Configuration** and set:

- **Site URL:** `https://rombus-rombus1.vercel.app`
- **Redirect URL allow-list:** add `https://rombus-rombus1.vercel.app/auth/callback`

For preview deployments, add only the exact preview callback URLs that need to be tested. Do not use a broad wildcard in production unless there is a clear need.

## Registration flow

1. Merchant submits business/display name, email, and password.
2. Supabase creates the Auth user. The business name is stored as display metadata; it is not used for authorization.
3. If email confirmation is enabled, Supabase sends a confirmation email to the callback route.
4. The callback exchanges the PKCE code for a session and sends the merchant to `/dashboard`.
5. The dashboard checks the user with `auth.getUser()`.

## Current scope

- Email/password registration and login are implemented.
- Merchant dashboard is protected by Supabase session middleware and server-side user verification.
- Payment requests are stored under the authenticated merchant's ID.
- Public checkout is not active yet. A saved request does not initiate a payment.
