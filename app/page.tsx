"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Token = {
  assetId: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  blockchain?: string;
  icon?: string;
};

function readTokens(value: unknown): Token[] {
  const list = Array.isArray(value) ? value : (value && typeof value === "object" && Array.isArray((value as { tokens?: unknown }).tokens) ? (value as { tokens: unknown[] }).tokens : []);
  return list.filter((item): item is Token => !!item && typeof item === "object" && typeof (item as Token).assetId === "string");
}

function toAtomic(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Enter a valid positive amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`This token supports up to ${decimals} decimal places.`);
  const atomic = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (atomic <= 0n) throw new Error("Amount must be greater than zero.");
  return atomic.toString();
}

export default function Home() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokenError, setTokenError] = useState("");
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [originAsset, setOriginAsset] = useState("");
  const [destinationAsset, setDestinationAsset] = useState("");
  const [amount, setAmount] = useState("1");
  const [recipient, setRecipient] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/intents/tokens")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load supported assets.");
        return readTokens(data);
      })
      .then((items) => {
        if (!active) return;
        setTokens(items);
        if (items.length) {
          setOriginAsset(items[0].assetId);
          setDestinationAsset(items.find((t) => t.assetId !== items[0].assetId)?.assetId || items[0].assetId);
        }
        if (!items.length) setTokenError("The provider returned no supported assets.");
      })
      .catch((e: Error) => active && setTokenError(e.message))
      .finally(() => active && setLoadingTokens(false));
    return () => { active = false; };
  }, []);

  const origin = useMemo(() => tokens.find((t) => t.assetId === originAsset), [tokens, originAsset]);
  const destination = useMemo(() => tokens.find((t) => t.assetId === destinationAsset), [tokens, destinationAsset]);

  async function requestQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setQuote(null);
    try {
      if (!origin || !destination) throw new Error("Choose both a payment asset and a receiving asset.");
      const response = await fetch("/api/intents/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          swapType: "EXACT_INPUT",
          originAsset,
          destinationAsset,
          amount: toAtomic(amount, origin.decimals ?? 0),
          recipient: recipient.trim(),
          refundTo: refundTo.trim(),
          slippageTolerance: 100,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Quote request failed.");
      setQuote(data as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const quoteDetails = quote && typeof quote.quote === "object" && quote.quote !== null ? quote.quote as Record<string, unknown> : null;

  return (
    <main className="shell" style={{ paddingTop: 28, paddingBottom: 64 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 74 }}>
        <a href="/" style={{ color: "inherit", textDecoration: "none", fontSize: 22, fontWeight: 800, letterSpacing: "-1px" }}>
          ROMBUS<span style={{ color: "var(--orange)" }}>.</span>
        </a>
        <div className="muted" style={{ fontSize: 13 }}>Cross-chain payments, simplified</div>
      </header>

      <section style={{ maxWidth: 760, margin: "0 auto 42px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 99, padding: "7px 12px", color: "var(--muted)", fontSize: 12, marginBottom: 20 }}>
          <span style={{ width: 7, height: 7, borderRadius: 20, background: "var(--orange)" }} />
          INTENT-POWERED PAYMENTS
        </div>
        <h1 style={{ fontSize: "clamp(38px, 7vw, 66px)", lineHeight: 1.04, letterSpacing: "-3px", margin: "0 0 18px", fontWeight: 800 }}>
          Move value.<br /><span style={{ color: "var(--orange)" }}>Without boundaries.</span>
        </h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.7, maxWidth: 570, margin: "0 auto" }}>
          Pay with one supported asset. Let the recipient receive another. ROMBUS is building a simpler way to move value across Web3.
        </p>
      </section>

      <section className="panel" style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(18px, 4vw, 30px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Try a payment quote</h2>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>Preview only. No funds will move.</p>
          </div>
          <span style={{ border: "1px solid rgba(255,122,26,.35)", color: "var(--orange)", borderRadius: 99, padding: "6px 10px", fontSize: 11 }}>PREVIEW</span>
        </div>

        {loadingTokens ? <p className="muted">Loading supported assets from NEAR Intents…</p> : null}
        {tokenError ? <p style={{ color: "#ff9b79", fontSize: 13 }}>{tokenError}</p> : null}

        <form onSubmit={requestQuote}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>You pay with
              <select className="field" style={{ display: "block", marginTop: 8 }} value={originAsset} onChange={(e) => setOriginAsset(e.target.value)} required>
                {tokens.map((t) => <option key={t.assetId} value={t.assetId}>{t.symbol || t.name || t.assetId} {t.blockchain ? `· ${t.blockchain}` : ""}</option>)}
              </select>
            </label>
            <label style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>Recipient gets
              <select className="field" style={{ display: "block", marginTop: 8 }} value={destinationAsset} onChange={(e) => setDestinationAsset(e.target.value)} required>
                {tokens.map((t) => <option key={t.assetId} value={t.assetId}>{t.symbol || t.name || t.assetId} {t.blockchain ? `· ${t.blockchain}` : ""}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginTop: 18, fontSize: 13, color: "var(--muted)" }}>Amount to pay
            <input className="field" style={{ display: "block", marginTop: 8 }} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1.00" required />
          </label>

          <label style={{ display: "block", marginTop: 18, fontSize: 13, color: "var(--muted)" }}>Recipient wallet address
            <input className="field" style={{ display: "block", marginTop: 8 }} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Destination-chain address" required />
          </label>

          <label style={{ display: "block", marginTop: 18, fontSize: 13, color: "var(--muted)" }}>Refund wallet address
            <input className="field" style={{ display: "block", marginTop: 8 }} value={refundTo} onChange={(e) => setRefundTo(e.target.value)} placeholder="Wallet address on the payment network" required />
          </label>

          <button className="primary" type="submit" disabled={busy || loadingTokens || !tokens.length} style={{ width: "100%", marginTop: 22 }}>
            {busy ? "Getting preview…" : "Get payment quote"}
          </button>
        </form>

        {error ? <p role="alert" style={{ color: "#ff9b79", fontSize: 13, marginBottom: 0 }}>{error}</p> : null}
        {quoteDetails ? (
          <div style={{ marginTop: 22, padding: 18, borderRadius: 12, background: "#0c1016", border: "1px solid var(--line)" }}>
            <div style={{ color: "var(--orange)", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>QUOTE PREVIEW</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
              <div><div className="muted" style={{ fontSize: 12 }}>Estimated recipient amount</div><div style={{ fontSize: 24, fontWeight: 750, marginTop: 5 }}>{String(quoteDetails.amountOutFormatted ?? quoteDetails.amountOut ?? "—")} <span style={{ fontSize: 13, color: "var(--muted)" }}>{destination?.symbol || ""}</span></div></div>
              <div><div className="muted" style={{ fontSize: 12 }}>Estimated time</div><div style={{ fontSize: 24, fontWeight: 750, marginTop: 5 }}>{typeof quoteDetails.timeEstimate === "number" ? `${Math.ceil(quoteDetails.timeEstimate / 60)} min` : "—"}</div></div>
            </div>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, margin: "14px 0 0" }}>This is an indicative quote only. It does not create a deposit address or initiate a payment. Final execution requires a separate confirmation step.</p>
          </div>
        ) : null}
      </section>

      <footer className="muted" style={{ maxWidth: 760, margin: "22px auto 0", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
        <span>ROMBUS · Move value. Without boundaries.</span>
        <span>Non-custodial by design · Powered by NEAR Intents</span>
      </footer>
    </main>
  );
}
