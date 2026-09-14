import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { MODULES } from "../../../lib/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

const OUTLINE = MODULES.map(
  (m) =>
    `Module ${m.id}: ${m.title}\n` +
    m.areas.map((a) => `  Area "${a}": ${(m.sessions?.[a] || []).map((s) => `"${s}"`).join(", ")}`).join("\n"),
).join("\n");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          functional_area: { type: "string" },
          session: { type: "string" },
        },
        required: ["id", "functional_area", "session"],
      },
    },
  },
  required: ["suggestions"],
};

const SYSTEM_PROMPT = `You place a student's CSCP study notes into the official course outline. For each note you are given its module, title, and a content excerpt.

For each note, choose the single best-fitting functional_area and session FROM THE GIVEN MODULE ONLY, copied VERBATIM from this outline:

${OUTLINE}

Rules:
- functional_area must be one of the areas listed under that note's module; session must be one of the sessions listed under that chosen area — exact strings.
- Pick the closest match based on the note's title and content. If genuinely unsure of the session, still pick the most likely one in the best area.
- Return one suggestion per note, echoing the note's id. Output JSON only.`;

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

  const notes = (Array.isArray(body?.notes) ? body.notes : [])
    .filter((n) => n && n.id && MODULES.some((m) => m.id === n.module_id))
    .slice(0, 80);
  if (notes.length === 0) return Response.json({ suggestions: [] });

  const noteList = notes
    .map((n) => `id: ${n.id}\nModule: ${n.module_id}\nTitle: ${String(n.title || "").slice(0, 200)}\nExcerpt: ${String(n.content || "").slice(0, 600)}`)
    .join("\n---\n");

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Place these notes:\n\n${noteList}` }],
    });

    if (response.stop_reason === "refusal") return Response.json({ error: "Claude declined." }, { status: 422 });
    const textBlock = response.content.find((b) => b.type === "text" && b.text.trim());
    if (!textBlock) return Response.json({ error: "No suggestions returned." }, { status: 502 });

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return Response.json({ error: "Couldn't parse suggestions." }, { status: 502 });
    }

    // Validate each suggestion against the note's module outline; drop invalid area/session.
    const byId = Object.fromEntries(notes.map((n) => [String(n.id), n]));
    const suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : [])
      .map((s) => {
        const note = byId[String(s.id)];
        if (!note) return null;
        const mod = MODULES.find((m) => m.id === note.module_id);
        const area = (mod?.areas || []).find((a) => a.toLowerCase() === String(s.functional_area || "").toLowerCase()) || null;
        const sess = area
          ? (mod.sessions?.[area] || []).find((x) => x.toLowerCase() === String(s.session || "").toLowerCase()) || null
          : null;
        return { id: String(s.id), functional_area: area, session: sess };
      })
      .filter(Boolean);

    return Response.json({ suggestions });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    const message = err?.status === 429 ? "Rate limited — wait a moment." : "Something went wrong. Try again.";
    return Response.json({ error: message }, { status });
  }
}
