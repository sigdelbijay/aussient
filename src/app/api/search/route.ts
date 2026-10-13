import { NextResponse, type NextRequest } from "next/server";
import { searchSuggestions } from "@/lib/catalog";

/** As-you-type suggestions for the header search box: up to 5 products. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const results = await searchSuggestions(q);
  return NextResponse.json(
    { results },
    // Let browsers/CDN reuse identical queries briefly.
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
