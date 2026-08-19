import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { MODULES } from "../../../lib/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scenario: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer", enum: [0, 1, 2, 3] },
          rationale: { type: "string" },
        },
        required: ["scenario", "options", "correct_index", "rationale"],
      },
    },
  },
  required: ["questions"],
};

const SYSTEM_PROMPT = `You are an experienced item writer for the ASCM CSCP (Certified Supply Chain Professional) exam. You write realistic, scenario-based multiple-choice practice questions.

Match the real exam's style:
- Each question is a short applied SCENARIO (1-3 sentences describing a situation), then asks what to do / which concept applies / what the result is. Test judgment and application, NOT rote recall of a definition.
- Exactly 4 options. One is clearly the best answer; the other three are plausible distractors a student with shallow understanding would pick (common misconceptions, right concept applied wrongly, close-but-incomplete).
- Vary which position (0-3) holds the correct answer across the set.
- "rationale": explain why the correct option is right AND briefly why each of the other three is wrong. This is the teaching payload.
- Keep options mutually exclusive and similar in length/specificity so the answer isn't obvious from format.
- Calibrate difficulty to the actual CSCP exam. Ground the questions in the provided study material when given; otherwise cover the core testable content of the stated module/area.`;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Not configured — ANTHROPIC_API_KEY is not set." }, { status: 500 });

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return Response.json({ error: "Your session has expired — sign in again." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const module = MODULES.find((m) => m.id === body?.moduleId);
  if (!module) return Response.json({ error: "Pick a module." }, { status: 400 });
  const functionalArea = typeof body?.functionalArea === "string" ? body.functionalArea : "";
  const count = Math.max(3, Math.min(12, parseInt(body?.count) || 8));
  const groundCards = Array.isArray(body?.cards) ? body.cards.slice(0, 40) : [];

  const scope = `Module ${module.id}: ${module.title}${functionalArea ? `\nFunctional area: ${functionalArea}` : ""}`;
  const material = groundCards.length
    ? "Study material the student has been learning (base the questions on this where possible):\n" +
      groundCards.map((c, i) => `${i + 1}. Q: ${String(c.front).slice(0, 300)} | A: ${String(c.back).slice(0, 300)}`).join("\n")
    : "No specific study material provided — cover the core testable content of this area.";

  const userPrompt = `Write ${count} CSCP scenario practice questions for:\n${scope}\n\n${material}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 12000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: QUIZ_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Claude declined to generate this quiz." }, { status: 422 });
    }
    const textBlock = response.content.find((b) => b.type === "text" && b.text.trim());
    if (!textBlock) return Response.json({ error: "No questions returned. Try again." }, { status: 502 });

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return Response.json({ error: "Couldn't parse the quiz. Try again." }, { status: 502 });
    }

    const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
      .filter(
        (q) =>
          q && typeof q.scenario === "string" &&
          Array.isArray(q.options) && q.options.length >= 2 &&
          Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length &&
          typeof q.rationale === "string",
      )
      .map((q) => ({
        scenario: q.scenario.trim(),
        options: q.options.slice(0, 4).map((o) => String(o).trim()),
        correct_index: q.correct_index,
        rationale: q.rationale.trim(),
      }))
      .filter((q) => q.correct_index < q.options.length);

    if (questions.length === 0) return Response.json({ error: "No usable questions. Try again." }, { status: 502 });

    return Response.json({ questions });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    const message = err?.status === 429 ? "Rate limited — wait a moment." : "Something went wrong. Try again.";
    return Response.json({ error: message }, { status });
  }
}
