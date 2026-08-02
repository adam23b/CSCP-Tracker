import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Runs server-side only — the ANTHROPIC_API_KEY never reaches the browser.
export const runtime = "nodejs";
export const maxDuration = 60; // Claude generation can take a while; give Vercel headroom.

const CARDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          front: { type: "string" },
          back: { type: "string" },
        },
        required: ["front", "back"],
      },
    },
  },
  required: ["cards"],
};

const SYSTEM_PROMPT = `You are an expert tutor for the ASCM CSCP (Certified Supply Chain Professional) exam, building spaced-repetition flashcards from a student's study notes.

Turn the notes into atomic question/answer flashcards optimised for durable retention and exam recall:
- One idea per card. Split compound facts into separate cards.
- The "front" is a clear question or prompt that forces active recall; the "back" is a concise, complete answer (usually one or two sentences, or a formula).
- Prioritise what the CSCP exam actually tests: key definitions, formulas and what each variable means, distinctions between similar concepts, decision criteria (when to use X vs Y), sequences/process steps, and cause-effect relationships.
- Prefer "why/when/how" and application prompts over trivia or rote wording, since the exam is scenario-based.
- For any formula, put the formula on the back and, where useful, add a separate card asking what it is used for.
- Do not invent facts that aren't supported by the notes. If the notes are thin, produce fewer, higher-quality cards rather than padding.
- Aim for roughly 5-20 cards depending on how much substance the notes contain.`;

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
  const moduleTitle = typeof body?.moduleTitle === "string" ? body.moduleTitle : "";
  if (notes.length < 20) {
    return Response.json({ error: "Paste a bit more text to generate cards from." }, { status: 400 });
  }
  // Guard against pathologically large pastes.
  const clipped = notes.slice(0, 24000);

  const userPrompt =
    `${moduleTitle ? `Module: ${moduleTitle}\n\n` : ""}Study notes:\n\n${clipped}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: CARDS_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json(
        { error: "Claude declined to generate cards from this text. Try different notes." },
        { status: 422 },
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return Response.json({ error: "No cards were returned. Try again." }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return Response.json({ error: "Couldn't parse the generated cards. Try again." }, { status: 502 });
    }

    const cards = Array.isArray(parsed?.cards)
      ? parsed.cards
          .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
          .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
          .filter((c) => c.front && c.back)
      : [];

    if (cards.length === 0) {
      return Response.json({ error: "No usable cards came back. Try different notes." }, { status: 502 });
    }

    return Response.json({ cards });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    const message =
      err?.status === 429
        ? "Rate limited — wait a moment and try again."
        : "Something went wrong generating cards. Try again.";
    return Response.json({ error: message }, { status });
  }
}
