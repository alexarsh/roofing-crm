import "server-only";
import { createLeads, type CreateLeadsResult } from "@/lib/db/leads";
import { creationSummary, toLeadPermits, toNewLead } from "@/lib/leads/mappers";
import type { McpDataSource } from "@/lib/mcp/types";
import { mcp } from "@/lib/mcp/client";
import { getPropertiesWithPermits } from "./search";

/**
 * Lead creation orchestration: fetch parcels + permits over MCP, map, persist.
 *
 * @module services/leads
 */

/** Create CRM leads for the given parcel ids. Unknown parcels are reported back. */
export async function createLeadsFromParcels(
  parcelIds: readonly string[],
  source: McpDataSource = mcp,
): Promise<CreateLeadsResult & { unknown: string[] }> {
  const found = await getPropertiesWithPermits(parcelIds, source);
  const foundIds = new Set(
    found.flatMap((f) => [f.property.parcelId, f.property.parcelNumber ?? ""]),
  );
  const unknown = parcelIds.filter((id) => !foundIds.has(id));
  const inputs = found.map(({ property, permits }) => {
    const lead = toNewLead(property);
    return {
      lead,
      permits: toLeadPermits(0, permits).map((row) => {
        const { leadId, ...rest } = row;
        void leadId;
        return rest;
      }),
      summary: creationSummary(property, permits.length),
    };
  });
  const result = await createLeads(inputs);
  return { ...result, unknown };
}
