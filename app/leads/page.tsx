import { Suspense } from "react";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { hasDatabase } from "@/lib/db/client";
import { leadFilterSchema, leadStatusCounts, listLeads } from "@/lib/db/leads";
import { LEAD_STATUSES } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Leads pipeline list with filters. */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = leadFilterSchema.safeParse(flat);
  const filters = parsed.success ? parsed.data : leadFilterSchema.parse({});

  if (!hasDatabase()) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          DATABASE_URL is not configured, so the CRM cannot store leads. Set it and run{" "}
          <code>npm run db:migrate</code>.
        </p>
      </div>
    );
  }

  const [leads, counts] = await Promise.all([listLeads(filters), leadStatusCounts()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-[var(--muted)]">
            {total} total · {LEAD_STATUSES.map((s) => `${counts[s]} ${s}`).join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
        <Suspense fallback={null}>
          <LeadFilters />
        </Suspense>
        {!parsed.success && (
          <p className="mt-2 text-xs text-red-700">Some filters were invalid and ignored.</p>
        )}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs text-[var(--muted)]">
          {leads.length} lead{leads.length === 1 ? "" : "s"} shown
          {filters.lat !== undefined ? ", nearest first" : ", newest first"}.
        </p>
        <LeadsTable leads={leads} />
      </div>
    </div>
  );
}
