import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const quoteSchema = z.object({
  swapType: z.enum(["EXACT_INPUT", "EXACT_OUTPUT"]),
  originAsset: z.string().min(1).max(300),
  destinationAsset: z.string().min(1).max(300),
  // Atomic units are interpreted according to swapType:
  // EXACT_INPUT uses the source asset; EXACT_OUTPUT uses the destination asset.
  // Keep the value as a digit-only string to avoid JavaScript number precision loss.
  amount: z.string().regex(/^\d+$/).max(100),
  recipient: z.string().min(2).max(200),
  refundTo: z.string().min(2).max(200),
  slippageTolerance: z.number().int().min(0).max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const jwt = process.env.NEAR_INTENTS_JWT;
  if (!jwt) return NextResponse.json({ error: "NEAR Intents credentials are not configured on the server yet." }, { status: 503 });

  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Please check the quote details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const response = await fetch("https://1click.chaindefuser.com/v0/quote", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: "Bearer " + jwt },
      body: JSON.stringify({
        ...parsed.data,
        slippageTolerance: parsed.data.slippageTolerance ?? 100,
        depositType: "ORIGIN_CHAIN",
        refundType: "ORIGIN_CHAIN",
        recipientType: "DESTINATION_CHAIN",
        deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        dry: true,
      }),
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json(
      { error: "The quote provider rejected this request. Check the asset pair and wallet addresses.", providerStatus: response.status },
      { status: response.status >= 400 && response.status < 500 ? 422 : 502 },
    );
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The quote service could not be reached. Please try again." }, { status: 502 });
  }
}
