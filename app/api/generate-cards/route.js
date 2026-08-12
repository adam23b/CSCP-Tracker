import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { MODULES } from "../../../lib/constants";

// Runs server-side only — the ANTHROPIC_API_KEY never reaches the browser.
export const runtime = "nodejs";
export const maxDuration = 60; // Web search + generation can take a while; give Vercel headroom.

// Module list + their official CSCP functional areas, for the prompt.
const MODULE_LIST = MODULES.map(
  (m) => `${m.id}. ${m.title}\n   Functional areas: ${m.areas.join("; ")}`,
).join("\n");

const areasFor = (id) => MODULES.find((m) => m.id === id)?.areas || [];

const CARDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    module_id: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8] },
    functional_area: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          front: { type: "string" },
          back: { type: "string" },
          topic: { type: "string" },
          exam_priority: { type: "string", enum: ["high", "medium", "low"] },
          priority_reason: { type: "string" },
        },
        required: ["front", "back", "topic", "exam_priority", "priority_reason"],
      },
    },
  },
  required: ["module_id", "functional_area", "cards"],
};

const SYSTEM_PROMPT = `You are an expert coach for the ASCM CSCP (Certified Supply Chain Professional) exam and an experienced spaced-repetition flashcard author. You turn a student's study material into flashcards.

YOUR PRIORITIES, IN ORDER:
1. Passing the CSCP exam. This is the overriding goal. Favour content that is testable on the CSCP exam over content that is merely interesting or comprehensive.
2. Durable understanding of the topic — as the means to (1), not a competing goal.

The 8 CSCP modules and their official study-guide functional areas (map the material to exactly one best-fit module, and to one functional area within that module):
${MODULE_LIST}

DETECT MODULE + FUNCTIONAL AREA + TOPIC AUTOMATICALLY:
- Infer the single best-fit module_id from the content.
- Set "functional_area" to the EXACT official functional-area name (copied verbatim from the list above for the chosen module) that best matches the material. Use one functional area for the whole set.
- Give every card a short "topic" tag (2-4 words) naming the specific subject within that functional area (e.g. "EOQ", "Safety stock", "Bullwhip effect", "Incoterms"). The topic is more granular than the functional area.

WRITE CARDS FOR RETENTION, NOT RECOGNITION — do not just copy sentences from the source:
- One idea per card (minimum-information principle). Split compound facts into separate cards.
- Front = an active-recall prompt that makes the student retrieve, not recognise. Prefer "why / when / which / how" and short scenario prompts over verbatim definitions, because the CSCP exam is scenario- and application-based.
- Write at least some cards as applied scenarios: a one-sentence situation, then "what should you do / which applies?"
- Include discrimination cards that contrast easily-confused concepts (X vs Y, and when each applies).
- For formulas: put the formula on the back, define every variable, and add a separate card with a small worked example or "when would you use it".
- Use a cloze/fill-in style for key formulas or definitions where it aids recall (e.g. front: "Safety stock buffers against variability in ___ and ___").
- Backs are concise and complete — the answer plus, where it helps memory, one short clause on WHY it matters or what it connects to (elaboration).
- Do not invent facts unsupported by the material. If the material is thin, produce fewer, higher-quality cards.

EXAM-PRIORITY FLAG (set "exam_priority" to "high" | "medium" | "low" for each card, with a one-line "priority_reason"):
- Base it on how heavily the topic is weighted and emphasised on the CSCP exam: the module's share of the exam, whether it's a core definition/formula/framework CSCP loves to test, and how often public CSCP study resources stress it.
- Use web_search once or twice to check how public CSCP study guides and prep resources weight or emphasise these domains, and let that inform the flag.
- NEVER search for, request, or reproduce actual or leaked exam questions ("braindumps"). Base priority on published exam-content weightings and study emphasis only.
- "high" = very likely to be tested / core testable concept; "medium" = supporting concept worth knowing; "low" = background or edge detail.

Aim for roughly 6-20 cards depending on how much testable substance the material contains.
Return your result using the required JSON format only.`;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The flashcard generator isn't configured yet — ANTHROPIC_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  // --- Verify the caller is a signed-in user (keeps this endpoint from being a free API key) ---
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
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

  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (notes.length < 20) {
    return Response.json({ error: "Paste a bit more text to generate cards from." }, { status: 400 });
  }
  const clipped = notes.slice(0, 24000);

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: {
        // "low" keeps latency safely under Vercel's 60s cap while still using web
        // search; Opus 5 stays strong at low effort. Bump to "medium" on Vercel Pro.
        effort: "low",
        format: { type: "json_schema", schema: CARDS_SCHEMA },
      },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Study material to turn into CSCP flashcards:\n\n${clipped}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json(
        { error: "Claude declined to generate cards from this text. Try different notes." },
        { status: 422 },
      );
    }

    // With web_search the response holds tool blocks too; the JSON is in the final text block.
    const textBlocks = response.content.filter((b) => b.type === "text" && b.text.trim());
    let parsed = null;
    for (let i = textBlocks.length - 1; i >= 0 && !parsed; i--) {
      try {
        parsed = JSON.parse(textBlocks[i].text);
      } catch {
        // Fall back to extracting the outermost JSON object from the text.
        const match = textBlocks[i].text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {
            /* keep looking */
          }
        }
      }
    }

    if (!parsed) {
      return Response.json({ error: "No cards were returned. Try again." }, { status: 502 });
    }

    const moduleId =
      Number.isInteger(parsed.module_id) && parsed.module_id >= 1 && parsed.module_id <= 8
        ? parsed.module_id
        : null;

    // Normalize functional_area to the official casing if it matches the module's list.
    let functionalArea = null;
    if (typeof parsed.functional_area === "string" && parsed.functional_area.trim()) {
      const raw = parsed.functional_area.trim();
      const official = areasFor(moduleId).find(
        (a) => a.toLowerCase() === raw.toLowerCase(),
      );
      functionalArea = official || raw;
    }

    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
          .map((c) => ({
            front: c.front.trim(),
            back: c.back.trim(),
            topic: typeof c.topic === "string" ? c.topic.trim() : "",
            exam_priority: ["high", "medium", "low"].includes(c.exam_priority)
              ? c.exam_priority
              : "medium",
            priority_reason: typeof c.priority_reason === "string" ? c.priority_reason.trim() : "",
          }))
          .filter((c) => c.front && c.back)
      : [];

    if (cards.length === 0) {
      return Response.json({ error: "No usable cards came back. Try different notes." }, { status: 502 });
    }

    return Response.json({ moduleId, functionalArea, cards });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    const message =
      err?.status === 429
        ? "Rate limited — wait a moment and try again."
        : "Something went wrong generating cards. Try again.";
    return Response.json({ error: message }, { status });
  }
}
