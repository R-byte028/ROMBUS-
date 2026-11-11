"use client";

import { useMemo, useState } from "react";
import { createPaymentRequest } from "./actions";

type Token = {
  assetId: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  blockchain?: string;
};

function networkLabel(blockchain?: string) {
  const value = (blockchain || "").trim().toLowerCase();
  if (value === "bsc" || value === "bnb smart chain" || value === "bnb chain") {
    return "BNB Smart Chain (BEP20)";
  }
  return blockchain || "Network not specified";
}

function tokenLabel(token: Token) {
  const asset = token.symbol || token.name || "Unknown asset";
  const name = token.name && token.name !== token.symbol ? ` · ${token.name}` : "";
  return `${asset}${name} · ${networkLabel(token.blockchain)}`;
}

export default function PaymentRequestForm({ tokens }: { tokens: Token[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const selectedToken = tokens.find((token) => token.assetId === selectedAssetId);
  const filteredTokens = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tokens;
    return tokens.filter((token) => {
      const searchable = [
        token.symbol,
        token.name,
        token.blockchain,
        networkLabel(token.blockchain),
        token.assetId,
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(query) || (query.includes("bep20") && networkLabel(token.blockchain).includes("BEP20"));
    });
  }, [tokens, search]);

  function chooseToken(token: Token) {
    setSelectedAssetId(token.assetId);
    setSearch("");
    setIsOpen(false);
  }

  return (
    <form action={createPaymentRequest} className="stack request-form">
      <div className="form-grid">
        <label>Request title<input className="field" name="title" placeholder="Website development invoice" required minLength={1} maxLength={120} /></label>
        <label>Amount to receive<input className="field" name="amount" type="text" inputMode="decimal" placeholder="25.00" required /></label>
      </div>
      <label className="asset-picker-label">Receive asset
        <input type="hidden" name="destinationAssetId" value={selectedAssetId} required />
        <button
          className="field asset-picker-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="asset-picker-options"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>{selectedToken ? tokenLabel(selectedToken) : "Select asset or network"}</span>
          <span aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
        </button>
        {isOpen ? (
          <div className="asset-picker-panel">
            <input
              className="field asset-picker-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search token, network, BSC or BEP20"
              aria-label="Search supported assets and networks"
              autoFocus
            />
            <div className="asset-picker-results" id="asset-picker-options" role="listbox" aria-label="Supported assets">
              {filteredTokens.length ? filteredTokens.map((token) => (
                <button
                  className={`asset-picker-option${token.assetId === selectedAssetId ? " is-selected" : ""}`}
                  key={token.assetId}
                  type="button"
                  role="option"
                  aria-selected={token.assetId === selectedAssetId}
                  onClick={() => chooseToken(token)}
                >
                  <strong>{token.symbol || token.name || "Unknown asset"}</strong>
                  <span>{token.name && token.name !== token.symbol ? token.name : networkLabel(token.blockchain)}</span>
                  <small>{networkLabel(token.blockchain)}</small>
                </button>
              )) : <p className="asset-picker-empty">No matching assets. Try another token or network name.</p>}
            </div>
          </div>
        ) : null}
        <span className="muted fine-print">Search by token name, network, BSC or BEP20. BNB Smart Chain is the BEP20 network.</span>
      </label>
      <label>Recipient wallet address<input className="field" name="recipientAddress" placeholder="Wallet address that should receive the funds" required minLength={2} maxLength={200} /></label>
      <label>Description <span className="muted">(optional)</span><textarea className="field" name="description" rows={3} maxLength={1000} placeholder="Add a short note for the payer." /></label>
      <label>Payment link expires
        <select className="field" name="expiry" defaultValue="24">
          <option value="1">In 1 hour</option>
          <option value="24">In 24 hours</option>
          <option value="168">In 7 days</option>
          <option value="never">Never</option>
        </select>
      </label>
      <button className="primary" type="submit">Create payment link</button>
      <p className="muted fine-print">Creating a request does not move funds or generate a deposit address. Checkout and payment execution will be a separate step.</p>
    </form>
  );
}
