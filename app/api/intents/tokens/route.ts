import { NextResponse } from "next/server";

const API = "https://1click.chaindefuser.com";

export async function GET() {
  try {
    const response = await fetch(`${API}/v0/tokens`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Token discovery is temporarily unavailable." }, { status: 502 });
    }
    const data: unknown = await response.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the NEAR Intents token service." }, { status: 502 });
  }
}