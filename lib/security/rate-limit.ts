import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

/**
 * Enforces a shared, database-backed fixed-window limit.
 * Uses Vercel's edge-provided x-real-ip and a keyed HMAC digest; raw IPs are not persisted.
 */
export async function enforceApiRateLimit(
  request: Request | NextRequest,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  // Vercel sets x-real-ip at the edge. Do not trust client-controlled forwarding headers.
  const ip = request.headers.get("x-real-ip")?.trim();

  if (!ip) {
    return NextResponse.json(
      { error: "Request could not be safely rate-limited. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const hashSecret = process.env.SUPABASE_SECRET_KEY;
  if (!hashSecret) {
    return NextResponse.json(
      { error: "Request protection is temporarily unavailable. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const keyHash = createHmac("sha256", hashSecret)
    .update("rombus-api-rate-limit:v1:")
    .update(options.scope)
    .update(":")
    .update(ip)
    .digest("hex");

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_api_rate_limit", {
      p_key_hash: keyHash,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });

    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || typeof result.allowed !== "boolean") {
      console.error("[api-rate-limit] enforcement failed", error?.message);
      return NextResponse.json(
        { error: "Request protection is temporarily unavailable. Please try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (result.allowed) return null;

    const retryAfter = Math.max(1, Number(result.retry_after_seconds) || options.windowSeconds);
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(options.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  } catch (error) {
    console.error("[api-rate-limit] enforcement unavailable", error);
    return NextResponse.json(
      { error: "Request protection is temporarily unavailable. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
