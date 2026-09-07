import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, searchParamsToObject } from "@/lib/http";
import { leadFilterSchema, listLeads } from "@/lib/db/leads";
import { createLeadsFromParcels } from "@/lib/services/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/leads?status&roofAgeMin&permitStatus&openDaysMin&lat&lng&radiusMiles */
export async function GET(req: NextRequest) {
  try {
    const filters = leadFilterSchema.parse(searchParamsToObject(req.nextUrl.searchParams));
    return NextResponse.json({ leads: await listLeads(filters) });
  } catch (err) {
    return jsonError(err);
  }
}

const createSchema = z.object({ parcelIds: z.array(z.string().min(1).max(64)).min(1).max(100) });

/** POST /api/leads { parcelIds: string[] } - create leads from selected properties. */
export async function POST(req: NextRequest) {
  try {
    const { parcelIds } = createSchema.parse(await req.json());
    const result = await createLeadsFromParcels(parcelIds);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
