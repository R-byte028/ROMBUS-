import Link from "next/link";
import { signUp } from "@/app/auth/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell auth-shell">
      <a className="brand" href="/">ROMBUS<span>.</span></a>
      <section className="panel auth-panel">
        <p className="eyebrow">START ACCEPTING CROSS-CHAIN PAYMENTS</p>
        <h1>Create your merchant account.</h1>
        <p className="muted">Set up your workspace to create payment links.</p>
        {params.error ? <p className="error" role="alert">{params.error === "invalid" ? "Check your business name, email and password. Passwords must be at least 8 characters." : "We couldn't create your account. The email may already be registered."}</p> : null}
        <form action={signUp} className="stack">
          <label>Business or display name<input className="field" type="text" name="businessName" autoComplete="organization" required minLength={2} maxLength={120} /></label>
          <label>Email address<input className="field" type="email" name="email" autoComplete="email" required maxLength={254} /></label>
          <label>Password<input className="field" type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
          <button className="primary" type="submit">Create account</button>
        </form>
        <p className="muted auth-foot">Already registered? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
