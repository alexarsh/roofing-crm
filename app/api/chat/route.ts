import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { hasAnthropicKey } from "@/lib/config/env";
import { getAgentModel } from "@/lib/agent/model";
import { productionAgentTools } from "@/lib/agent/runtime";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/chat - Vercel AI SDK UI-message stream for the RAG assistant. */
export async function POST(req: Request) {
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured; the assistant is disabled." },
      { status: 503 },
    );
  }
  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const result = streamText({
    model: getAgentModel(),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages.slice(-20)),
    tools: productionAgentTools(),
    stopWhen: stepCountIs(10),
    onError: ({ error }) => console.error("assistant error", error),
  });
  return result.toUIMessageStreamResponse({
    onError: (error) => (error instanceof Error ? error.message : "The assistant failed"),
  });
}
