import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { coalesced } from "@/lib/coalesce";

export const runtime = "nodejs";

function clampNumber(value: number, { min, max }: { min: number; max: number }) {
  return Math.min(Math.max(value, min), max);
}

function parseHeaderNumber(req: NextRequest, name: string) {
  const value = req.headers.get(name);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "vercel";
  const signature = crypto.createHash("sha1").update(`GET|/search|q=${q}`).digest("hex");
  
  console.log("[route] query:", q, "signature:", signature.substring(0, 12));

  const holdHint = parseHeaderNumber(req, "x-hold-ms");
  const ttlHint = parseHeaderNumber(req, "x-ttl-ms");

  const holdMs = holdHint ? clampNumber(holdHint, { min: 10, max: 200 }) : undefined;
  const ttlMs = ttlHint ? clampNumber(ttlHint, { min: 500, max: 15000 }) : undefined;

  const result = await coalesced(
    `demo:${signature}`,
    async () => {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
      const upstream = await fetch(
        `${baseUrl}/api/mock-upstream?q=${encodeURIComponent(q)}&delay=200`,
        { cache: "no-store" }
      );
      const json = await upstream.json();
      return json;
    },
    { holdMs, ttlMs }
  );

  return NextResponse.json({
    q,
    data: {
      source: result.role,  // Now correctly shows leader/follower/fallback
      ...result.data
    },
    meta: {
      holdMs: holdMs ?? 500,
      ttlMs: ttlMs ?? 8000
    }
  });
}

