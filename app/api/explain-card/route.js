import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert tutor for the ASCM CSCP (Certified Supply Chain Professional) exam, helping a student who is reviewing a flashcard.

Answer the student's request about the card clearly and concisely, with the CSCP exam in mind:
- Be accurate and exam-relevant. Emphasise what the exam tests and common ways it's assessed.
- When asked for an example, give a concrete, worked one (with small numbers for formulas).
- Keep it focused — a few short paragraphs or bullet points. Plain text only (no Markdown tables).
- Don't just restate the card; add the context, reasoning, or example the student asked for.`;

const MODE_PROMPTS = {
  context:
    "Give me more context and background on this concept — where it fits in the supply chain, why it matters, and what the CSCP exam expects me to know about it.",
  example:
    "Give me a concrete, worked example that illustrates this concept (use small numbers if it involves a formula).",
  simplify:
    "Explain this as simply and intuitively as possible, then add one line on why it matters for the exam.",
};

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Not configured — ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return Response.json({ error: "Your session has expired — sign in again." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const front = typeof body?.front === "string" ? body.front.trim() : "";
  const back = typeof body?.back === "string" ? body.back.trim() : "";
  if (!front || !back) {
    return Response.json({ error: "Missing card content." }, { status: 400 });
  }
  const mode = typeof body?.mode === "string" ? body.mode : "context";
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const context = [
    body?.moduleTitle ? `Module: ${body.moduleTitle}` : "",
    body?.functionalArea ? `Functional area: ${body.functionalArea}` : "",
    body?.topic ? `Topic: ${body.topic}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const ask = question || MODE_PROMPTS[mode] || MODE_PROMPTS.context;
  const userPrompt = `${context ? context + "\n\n" : ""}Flashcard —\nFront: ${front}\nBack: ${back}\n\nMy request: ${ask}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1500,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Claude declined to answer that." }, { status: 422 });
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return Response.json({ error: "No response. Try again." }, { status: 502 });

    return Response.json({ explanation: text });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    const message =
      err?.status === 429 ? "Rate limited — wait a moment." : "Something went wrong. Try again.";
    return Response.json({ error: message }, { status });
  }
}
