import "server-only";
import { OSCEOLA } from "@/lib/config/county";
import { mcp } from "@/lib/mcp/client";
import type { McpDataSource } from "@/lib/mcp/types";
import {
  buildCandidateCountQuery,
  buildCandidateQuery,
  buildPropertiesByIdsQuery,
  buildPropertyByIdQuery,
  longOpenDays,
  type SearchParams,
  type SearchParamsInput,
} from "@/lib/queries/properties";
import { buildPermitsForParcelQuery, buildPermitsForParcelsQuery } from "@/lib/queries/permits";
import {
  mapPermitRow,
  mapPropertyRow,
  toNum,
  type PermitRecord,
  type PropertyCandidate,
} from "@/lib/queries/types";

/**
 * Read-side services over the MCP boundary: radius search, property detail and
 * multi-parcel fetches used by lead creation.
 *
 * @module services/search
 */

/** Result of a radius search: the capped rows plus uncapped totals. */
export interface SearchResult {
  params: SearchParams;
  rows: PropertyCandidate[];
  totals: {
    total: number;
    openPermits: number;
    longOpenPermits: number;
    agedRoofs: number;
    outOfStateOwners: number;
  };
  truncated: boolean;
  sql: { rows: string; count: string };
}

/** Run the radius lead search (two MCP calls: rows + counts). */
export async function searchCandidates(
  input: SearchParamsInput,
  source: McpDataSource = mcp,
): Promise<SearchResult> {
  const { sql, params } = buildCandidateQuery(input);
  const { sql: countSql } = buildCandidateCountQuery(input);
  const thresholds = { roofAgeYears: params.roofAgeMin, longOpenDays: longOpenDays(params) };
  const [rowsRes, countRes] = await Promise.all([
    source.queryProperties(sql, params.limit),
    source.queryProperties(countSql, 1),
  ]);
  const c = countRes.rows[0] ?? {};
  const totals = {
    total: toNum(c.total) ?? 0,
    openPermits: toNum(c.open_permits) ?? 0,
    longOpenPermits: toNum(c.long_open_permits) ?? 0,
    agedRoofs: toNum(c.aged_roofs) ?? 0,
    outOfStateOwners: toNum(c.out_of_state_owners) ?? 0,
  };
  const rows = rowsRes.rows.map((r) => mapPropertyRow(r, thresholds));
  return {
    params,
    rows,
    totals,
    truncated: totals.total > rows.length,
    sql: { rows: sql, count: countSql },
  };
}

/** Lead-signal thresholds used to classify a property (mirrors the map's filters). */
export interface SignalThresholds {
  roofAgeYears: number;
  longOpenDays: number;
}

/** County default thresholds. */
export const DEFAULT_THRESHOLDS: SignalThresholds = {
  roofAgeYears: OSCEOLA.thresholds.roofAgeYears,
  longOpenDays: OSCEOLA.thresholds.longOpenPermitYears * 365,
};

/**
 * Property detail with its permits. Returns `null` when the parcel is unknown.
 * Pass the user's current thresholds so the drawer's signal badge matches the list.
 */
export async function getPropertyDetail(
  parcelId: string,
  source: McpDataSource = mcp,
  thresholds: SignalThresholds = DEFAULT_THRESHOLDS,
): Promise<{ property: PropertyCandidate; permits: PermitRecord[] } | null> {
  const res = await source.queryProperties(buildPropertyByIdQuery(parcelId), 1);
  const raw = res.rows[0];
  if (!raw) return null;
  const property = mapPropertyRow(raw, thresholds);
  const permitsRes = await source.queryPermits(
    buildPermitsForParcelQuery(property.parcelNumber ?? property.parcelId),
    200,
  );
  return { property, permits: permitsRes.rows.map(mapPermitRow) };
}

/** Fetch many properties and their roofing permits (lead creation). */
export async function getPropertiesWithPermits(
  parcelIds: readonly string[],
  source: McpDataSource = mcp,
): Promise<Array<{ property: PropertyCandidate; permits: PermitRecord[] }>> {
  const unique = [...new Set(parcelIds)];
  if (unique.length === 0) return [];
  const thresholds = {
    roofAgeYears: OSCEOLA.thresholds.roofAgeYears,
    longOpenDays: OSCEOLA.thresholds.longOpenPermitYears * 365,
  };
  const props = (
    await source.queryProperties(buildPropertiesByIdsQuery(unique), unique.length)
  ).rows.map((r) => mapPropertyRow(r, thresholds));
  if (props.length === 0) return [];
  const parcelNumbers = props.map((p) => p.parcelNumber ?? p.parcelId);
  const permits = (
    await source.queryPermits(buildPermitsForParcelsQuery(parcelNumbers, true), 1000)
  ).rows.map(mapPermitRow);
  const byParcel = new Map<string, PermitRecord[]>();
  for (const pr of permits) {
    const key = pr.parcelNumber ?? "";
    byParcel.set(key, [...(byParcel.get(key) ?? []), pr]);
  }
  return props.map((property) => ({
    property,
    permits: byParcel.get(property.parcelNumber ?? property.parcelId) ?? [],
  }));
}
