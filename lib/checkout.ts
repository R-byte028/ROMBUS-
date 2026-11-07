import { createClient } from "@/lib/supabase/server";

export type CheckoutRequest = {
  public_id: string;
  title: string;
  description: string | null;
  amount_atomic: string;
  destination_asset_id: string;
  destination_symbol: string | null;
  destination_chain: string | null;
  recipient_address: string;
  merchant_name: string;
  status: string;
  expires_at: string | null;
};

export type ActiveCheckoutAttempt = {
  id: string;
  status: string;
  provider_status: string | null;
  source_asset_id: string;
  source_amount_atomic: string;
  destination_amount_atomic: string;
  deposit_address: string;
  deposit_memo: string | null;
  provider_deadline: string;
};

export type ProviderToken = {
  assetId: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  blockchain?: string;
  icon?: string;
};

export async function getCheckoutRequest(publicId: string): Promise<CheckoutRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_payment_request", { p_public_id: publicId });
  if (error || !Array.isArray(data) || !data.length) return null;
  return data[0] as CheckoutRequest;
}

export async function getActiveCheckoutAttempt(publicId: string): Promise<ActiveCheckoutAttempt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_public_payment_attempt", { p_public_id: publicId });
  if (error || !Array.isArray(data) || !data.length) return null;
  return data[0] as ActiveCheckoutAttempt;
}

export async function getProviderTokens(): Promise<ProviderToken[]> {
  const response = await fetch("https://1click.chaindefuser.com/v0/tokens", {
    headers: { accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error("Asset catalogue unavailable.");
  const payload: unknown = await response.json();
  const list = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { tokens?: unknown }).tokens) ? (payload as { tokens: unknown[] }).tokens : [];
  return list.filter((item): item is ProviderToken => !!item && typeof item === "object" && typeof (item as ProviderToken).assetId === "string" && Number.isInteger((item as ProviderToken).decimals));
}

export function getNearIntentsHeaders() {
  const jwt = process.env.NEAR_INTENTS_JWT;
  if (!jwt) throw new Error("NEAR Intents credentials are not configured.");
  return { "content-type": "application/json", accept: "application/json", authorization: "Bearer " + jwt };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getQuoteDeadline(source: ProviderToken): string {
  const minutes = source.blockchain?.toLowerCase() === "btc" ? 120 : 60;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
