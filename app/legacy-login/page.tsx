import Link from "next/link";
import { signIn } from "@/app/auth/actions";

export default async function LegacyLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; checkEmail?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell auth-shell">
      <Link className="brand" href="/">ROMBUS<span>.</span></Link>
      <section className="panel auth-panel">
        <p className="eyebrow">EXISTING MERCHANT ACCOUNT</p>
        <h1>Legacy sign-in.</h1>
        <p className="muted">Use this only for an account created before wallet sign-in. You can link a wallet after signing in.</p>
        {params.checkEmail ? <p className="notice">Check your email and confirm your account, then sign in.</p> : null}
        {params.error ? <p className="error" role="alert">{params.error === "confirmation" ? "That confirmation link could not be verified. Try signing in again or request a new link." : params.error === "invalid" ? "Enter a valid email and a password of at least 8 characters." : "Email or password is incorrect. Please try again."}</p> : null}
        <form action={signIn} className="stack">
          <label>Email address<input className="field" type="email" name="email" autoComplete="email" required maxLength={254} /></label>
          <label>Password<input className="field" type="password" name="password" autoComplete="current-password" required minLength={8} maxLength={128} /></label>
          <button className="primary" type="submit">Sign in</button>
        </form>
        <p className="muted auth-foot"><Link href="/login">Back to wallet sign-in</Link></p>
      </section>
    </main>
  );
}
