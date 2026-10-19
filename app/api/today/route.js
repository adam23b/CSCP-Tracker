import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Notes home page asks here for study status to show in its Today strip:
// cards due, minutes logged today and days to the exam. Server to server,
// authorised by the secret the apps share (CLASHAPP_SHARED_SECRET), reading
// with the service role key so no browser session is needed. Read-only.
export async function GET(request) {
  const secret = process.env.CLASHAPP_SHARED_SECRET;
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(given, secret)) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 503 });

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const since = url.searchParams.get("since") || `${date}T00:00:00Z`;
  if (!email || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "email and date are required." }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (usersError) return Response.json({ error: usersError.message }, { status: 500 });
  const user = (users?.users || []).find((u) => (u.email || "").toLowerCase() === email);
  if (!user) return Response.json({ cardsDue: 0, minutesToday: 0, daysToExam: null });

  const [cards, sessions, settings] = await Promise.all([
    admin.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id).lte("due_date", date),
    admin.from("sessions").select("minutes").eq("user_id", user.id).gte("logged_at", since),
    admin.from("settings").select("exam_date").eq("user_id", user.id).maybeSingle(),
  ]);
  if (cards.error) return Response.json({ error: cards.error.message }, { status: 500 });

  const minutesToday = (sessions.data || []).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const examDate = settings.data?.exam_date || null;
  const daysToExam = examDate ? Math.round((Date.UTC(...ymd(examDate)) - Date.UTC(...ymd(date))) / 86400000) : null;

  return Response.json({ cardsDue: cards.count || 0, minutesToday, daysToExam });
}

function ymd(s) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return [y, m - 1, d];
}

function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
