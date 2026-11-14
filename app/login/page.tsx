import Link from "next/link";
import WalletLogin from "@/components/wallet-login";

export default function LoginPage() {
  return (
    <main className="shell auth-shell">
      <Link className="brand" href="/">RIVA<span>.</span></Link>
      <section className="panel auth-panel">
        <p className="eyebrow">MERCHANT ACCESS</p>
        <h1>Your wallet is your key.</h1>
        <p className="muted">Connect your EVM wallet and sign a message to open your merchant workspace.</p>
        <WalletLogin />
        <p className="muted auth-foot">Already have an email-based RIVA account? <Link href="/legacy-login">Use legacy sign-in</Link> and link your wallet from the dashboard.</p>
      </section>
    </main>
  );
}
