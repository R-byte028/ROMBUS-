import { enforceApiRateLimit } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNearIntentsHeaders } from "@/lib/checkout";

export const runtime = "nodejs";

const terminal = new Set(["completed", "incomplete_deposit", "expired", "failed", "refunded"]);
const allowed = new Set(["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS", "INCOMPLETE_DEPOSIT", "REFUNDED", "FAILED", "EXPIRED"]);

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const rateLimitResponse = await enforceApiRateLimit(_request, { scope: "checkout-status", limit: 30, windowSeconds: 60 });
  if (rateLimitResponse) return rateLimitResponse;

  if (!z.string().uuid().safeParse(attemptId).success) return NextResponse.json({ error: "Invalid payment attempt." }, { status: 400 });

  let admin;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "Payment status service is not configured." }, { status: 503 }); }

  const { data: rows, error: readError } = await admin.rpc("get_public_payment_attempt", { p_attempt_id: attemptId });
  const attempt = Array.isArray(rows) ? rows[0] : null;
  if (readError || !attempt) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });

  if (terminal.has(attempt.status) || !attempt.deposit_address) {
    return NextResponse.json({ status: attempt.status, providerStatus: attempt.provider_status }, { headers: { "Cache-Control": "no-store" } });
  }

  const query = new URLSearchParams({ depositAddress: attempt.deposit_address });
  if (attempt.deposit_memo) query.set("depositMemo", attempt.deposit_memo);

  try {
    const response = await fetch("https://1click.chaindefuser.com/v0/status?" + query.toString(), {
      headers: getNearIntentsHeaders(),
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object" || typeof (data as { status?: unknown }).status !== "string") {
      return NextResponse.json({ status: attempt.status, providerStatus: attempt.provider_status, refreshing: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const providerStatus = (data as { status: string }).status;
    if (!allowed.has(providerStatus)) {
      return NextResponse.json({ status: attempt.status, providerStatus: attempt.provider_status, refreshing: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: updated, error: updateError } = await admin.rpc("apply_public_payment_status", {
      p_attempt_id: attemptId,
      p_provider_status: providerStatus,
      p_provider_response: data as Record<string, unknown>,
    });
    if (updateError) return NextResponse.json({ status: attempt.status, providerStatus: attempt.provider_status, refreshing: true }, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({
      status: typeof updated === "string" ? updated : attempt.status,
      providerStatus,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: attempt.status, providerStatus: attempt.provider_status, refreshing: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
