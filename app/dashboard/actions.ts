"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ProviderToken = {
  assetId: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  blockchain?: string;
};

const requestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  amount: z.string().regex(/^\\d+(?:\\.\\d+)?$/).max(120),
  destinationAssetId: z.string().min(1).max(300),
  recipientAddress: z.string().trim().min(2).max(200),
  expiry: z.enum(["never", "1", "24", "168"]),
});

function toAtomicAmount(value: string, decimals: number): string {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error("precision");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const atomic = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(padded || "0");
  if (atomic <= 0n || atomic.toString().length > 78) throw new Error("amount");
  return atomic.toString();
}

export async function createPaymentRequest(formData: FormData) {
  const parsed = requestSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    amount: formData.get("amount"),
    destinationAssetId: formData.get("destinationAssetId"),
    recipientAddress: formData.get("recipientAddress"),
    expiry: formData.get("expiry"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid");

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login");

  let token: ProviderToken | undefined;
  try {
    const tokenResponse = await fetch("https://1click.chaindefuser.com/v0/tokens", {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!tokenResponse.ok) redirect("/dashboard?error=assets");
    const payload: unknown = await tokenResponse.json();
    const list = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { tokens?: unknown }).tokens) ? (payload as { tokens: unknown[] }).tokens : [];
    token = list.find((item): item is ProviderToken => !!item && typeof item === "object" && (item as ProviderToken).assetId === parsed.data.destinationAssetId);
  } catch {
    redirect("/dashboard?error=assets");
  }

  if (!token || !Number.isInteger(token.decimals) || (token.decimals ?? -1) < 0 || (token.decimals ?? 100) > 36) {
    redirect("/dashboard?error=asset");
  }

  let amountAtomic: string;
  try {
    amountAtomic = toAtomicAmount(parsed.data.amount, token.decimals!);
  } catch {
    redirect("/dashboard?error=amount");
  }

  const businessName = String(authData.user.user_metadata?.business_name || authData.user.email || "ROMBUS merchant").slice(0, 120);
  const { error: profileError } = await supabase.from("merchant_profiles").upsert({
    id: authData.user.id,
    display_name: businessName,
    business_name: businessName,
  });
  if (profileError) redirect("/dashboard?error=profile");

  const expiresAt = parsed.data.expiry === "never"
    ? null
    : new Date(Date.now() + Number(parsed.data.expiry) * 60 * 60 * 1000).toISOString();

  const { data: created, error: insertError } = await supabase.from("payment_requests").insert({
    merchant_id: authData.user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    amount_atomic: amountAtomic,
    destination_asset_id: token.assetId,
    destination_symbol: token.symbol || token.name || null,
    destination_chain: token.blockchain || null,
    recipient_address: parsed.data.recipientAddress,
    expires_at: expiresAt,
    status: "open",
  }).select("id, public_id").single();

  if (insertError || !created) redirect("/dashboard?error=create");
  redirect(`/dashboard?created=${created.public_id}`);
}
