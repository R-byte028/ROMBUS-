import { getAddress, isAddress } from "ethers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SiweMessage } from "siwe";
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
    const siwe = new SiweMessage(parsed.data.message);
    if (getAddress(siwe.address) !== address || siwe.nonce !== parsed.data.nonce || siwe.version !== "1") {
      return NextResponse.json({ error: "The signed message does not match this wallet request." }, { status: 401 });
    }

    const admin = createAdminClient();
    const now = new Date();
    const { data: challenge, error: challengeError } = await admin
      .from("wallet_auth_challenges")
      .select("id, wallet_address, chain_id, nonce, domain, uri, purpose, expires_at, consumed_at, created_at")
      .eq("nonce", parsed.data.nonce)
      .eq("wallet_address", address.toLowerCase())
      .is("consumed_at", null)
      .gt("expires_at", now.toISOString())
      .maybeSingle();

    if (challengeError || !challenge) return NextResponse.json({ error: "This wallet request has expired or was already used. Try again." }, { status: 401 });

    if (
      siwe.domain !== challenge.domain ||
      siwe.uri !== challenge.uri ||
      siwe.chainId !== Number(challenge.chain_id) ||
      siwe.statement !== (challenge.purpose === "link"
        ? "Link this wallet to your ROMBUS merchant account. This signature does not move funds."
        : "Sign in to ROMBUS. This signature does not move funds.")
    ) {
      return NextResponse.json({ error: "The signed message does not match the expected ROMBUS request." }, { status: 401 });
    }

    const issuedAt = siwe.issuedAt ? new Date(siwe.issuedAt).getTime() : 0;
    const expiresAt = siwe.expirationTime ? new Date(siwe.expirationTime).getTime() : 0;
    if (!issuedAt || issuedAt < new Date(challenge.created_at).getTime() - 30_000 ||
        issuedAt > now.getTime() + 30_000 || !expiresAt ||
        expiresAt > new Date(challenge.expires_at).getTime() + 1000 ||
        expiresAt <= now.getTime()) {
      return NextResponse.json({ error: "The signed message is outside its valid time window." }, { status: 401 });
    }

    const verification = await siwe.verify({
      signature: parsed.data.signature,
      domain: challenge.domain,
      nonce: challenge.nonce,
      time: now.toISOString(),
    }, { suppressExceptions: true });

    if (!verification.success) return NextResponse.json({ error: "Wallet signature could not be verified." }, { status: 401 });

    // Consume the nonce atomically. A second request with the same signature cannot create another session.
    const { data: consumed, error: consumeError } = await admin
      .from("wallet_auth_challenges")
      .update({ consumed_at: now.toISOString() })
      .eq("id", challenge.id)
      .is("consumed_at", null)
      .gt("expires_at", now.toISOString())
      .select("id")
      .maybeSingle();

    if (consumeError || !consumed) return NextResponse.json({ error: "This wallet request has already been used. Try again." }, { status: 401 });

    const supabase = await createClient();

    if (challenge.purpose === "link") {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return NextResponse.json({ error: "Your session expired. Sign in again before linking a wallet." }, { status: 401 });

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
        const { data: generatedUser, error: recoverError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
        if (recoverError || !generatedUser.user) throw new Error("Could not create or recover the wallet account.");
        userId = generatedUser.user.id;
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
    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (generateError || !generated.properties?.hashed_token) {
      console.error("Wallet session link generation failed:", generateError?.message);
      return NextResponse.json({ error: "Wallet verified, but a session could not be created. Please try again." }, { status: 500 });
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: generated.properties.hashed_token,
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
