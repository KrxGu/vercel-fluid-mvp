import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "vercel";
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const upstream = await fetch(
    `${baseUrl}/api/mock-upstream?q=${encodeURIComponent(q)}&delay=200`,
    { cache: "no-store" }
  );
  const json = await upstream.json();

  return NextResponse.json({
    q,
    data: { source: "raw", json }
  });
}

