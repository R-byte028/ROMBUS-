import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCheckoutRequest, getNearIntentsHeaders, getProviderTokens } from "@/lib/checkout";

export const runtime = "nodejs";

const inputSchema = z.object({
  sourceAssetId: z.string().min(1).max(300),
  refundAddress: z.string().trim().min(2).max(200),
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
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid source asset and refund address." }, { status: 400 });

  const payment = await getCheckoutRequest(publicId);
  if (!payment) return NextResponse.json({ error: "This payment request does not exist." }, { status: 404 });
  if (payment.status !== "open" || (payment.expires_at !== null && Date.parse(payment.expires_at) <= Date.now())) {
    return NextResponse.json({ error: "This payment request is no longer payable." }, { status: 409 });
  }

  try {
    const tokens = await getProviderTokens();
    const source = tokens.find((token) => token.assetId === parsed.data.sourceAssetId);
    const destination = tokens.find((token) => token.assetId === payment.destination_asset_id);
    if (!source || !destination || !Number.isInteger(source.decimals) || !Number.isInteger(destination.decimals)) {
      return NextResponse.json({ error: "The selected asset pair is no longer supported." }, { status: 422 });
    }

    const providerResponse = await fetch("https://1click.chaindefuser.com/v0/quote", {
      method: "POST",
      headers: getNearIntentsHeaders(),
      body: JSON.stringify({
        dry: true,
        swapType: "EXACT_OUTPUT",
        originAsset: source.assetId,
        destinationAsset: destination.assetId,
        // EXACT_OUTPUT amount is denominated in destination-asset atomic units.
        amount: payment.amount_atomic,
        recipient: payment.recipient_address,
        refundTo: parsed.data.refundAddress,
        slippageTolerance: 100,
      }),
      cache: "no-store",
    });

    const data: unknown = await providerResponse.json().catch(() => null);
    const root = data && typeof data === "object" ? data as Record<string, unknown> : null;
    const quote = root?.quote && typeof root.quote === "object" ? root.quote as Record<string, unknown> : null;
    if (!providerResponse.ok || !quote || typeof quote.amountInFormatted !== "string" || typeof quote.amountOutFormatted !== "string") {
      return NextResponse.json({ error: "NEAR Intents could not quote this asset pair or wallet address." }, { status: 422 });
    }

    return NextResponse.json({
      amountInFormatted: quote.amountInFormatted,
      amountOutFormatted: quote.amountOutFormatted,
      minAmountInFormatted: formatAtomic(quote.minAmountIn, source.decimals as number),
      maxAmountInFormatted: formatAtomic(quote.maxAmountIn, source.decimals as number),
      deadline: typeof quote.deadline === "string" ? quote.deadline : null,
      timeEstimate: typeof quote.timeEstimate === "number" ? quote.timeEstimate : null,
      sourceSymbol: source.symbol || source.name || "source asset",
      destinationSymbol: destination.symbol || destination.name || "destination asset",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The quote service is temporarily unavailable." }, { status: 502 });
  }
}
