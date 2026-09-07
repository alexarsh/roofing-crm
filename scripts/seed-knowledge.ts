/**
 * Seed / refresh the assistant's knowledge index from `lib/agent/knowledge-docs.ts`.
 *
 * Usage: `npm run db:seed`
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { KNOWLEDGE_DOCS } from "../lib/agent/knowledge-docs";
import { knowledgeChunks } from "../lib/db/schema";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool });
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
  await pool.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
