import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import PaymentRequestForm from "./payment-request-form";
import WalletLogin from "@/components/wallet-login";

export const dynamic = "force-dynamic";

type Token = { assetId: string; symbol?: string; name?: string; decimals?: number; blockchain?: string };

async function getTokens(): Promise<Token[]> {
  try {
    const response = await fetch("https://1click.chaindefuser.com/v0/tokens", { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    const list = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { tokens?: unknown }).tokens) ? (payload as { tokens: unknown[] }).tokens : [];
    return list.filter((item): item is Token => !!item && typeof item === "object" && typeof (item as Token).assetId === "string" && Number.isInteger((item as Token).decimals));
  } catch { return []; }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login");

  const [{ data: profile }, { data: requests }, tokens] = await Promise.all([
    supabase.from("merchant_profiles").select("business_name, display_name, wallet_address").eq("id", authData.user.id).maybeSingle(),
    supabase.from("payment_requests").select("id, public_id, title, amount_atomic, destination_symbol, destination_chain, status, expires_at, created_at").eq("merchant_id", authData.user.id).order("created_at", { ascending: false }).limit(20),
    getTokens(),
  ]);

  const name = profile?.business_name || profile?.display_name || authData.user.email || "Merchant";
  const errors: Record<string, string> = {
    invalid: "Check the request details and try again.",
    assets: "Supported assets are temporarily unavailable. Please try again.",
    asset: "That receiving asset is no longer supported. Refresh and choose another.",
    amount: "Enter a positive amount using the selected asset's supported decimal precision.",
    profile: "We couldn't prepare your merchant profile. Please try again.",
    create: "The payment request could not be saved. Please try again.",
  };

  return (
    <main className="shell dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/">ROMBUS<span>.</span></Link>
        <div className="account-area"><span className="muted">{profile?.wallet_address ? `Wallet ${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}` : authData.user.email}</span>{!profile?.wallet_address ? <WalletLogin purpose="link" compact /> : null}<form action={signOut}><button className="quiet-button" type="submit">Sign out</button></form></div>
      </header>

      <section className="dashboard-intro">
        <p className="eyebrow">MERCHANT WORKSPACE</p>
        <h1>Good to see you, {name}.</h1>
        <p className="muted">Create a payment request and share a single link with your customer.</p>
      </section>

      {params.error && errors[params.error] ? <p className="error notice-panel" role="alert">{errors[params.error]}</p> : null}
      {params.created ? <div className="notice-panel"><strong>Payment request saved.</strong><p className="muted">Share this payment link:</p><code>{`${process.env.NEXT_PUBLIC_APP_URL || "https://your-rombus-domain"}/checkout/${params.created}`}</code><p className="muted fine-print">Customers can preview a quote, confirm, and receive deposit instructions. A request is marked paid only after NEAR Intents confirms settlement.</p></div> : null}

      <div className="dashboard-grid">
        <section className="panel dashboard-card">
          <div className="section-heading"><div><p className="eyebrow">NEW REQUEST</p><h2>Create a payment link</h2></div></div>
          {tokens.length ? <PaymentRequestForm tokens={tokens} /> : <p className="muted">Could not load supported assets. Refresh this page to try again.</p>}
        </section>
        <section className="panel dashboard-card">
          <div className="section-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Recent requests</h2></div><span className="count-pill">{requests?.length ?? 0}</span></div>
          {requests?.length ? <div className="request-list">{requests.map((request) => (
            <article className="request-row" key={request.id}>
              <div><strong>{request.title}</strong><p className="muted">{request.destination_symbol || "Asset"}{request.destination_chain ? ` · ${request.destination_chain}` : ""} · {new Date(request.created_at).toLocaleDateString()}</p><a href={`/checkout/${request.public_id}`}>View payment link</a></div>
              <span className={`status status-${request.status}`}>{request.status}</span>
            </article>
          ))}</div> : <p className="muted empty-state">No payment requests yet. Create your first one to get started.</p>}
        </section>
      </div>
      <footer className="muted fine-print dashboard-footer">ROMBUS · Non-custodial by design · Payments are not executed from this dashboard.</footer>
    </main>
  );
}
