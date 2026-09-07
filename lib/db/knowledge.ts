import "server-only";
import { sql } from "drizzle-orm";
import { KNOWLEDGE_DOCS } from "@/lib/agent/knowledge-docs";
import { getDb, type Db } from "./client";
import { knowledgeChunks } from "./schema";

/**
 * Lexical (Postgres full-text) retrieval over the dataset documentation.
 *
 * @module db/knowledge
 */

/** One retrieved chunk with its rank. */
export interface KnowledgeHit {
  id: string;
  source: string;
  title: string;
  section: string;
  body: string;
  rank: number;
}

/** Upsert the bundled documentation chunks (idempotent). */
export async function seedKnowledge(db: Db = getDb()): Promise<number> {
  for (const doc of KNOWLEDGE_DOCS) {
    await db
      .insert(knowledgeChunks)
      .values({
        id: doc.id,
        source: doc.source,
        title: doc.title,
        section: doc.section,
        body: doc.body,
      })
      .onConflictDoUpdate({
        target: knowledgeChunks.id,
        set: {
          source: doc.source,
          title: doc.title,
          section: doc.section,
          body: doc.body,
          updatedAt: new Date(),
        },
      });
  }
  return KNOWLEDGE_DOCS.length;
}

let seeded: Promise<void> | null = null;

/** Seed once per process when the index is empty (keeps the demo self-healing). */
async function ensureSeeded(db: Db): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      const [row] = await db.select({ n: sql<number>`count(*)` }).from(knowledgeChunks);
      if (Number(row?.n ?? 0) < KNOWLEDGE_DOCS.length) await seedKnowledge(db);
    })().catch((err: unknown) => {
      seeded = null;
      throw err;
    });
  }
  return seeded;
}

/**
 * Rank chunks for a natural-language query using `websearch_to_tsquery` with a
 * `plainto_tsquery` fallback, returning the top `limit` hits.
 */
export async function searchKnowledge(
  query: string,
  limit = 4,
  db: Db = getDb(),
): Promise<KnowledgeHit[]> {
  await ensureSeeded(db);
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const rows = await db
    .select({
      id: knowledgeChunks.id,
      source: knowledgeChunks.source,
      title: knowledgeChunks.title,
      section: knowledgeChunks.section,
      body: knowledgeChunks.body,
      rank: sql<number>`ts_rank_cd(${knowledgeChunks.tsv}, websearch_to_tsquery('english', ${q}))`,
    })
    .from(knowledgeChunks)
    .where(sql`${knowledgeChunks.tsv} @@ websearch_to_tsquery('english', ${q})`)
    .orderBy(sql`ts_rank_cd(${knowledgeChunks.tsv}, websearch_to_tsquery('english', ${q})) DESC`)
    .limit(limit);
  if (rows.length > 0) return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
  // Fallback: OR the terms so partial matches still ground the answer.
  const orQuery = q
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .join(" | ");
  if (!orQuery) return [];
  const loose = await db
    .select({
      id: knowledgeChunks.id,
      source: knowledgeChunks.source,
      title: knowledgeChunks.title,
      section: knowledgeChunks.section,
      body: knowledgeChunks.body,
      rank: sql<number>`ts_rank_cd(${knowledgeChunks.tsv}, to_tsquery('english', ${orQuery}))`,
    })
    .from(knowledgeChunks)
    .where(sql`${knowledgeChunks.tsv} @@ to_tsquery('english', ${orQuery})`)
    .orderBy(sql`ts_rank_cd(${knowledgeChunks.tsv}, to_tsquery('english', ${orQuery})) DESC`)
    .limit(limit);
  return loose.map((r) => ({ ...r, rank: Number(r.rank) }));
}
