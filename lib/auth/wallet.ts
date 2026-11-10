import { createHash } from "node:crypto";

export function isAllowedWalletAuthHost(host: string) {
  const allowed = new Set<string>();
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (!value) continue;
    try { allowed.add(new URL(value.includes("://") ? value : `https://${value}`).host.toLowerCase()); }
    catch { /* Ignore malformed deployment configuration. */ }
  }
  if (process.env.NODE_ENV !== "production") allowed.add("localhost:3000");
  return allowed.has(host.toLowerCase());
}

export function walletIdentityEmail(address: string) {
  const digest = createHash("sha256").update(address.toLowerCase()).digest("hex");
  return `wallet-${digest}@wallet.rombus.invalid`;
}

export function walletDisplayName(address: string) {
  return `Wallet ${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function buildSiweMessage(input: {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}) {
  return [
    `${input.domain} wants you to sign in with your Ethereum account:`,
    input.address,
    "",
    input.statement,
    "",
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ].join("\n");
}
