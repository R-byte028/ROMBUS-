import { randomBytes } from "node:crypto";
import { getAddress, isAddress } from "ethers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SiweMessage } from "siwe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowedWalletAuthHost } from "@/lib/auth/wallet";

const schema = z.object({
  address: z.string().refine(isAddress, "Invalid EVM wallet address"),
  chainId: z.number().int().positive().max(2_147_483_647),
  purpose: z.enum(["login", "link"]).default("login"),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid wallet details." }, { status: 400 });

    let linkedUserId: string | null = null;
    if (parsed.data.purpose === "link") {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return NextResponse.json({ error: "Sign in before linking a wallet." }, { status: 401 });
      linkedUserId = data.user.id;
    }

    const host = request.nextUrl.host;
    if (!isAllowedWalletAuthHost(host)) return NextResponse.json({ error: "Wallet sign-in is not enabled for this domain." }, { status: 400 });

    const address = getAddress(parsed.data.address);
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const uri = request.nextUrl.origin;
    const admin = createAdminClient();

    const { error } = await admin.from("wallet_auth_challenges").insert({
      wallet_address: address.toLowerCase(),
      chain_id: parsed.data.chainId,
      nonce,
      domain: host,
      uri,
      purpose: parsed.data.purpose,
      user_id: linkedUserId,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      console.error("Wallet challenge creation failed:", error.message);
      return NextResponse.json({ error: "Could not start wallet verification. Please try again." }, { status: 500 });
    }

    const message = new SiweMessage({
      domain: host,
      address,
      statement: parsed.data.purpose === "link"
        ? "Link this wallet to your ROMBUS merchant account. This signature does not move funds."
        : "Sign in to ROMBUS. This signature does not move funds.",
      uri,
      version: "1",
      chainId: parsed.data.chainId,
      nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: expiresAt.toISOString(),
    }).prepareMessage();

    return NextResponse.json({ message, nonce, expiresAt: expiresAt.toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Wallet nonce request failed:", error);
    return NextResponse.json({ error: "Could not start wallet verification." }, { status: 500 });
  }
}
