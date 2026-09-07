import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import { getPropertyDetail } from "@/lib/services/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/properties/:parcelId - property detail with permits (from MCP). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ parcelId: string }> }) {
  try {
    const { parcelId } = await ctx.params;
    const detail = await getPropertyDetail(decodeURIComponent(parcelId));
    if (!detail) return NextResponse.json({ error: "Property not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return jsonError(err);
  }
}
