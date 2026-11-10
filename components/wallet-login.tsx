"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export default function WalletLogin({ purpose = "login", compact = false }: {
  purpose?: "login" | "link";
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connectAndVerify() {
    setBusy(true);
    setError("");
    try {
      const provider = window.ethereum;
      if (!provider) {
        throw new Error("No EVM wallet was detected. Open ROMBUS in your wallet app's browser, such as MetaMask or Trust Wallet.");
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
        throw new Error("Your wallet did not return an account.");
      }
      const address = accounts[0];
      const chainHex = await provider.request({ method: "eth_chainId" });
      if (typeof chainHex !== "string" || !/^0x[0-9a-f]+$/i.test(chainHex)) {
        throw new Error("Your wallet returned an invalid network.");
      }
      const chainId = Number.parseInt(chainHex, 16);
      if (!Number.isSafeInteger(chainId) || chainId <= 0) {
        throw new Error("Your wallet returned an invalid network.");
      }

      const challengeResponse = await fetch("/api/auth/wallet/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ address, chainId, purpose }),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok || typeof challenge.message !== "string" || typeof challenge.nonce !== "string") {
        throw new Error(challenge.error || "Could not start wallet verification.");
      }

      const signature = await provider.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });
      if (typeof signature !== "string") throw new Error("Your wallet did not return a signature.");

      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ message: challenge.message, signature, address, nonce: challenge.nonce }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok || !result.ok) throw new Error(result.error || "Wallet verification failed.");

      if (purpose === "link") {
        router.refresh();
      } else {
        window.location.assign("/dashboard");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.toLowerCase().includes("user rejected")) {
        setError("You cancelled the signature request. No transaction was sent.");
      } else {
        setError(cause instanceof Error ? cause.message : "Wallet connection failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "wallet-login wallet-login-compact" : "wallet-login"}>
      <button className={compact ? "quiet-button" : "primary"} type="button" onClick={connectAndVerify} disabled={busy}>
        {busy ? "Waiting for wallet…" : purpose === "link" ? "Link wallet" : "Connect wallet"}
      </button>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!compact && <p className="muted fine-print">Wallet signature only. ROMBUS never asks for your seed phrase or private key, and this sign-in message does not move funds.</p>}
    </div>
  );
}
