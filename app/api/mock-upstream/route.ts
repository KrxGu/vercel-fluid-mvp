import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Mock slow upstream API for testing
 * This simulates a slow external API without relying on httpbin.org
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "default";
  const delay = parseInt(url.searchParams.get("delay") ?? "200");
  
  // Simulate slow processing
  await new Promise(resolve => setTimeout(resolve, delay));
  
  return NextResponse.json({
    args: {
      query: q,
      delay: delay.toString()
    },
    headers: Object.fromEntries(req.headers.entries()),
    url: req.url,
    timestamp: new Date().toISOString(),
    mock: true
  });
}
