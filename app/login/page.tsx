import Link from "next/link";
import { signIn } from "@/app/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; checkEmail?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell auth-shell">
      <a className="brand" href="/">ROMBUS<span>.</span></a>
      <section className="panel auth-panel">
        <p className="eyebrow">MERCHANT ACCESS</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to manage your payment requests.</p>
        {params.checkEmail ? <p className="notice">Check your email and confirm your account, then sign in.</p> : null}
        {params.error ? <p className="error" role="alert">{params.error === "confirmation" ? "That confirmation link could not be verified. Try signing in again or request a new link." : params.error === "invalid" ? "Enter a valid email and a password of at least 8 characters." : "Email or password is incorrect. Please try again."}</p> : null}
        <form action={signIn} className="stack">
          <label>Email address<input className="field" type="email" name="email" autoComplete="email" required maxLength={254} /></label>
          <label>Password<input className="field" type="password" name="password" autoComplete="current-password" required minLength={8} maxLength={128} /></label>
          <button className="primary" type="submit">Sign in</button>
        </form>
        <p className="muted auth-foot">New to ROMBUS? <Link href="/signup">Create a merchant account</Link></p>
      </section>
    </main>
  );
}
