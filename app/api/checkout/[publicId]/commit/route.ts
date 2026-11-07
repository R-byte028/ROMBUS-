import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCheckoutRequest, getNearIntentsHeaders, getProviderTokens, getQuoteDeadline, isRecord } from "@/lib/checkout";

export const runtime = "nodejs";

const inputSchema = z.object({
  sourceAssetId: z.string().min(1).max(300),
  refundAddress: z.string().trim().min(2).max(200),
  confirmed: z.literal(true),
});

function formatAtomic(value: unknown, decimals: number): string | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const amount = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!z.string().uuid().safeParse(publicId).success) return NextResponse.json({ error: "Invalid payment link." }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Review the quote and explicitly confirm before continuing." }, { status: 400 });

  const payment = await getCheckoutRequest(publicId);
  if (!payment) return NextResponse.json({ error: "This payment request does not exist." }, { status: 404 });
  if (payment.status !== "open" || (payment.expires_at !== null && Date.parse(payment.expires_at) <= Date.now())) {
    return NextResponse.json({ error: "This payment request is no longer payable." }, { status: 409 });
  }

  let admin;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "Checkout is not fully configured yet. A server-only Supabase secret is required." }, { status: 503 }); }

  let tokens;
  try { tokens = await getProviderTokens(); }
  catch { return NextResponse.json({ error: "Supported assets are temporarily unavailable." }, { status: 502 }); }

  const source = tokens.find((token) => token.assetId === parsed.data.sourceAssetId);
  const destination = tokens.find((token) => token.assetId === payment.destination_asset_id);
  if (!source || !destination || !Number.isInteger(source.decimals) || !Number.isInteger(destination.decimals)) {
    return NextResponse.json({ error: "The selected asset pair is no longer supported." }, { status: 422 });
  }

  const { data: attemptId, error: createError } = await admin.rpc("create_public_payment_attempt", {
    p_public_id: publicId,
    p_source_asset_id: source.assetId,
    p_refund_address: parsed.data.refundAddress,
    p_payer_wallet_address: null,
  });
  if (createError || typeof attemptId !== "string") {
    const message = createError?.message.includes("payment_attempt_in_progress")
      ? "A payment attempt is already active for this request. Check its existing deposit instructions."
      : "This payment request cannot start a new attempt right now.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  try {
    const providerResponse = await fetch("https://1click.chaindefuser.com/v0/quote", {
      method: "POST",
      headers: getNearIntentsHeaders(),
      body: JSON.stringify({
        dry: false,
        swapType: "EXACT_OUTPUT",
        slippageTolerance: 100,
        depositType: "ORIGIN_CHAIN",
        refundType: "ORIGIN_CHAIN",
        recipientType: "DESTINATION_CHAIN",
        deadline: getQuoteDeadline(source),
        originAsset: source.assetId,
        destinationAsset: destination.assetId,
        amount: payment.amount_atomic,
        recipient: payment.recipient_address,
        refundTo: parsed.data.refundAddress,
      }),
      cache: "no-store",
    });

    const providerData: unknown = await providerResponse.json().catch(() => null);
    const root = isRecord(providerData) ? providerData : null;
    const quote = root && isRecord(root.quote) ? root.quote : null;
    const correlationId = root && typeof root.correlationId === "string" ? root.correlationId : null;
    const depositAddress = quote && typeof quote.depositAddress === "string" ? quote.depositAddress : null;
    const amountIn = quote && typeof quote.amountIn === "string" ? quote.amountIn : null;
    const amountOut = quote && typeof quote.amountOut === "string" ? quote.amountOut : null;
    const deadline = quote && typeof quote.deadline === "string" ? quote.deadline : quote && typeof quote.timeWhenInactive === "string" ? quote.timeWhenInactive : null;
    const deadlineDate = deadline ? new Date(deadline) : null;

    if (!providerResponse.ok || !quote || !correlationId || !depositAddress || !amountIn || !/^\d+$/.test(amountIn) || !amountOut || !/^\d+$/.test(amountOut) || !deadlineDate || Number.isNaN(deadlineDate.getTime())) {
      await admin.rpc("fail_public_payment_attempt", { p_attempt_id: attemptId, p_reason: "provider_quote_invalid_or_rejected" });
      return NextResponse.json({ error: "NEAR Intents could not prepare a valid deposit quote. No funds have been moved." }, { status: 502 });
    }

    const { data: stored, error: storeError } = await admin.rpc("store_public_payment_quote", {
      p_attempt_id: attemptId,
      p_provider_quote_id: correlationId,
      p_source_amount_atomic: amountIn,
      p_destination_amount_atomic: amountOut,
      p_deposit_address: depositAddress,
      p_deposit_memo: quote.depositMemo === null || typeof quote.depositMemo === "string" ? quote.depositMemo : null,
      p_provider_deadline: deadlineDate.toISOString(),
      p_provider_response: providerData as Record<string, unknown>,
    });

    if (storeError || stored !== true) {
      await admin.rpc("fail_public_payment_attempt", { p_attempt_id: attemptId, p_reason: "quote_persistence_failed" });
      return NextResponse.json({ error: "The deposit instructions could not be saved safely. Do not send funds to any address." }, { status: 502 });
    }

    return NextResponse.json({
      attemptId,
      sourceAssetId: source.assetId,
      depositAddress,
      depositMemo: typeof quote.depositMemo === "string" ? quote.depositMemo : null,
      amountInFormatted: typeof quote.amountInFormatted === "string" ? quote.amountInFormatted : formatAtomic(amountIn, source.decimals as number),
      amountOutFormatted: typeof quote.amountOutFormatted === "string" ? quote.amountOutFormatted : formatAtomic(amountOut, destination.decimals as number),
      minAmountInFormatted: formatAtomic(quote.minAmountIn, source.decimals as number),
      maxAmountInFormatted: formatAtomic(quote.maxAmountIn, source.decimals as number),
      deadline: deadlineDate.toISOString(),
      timeEstimate: typeof quote.timeEstimate === "number" ? quote.timeEstimate : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await admin.rpc("fail_public_payment_attempt", { p_attempt_id: attemptId, p_reason: "provider_request_failed" });
    return NextResponse.json({ error: "The quote service could not be reached. No funds have been moved." }, { status: 502 });
  }
}
