"use client";

import { createPaymentRequest } from "./actions";

type Token = {
  assetId: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  blockchain?: string;
};

export default function PaymentRequestForm({ tokens }: { tokens: Token[] }) {
  return (
    <form action={createPaymentRequest} className="stack request-form">
      <div className="form-grid">
        <label>Request title<input className="field" name="title" placeholder="Website development invoice" required minLength={1} maxLength={120} /></label>
        <label>Amount to receive<input className="field" name="amount" type="text" inputMode="decimal" placeholder="25.00" required /></label>
      </div>
      <label>Receive asset
        <select className="field" name="destinationAssetId" required defaultValue="">
          <option value="" disabled>Select an asset</option>
          {tokens.map((token) => <option key={token.assetId} value={token.assetId}>{token.symbol || token.name || token.assetId}{token.blockchain ? ` · ${token.blockchain}` : ""}</option>)}
        </select>
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
