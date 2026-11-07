import { getAddress, isAddress, verifyMessage } from "ethers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { walletDisplayName, walletIdentityEmail } from "@/lib/auth/wallet";

const schema = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2000),
  address: z.string().refine(isAddress, "Invalid EVM wallet address"),
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid wallet verification request." }, { status: 400 });

    const address = getAddress(parsed.data.address);
    const admin = createAdminClient();
    const now = new Date();
    const { data: challenge, error: challengeError } = await admin
      .from("wallet_auth_challenges")
      .select("id, wallet_address, chain_id, nonce, domain, uri, purpose, user_id, message, expires_at, consumed_at")
      .eq("nonce", parsed.data.nonce)
      .eq("wallet_address", address.toLowerCase())
      .is("consumed_at", null)
      .gt("expires_at", now.toISOString())
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "This wallet request has expired or was already used. Try again." }, { status: 401 });
    }

    // The client must return the exact SIWE message issued by this server.
    // This binds the signature to the stored host, URI, address, chain, nonce and expiry.
    if (parsed.data.message !== challenge.message || challenge.nonce !== parsed.data.nonce) {
      return NextResponse.json({ error: "The signed message does not match the expected ROMBUS request." }, { status: 401 });
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = getAddress(verifyMessage(challenge.message, parsed.data.signature));
    } catch {
      return NextResponse.json({ error: "Wallet signature could not be verified." }, { status: 401 });
    }
    if (recoveredAddress.toLowerCase() !== challenge.wallet_address) {
      return NextResponse.json({ error: "Wallet signature does not match the requested address." }, { status: 401 });
    }

    // Consume the nonce atomically. A second request with the same signature cannot create another session.
    const { data: consumed, error: consumeError } = await admin
      .from("wallet_auth_challenges")
      .update({ consumed_at: now.toISOString() })
      .eq("id", challenge.id)
      .is("consumed_at", null)
      .gt("expires_at", now.toISOString())
      .select("id")
      .maybeSingle();

    if (consumeError || !consumed) {
      return NextResponse.json({ error: "This wallet request has already been used. Try again." }, { status: 401 });
    }

    const supabase = await createClient();

    if (challenge.purpose === "link") {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || challenge.user_id !== authData.user.id) {
        return NextResponse.json({ error: "Your merchant session changed or expired. Start wallet linking again." }, { status: 401 });
      }

      const { error: linkError } = await admin.from("merchant_profiles").upsert({
        id: authData.user.id,
        wallet_address: address.toLowerCase(),
        wallet_chain_id: Number(challenge.chain_id),
        display_name: authData.user.user_metadata?.business_name || walletDisplayName(address),
      });
      if (linkError) {
        if (linkError.code === "23505") return NextResponse.json({ error: "That wallet is already linked to another merchant account." }, { status: 409 });
        console.error("Wallet linking failed:", linkError.message);
        return NextResponse.json({ error: "Could not link this wallet. Please try again." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, linked: true });
    }

    // If this wallet was linked to an existing email account, authenticate that same merchant.
    const { data: existingProfile, error: profileLookupError } = await admin
      .from("merchant_profiles")
      .select("id")
      .eq("wallet_address", address.toLowerCase())
      .maybeSingle();
    if (profileLookupError) throw new Error("Could not look up the wallet account.");

    let email: string;
    let userId: string;
    let generatedLink: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["data"] | null = null;

    if (existingProfile?.id) {
      const { data: existingUser, error: existingUserError } = await admin.auth.admin.getUserById(existingProfile.id);
      if (existingUserError || !existingUser.user?.email) throw new Error("The linked merchant account could not be loaded.");
      email = existingUser.user.email;
      userId = existingUser.user.id;
    } else {
      email = walletIdentityEmail(address);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          auth_method: "wallet",
          wallet_address: address.toLowerCase(),
          business_name: walletDisplayName(address),
        },
      });

      if (!createError && created.user) {
        userId = created.user.id;
      } else {
        // A previous interrupted attempt may already have created this wallet identity.
        const recovered = await admin.auth.admin.generateLink({ type: "magiclink", email });
        if (recovered.error || !recovered.data.user) throw new Error("Could not create or recover the wallet account.");
        generatedLink = recovered.data;
        userId = recovered.data.user.id;
      }

      const { error: profileError } = await admin.from("merchant_profiles").upsert({
        id: userId,
        wallet_address: address.toLowerCase(),
        wallet_chain_id: Number(challenge.chain_id),
        display_name: walletDisplayName(address),
        business_name: walletDisplayName(address),
      });
      if (profileError) throw new Error("Could not create the merchant profile.");
    }

    // Generate and immediately consume a one-time link internally. No email is sent or required.
    if (!generatedLink) {
      const generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (generated.error) {
        console.error("Wallet session link generation failed:", generated.error.message);
        return NextResponse.json({ error: "Wallet verified, but a session could not be created. Please try again." }, { status: 500 });
      }
      generatedLink = generated.data;
    }

    const tokenHash = generatedLink.properties?.hashed_token;
    if (!tokenHash) return NextResponse.json({ error: "Wallet verified, but a session could not be created. Please try again." }, { status: 500 });

    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (sessionError || !sessionData.session || sessionData.user?.id !== userId) {
      console.error("Wallet session exchange failed:", sessionError?.message);
      return NextResponse.json({ error: "Wallet verified, but a session could not be created. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, linked: false, walletAddress: address }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Wallet verification failed:", error);
    return NextResponse.json({ error: "Wallet verification failed. Please request a new signature and try again." }, { status: 500 });
  }
}
