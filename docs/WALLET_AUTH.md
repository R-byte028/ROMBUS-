# Wallet-first merchant authentication

**Status:** Implemented on the wallet-auth feature branch; requires CI and manual wallet testing before production.

## Product behavior

- New merchants use an EVM wallet to authenticate. They do not enter an email address or create a password.
- The wallet signs a Sign-In with Ethereum (SIWE / EIP-4361) message. The message explicitly states that it does not move funds.
- The signature is used only to prove control of the wallet. Payment execution remains a separate, explicit wallet action.
- Customers do not create ROMBUS accounts to use public checkout links.
- Existing email/password merchants can still use `/legacy-login` and link a wallet from their dashboard. Their existing user IDs and payment history are preserved.
- `/signup` redirects to wallet sign-in; new email/password registrations are disabled.

## Authentication flow

1. The browser connects to an injected EVM wallet and reads its address and chain ID.
2. The server creates a random 128-bit nonce with a five-minute expiry and stores it in `wallet_auth_challenges`.
3. The server returns a SIWE message bound to the current deployment host, URI, wallet address, chain ID, nonce and expiry.
4. The wallet signs the message with `personal_sign`.
5. The server compares the returned SIWE payload byte-for-byte with the exact message stored for that challenge, recovers the EVM signer from the signature, checks the signer address and expiry, then atomically consumes the nonce.
6. For a new wallet, the server creates an internal Supabase Auth identity with a non-routable `wallet.rombus.invalid` email address. No email is sent or required. It generates and immediately consumes a one-time magic-link token server-side to establish the normal Supabase session.
7. The merchant profile stores the normalized wallet address. Existing RLS policies continue to use the Supabase Auth user ID.

The synthetic email is an internal Supabase Auth compatibility detail only. It is not shown to users and is not a contact address. Never use user-editable metadata as an authorization source.

## Security controls

- Nonces are cryptographically random, expire after five minutes, and are single-use.
- Nonces are bound to wallet address, chain ID, host, URI and purpose.
- Signature verification runs on the server using EIP-191 message recovery; the signed payload must exactly match the server-issued SIWE message.
- Nonce consumption is an atomic database update, preventing replay.
- Challenge records are inaccessible to `anon` and `authenticated`; only the server's Supabase secret client can access them.
- Wallet addresses are unique across merchant profiles (case-insensitive).
- Supabase secret credentials and generated magic-link tokens remain server-side.
- No seed phrase or private key is requested, received or stored.

## Current limitations

- The initial connector uses an injected EVM provider. For mobile, open ROMBUS inside a compatible wallet's in-app browser.
- WalletConnect / Reown AppKit has not been configured yet.
- This SIWE verifier supports externally owned EVM accounts. EIP-1271 smart-contract wallet verification is not enabled.
- Non-EVM wallet sign-in (NEAR, Solana, Bitcoin, etc.) is not implemented yet.
- Public nonce endpoints still need production rate limiting and abuse monitoring.
- Optional merchant email notifications are not implemented yet.

Do not describe wallet-first authentication as production-ready until the limitations above are addressed or explicitly accepted and the complete flow has passed manual testing.
