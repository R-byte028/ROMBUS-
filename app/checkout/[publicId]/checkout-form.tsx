"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProviderToken } from "@/lib/checkout";

type QuotePreview = {
  amountInFormatted: string;
  amountOutFormatted: string;
  minAmountInFormatted?: string;
  maxAmountInFormatted?: string;
  deadline: string | null;
  timeEstimate: number | null;
  sourceSymbol: string;
  destinationSymbol: string;
};

type CommittedAttempt = {
  attemptId: string;
  sourceAssetId: string;
  depositAddress: string;
  depositMemo: string | null;
  amountInFormatted: string;
  amountOutFormatted: string;
  minAmountInFormatted?: string;
  maxAmountInFormatted?: string;
  deadline: string;
  timeEstimate: number | null;
  providerStatus?: string | null;
};

type StatusInfo = { status: string; providerStatus: string | null };
type InjectedWallet = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

function isEvmNetwork(value?: string) {
  return /ethereum|\beth\b|base|arbitrum|optimism|polygon|\bbnb\b|binance smart chain|avalanche|\bavax\b|linea|scroll|zksync|mantle|gnosis|blast|celo/i.test(value || "");
}

export default function CheckoutForm({ publicId, tokens, destinationSymbol, initialAttempt }: {
  publicId: string;
  tokens: ProviderToken[];
  destinationSymbol: string;
  initialAttempt?: CommittedAttempt | null;
}) {
  const [sourceAssetId, setSourceAssetId] = useState(initialAttempt?.sourceAssetId || tokens[0]?.assetId || "");
  const [refundAddress, setRefundAddress] = useState("");
  const [preview, setPreview] = useState<QuotePreview | null>(null);
  const [attempt, setAttempt] = useState<CommittedAttempt | null>(initialAttempt || null);
  const [status, setStatus] = useState<StatusInfo | null>(initialAttempt ? {
    status: initialAttempt.providerStatus === "PROCESSING" ? "processing" : initialAttempt.providerStatus === "KNOWN_DEPOSIT_TX" ? "known_deposit_tx" : "pending_deposit",
    providerStatus: initialAttempt.providerStatus || "PENDING_DEPOSIT",
  } : null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sourceToken = useMemo(() => tokens.find((token) => token.assetId === sourceAssetId), [tokens, sourceAssetId]);

  async function connectRefundWallet() {
    setError("");
    try {
      const provider = (window as Window & { ethereum?: InjectedWallet }).ethereum;
      if (!provider) throw new Error("No EVM wallet was detected. Open this checkout inside your wallet app browser or enter your refund address manually.");
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("Your wallet did not return an account.");
      setRefundAddress(accounts[0]);
      setPreview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect your wallet.");
    }
  }

  async function requestPreview() {
    setBusy(true); setError(""); setPreview(null); setAttempt(null); setStatus(null); setConfirmed(false);
    try {
      const response = await fetch("/api/checkout/" + publicId + "/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceAssetId, refundAddress: refundAddress.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to get a quote.");
      setPreview(data as QuotePreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote request failed.");
    } finally { setBusy(false); }
  }

  async function confirmPayment() {
    if (!confirmed) { setError("Confirm the payment details before generating a deposit address."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout/" + publicId + "/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceAssetId, refundAddress: refundAddress.trim(), confirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to prepare the payment.");
      setAttempt(data as CommittedAttempt);
      setStatus({ status: "pending_deposit", providerStatus: "PENDING_DEPOSIT" });
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment setup failed.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!attempt || ["completed", "incomplete_deposit", "expired", "failed", "refunded"].includes(status?.status || "")) return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/checkout/attempt/" + attempt.attemptId + "/status", { cache: "no-store" });
        const data = await response.json();
        if (active && response.ok) setStatus({ status: data.status, providerStatus: data.providerStatus || null });
      } catch { /* Temporary status errors do not alter payment state. */ }
    };
    void check();
    const timer = window.setInterval(check, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attempt, status?.status]);

  async function copyDepositAddress() {
    if (!attempt?.depositAddress) return;
    try { await navigator.clipboard.writeText(attempt.depositAddress); }
    catch { setError("Copy failed. Select and copy the deposit address manually."); }
  }

  return (
    <div className="stack checkout-form">
      {!attempt ? <>
        <label>Pay with
          <select className="field" value={sourceAssetId} onChange={(event) => { setSourceAssetId(event.target.value); setPreview(null); }} disabled={busy}>
            {tokens.map((token) => <option key={token.assetId} value={token.assetId}>
              {token.symbol || token.name || token.assetId}{token.blockchain ? " · " + token.blockchain : ""}
            </option>)}
          </select>
        </label>
        <label>Refund wallet address
          <input className="field" value={refundAddress} onChange={(event) => { setRefundAddress(event.target.value); setPreview(null); }} placeholder="Your wallet address on the payment network" minLength={2} maxLength={200} required />
        </label>
        {isEvmNetwork(sourceToken?.blockchain) ? <button className="quiet-button refund-wallet-button" type="button" onClick={connectRefundWallet} disabled={busy}>Connect EVM wallet to fill address</button> : null}
        <p className="muted fine-print">Use an address on the network of the asset you are paying with. For supported EVM networks, connect your wallet to fill this automatically. You still review the quote and send funds yourself.</p>
        {!preview ? <button className="primary" type="button" onClick={requestPreview} disabled={busy || !sourceAssetId || refundAddress.trim().length < 2}>
          {busy ? "Getting quote…" : "Get payment quote"}
        </button> : null}
      </> : null}

      {preview ? (
        <div className="checkout-quote">
          <p className="eyebrow">LIVE QUOTE PREVIEW</p>
          <div className="quote-line"><span className="muted">You pay</span><strong>{preview.amountInFormatted} {preview.sourceSymbol}</strong></div>
          <div className="quote-line"><span className="muted">Merchant receives</span><strong>{preview.amountOutFormatted} {preview.destinationSymbol || destinationSymbol}</strong></div>
          {preview.minAmountInFormatted ? <div className="quote-line"><span className="muted">Minimum input</span><strong>{preview.minAmountInFormatted} {preview.sourceSymbol}</strong></div> : null}
          {preview.maxAmountInFormatted ? <div className="quote-line"><span className="muted">Maximum input</span><strong>{preview.maxAmountInFormatted} {preview.sourceSymbol}</strong></div> : null}
          {preview.deadline ? <p className="muted fine-print">Preview deadline: {new Date(preview.deadline).toLocaleString()}</p> : null}
          <p className="muted fine-print">This preview does not reserve a deposit address. The final amount may change when you confirm.</p>
          <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I have reviewed the quote and want ROMBUS to request a live deposit address. I understand funds move only if I send them to that address.</label>
          <button className="primary" type="button" onClick={confirmPayment} disabled={busy || !confirmed}>
            {busy ? "Preparing payment…" : "Confirm and generate deposit address"}
          </button>
        </div>
      ) : null}

      {attempt ? (
        <div className="checkout-quote">
          <p className="eyebrow">DEPOSIT INSTRUCTIONS</p>
          <div className="quote-line"><span className="muted">Send exactly</span><strong>{attempt.amountInFormatted} {sourceToken?.symbol || "tokens"}</strong></div>
          <div className="quote-line"><span className="muted">Merchant receives</span><strong>{attempt.amountOutFormatted} {destinationSymbol}</strong></div>
          {attempt.minAmountInFormatted ? <div className="quote-line"><span className="muted">Minimum deposit</span><strong>{attempt.minAmountInFormatted} {sourceToken?.symbol || "tokens"}</strong></div> : null}
          <label>Deposit address<textarea className="field deposit-address" readOnly value={attempt.depositAddress} rows={3} /></label>
          <button className="quiet-button copy-button" type="button" onClick={copyDepositAddress}>Copy deposit address</button>
          {attempt.depositMemo ? <label>Required memo / tag<input className="field" readOnly value={attempt.depositMemo} /></label> : null}
          <p className="error">Only send the exact supported asset to this address. Include the memo/tag if shown. Sending a different token or omitting a required memo may result in loss of funds.</p>
          <p className="muted fine-print">Deposit before: {new Date(attempt.deadline).toLocaleString()}</p>
          <div className="payment-status">
            <span className="muted">Payment status</span>
            <strong>{status?.status?.replaceAll("_", " ") || "Waiting for deposit"}</strong>
            <span className="muted fine-print">Status is checked with NEAR Intents. You can safely return to this link to resume these instructions.</span>
          </div>
          {status?.status === "completed" ? <p className="notice">Payment confirmed. The merchant has received the requested asset.</p> : null}
          {status && ["failed", "refunded", "incomplete_deposit", "expired"].includes(status.status) ? <p className="error">This payment attempt ended with status: {status.status.replaceAll("_", " ")}. Do not send additional funds to this address.</p> : null}
        </div>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}
