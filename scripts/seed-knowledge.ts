/**
 * Seed / refresh the assistant's knowledge index from `lib/agent/knowledge-docs.ts`.
 *
 * Usage: `npm run db:seed`
 */
import { KNOWLEDGE_DOCS } from "../lib/agent/knowledge-docs";
import { getDb } from "../lib/db/client";
import { knowledgeChunks } from "../lib/db/schema";

async function main(): Promise<void> {
  // `getDb` picks the Neon HTTP driver for Neon URLs (works through networks that
  // block the Postgres port) and the `pg` pool for local Postgres.
  const db = getDb();
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
  console.log(`seeded ${KNOWLEDGE_DOCS.length} knowledge chunks`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
