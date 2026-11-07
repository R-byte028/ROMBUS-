import Link from "next/link";
import { notFound } from "next/navigation";
import { getCheckoutRequest, getProviderTokens } from "@/lib/checkout";
import CheckoutForm from "./checkout-form";

export const dynamic = "force-dynamic";

function formatAtomic(value: string, decimals: number) {
  const amount = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}

export default async function CheckoutPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicId)) notFound();

  const payment = await getCheckoutRequest(publicId);
  if (!payment) notFound();

  let tokens = [];
  try { tokens = await getProviderTokens(); } catch { tokens = []; }
  const destination = tokens.find((token) => token.assetId === payment.destination_asset_id);
  const amount = destination && Number.isInteger(destination.decimals)
    ? formatAtomic(payment.amount_atomic, destination.decimals as number)
    : payment.amount_atomic;

  return (
    <main className="shell checkout-shell">
      <header className="checkout-header">
        <Link className="brand" href="/">ROMBUS<span>.</span></Link>
        <span className="muted checkout-secure">SECURE CHECKOUT</span>
      </header>
      <section className="checkout-layout">
        <div className="panel checkout-summary">
          <p className="eyebrow">PAYMENT REQUEST</p>
          <h1>{payment.title}</h1>
          {payment.description ? <p className="muted checkout-description">{payment.description}</p> : null}
          <div className="checkout-amount-label muted">Recipient receives</div>
          <div className="checkout-amount">{amount}<span>{payment.destination_symbol || destination?.symbol || "tokens"}</span></div>
          <div className="checkout-meta">
            <div><span className="muted">Network</span><strong>{payment.destination_chain || destination?.blockchain || "Supported network"}</strong></div>
            <div><span className="muted">Merchant</span><strong>{payment.merchant_name}</strong></div>
          </div>
          <p className="muted fine-print checkout-note">ROMBUS routes the payment to the merchant's requested asset and wallet. Your wallet remains under your control.</p>
        </div>
        <section className="panel checkout-payment">
          <div className="section-heading"><div><p className="eyebrow">PAY ACROSS CHAINS</p><h2>Choose how to pay</h2></div></div>
          {tokens.length
            ? <CheckoutForm publicId={publicId} tokens={tokens} destinationSymbol={payment.destination_symbol || destination?.symbol || "tokens"} />
            : <p className="error">Supported assets are temporarily unavailable. Refresh this page to try again.</p>}
        </section>
      </section>
      <footer className="muted fine-print checkout-footer">ROMBUS · Move value. Without boundaries. · Powered by NEAR Intents</footer>
    </main>
  );
}
