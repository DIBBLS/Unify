import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

const TOPIC_XP = 10;

const onboardingSchema = z.object({
  firstName: z.string().min(1).max(60),
  university: z.string().min(1).max(120),
  faculty: z.string().min(1).max(120),
  department: z.string().min(1).max(100),
  level: z.string().min(1).max(40),
  universityId: z.string().uuid().max(80).optional(),
  gradTarget: z.number().min(0).max(5).optional(),
});

const profileSchema = onboardingSchema.partial();

const progressSchema = z.object({
  course: z.string().min(1).max(20),
  week: z.number().int().min(1).max(52),
  topic: z.number().int().min(0).max(100),
});

function dbError(e: unknown): { error: string; message: string } {
  return { error: "Database error", message: e instanceof Error ? e.message : String(e) };
}

function calcStreak(dateIsos: string[]): number {
  const days = new Set(dateIsos.map((d) => d.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Public: never dead-ends onboarding when seeded.
router.get("/universities", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin()
      .from("universities")
      .select("id,name,short_name")
      .order("name");
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

// Authed: own profile, or onboarded:false when missing.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId as string;
  try {
    const { data, error } = await supabaseAdmin().from("profiles").select("*").eq("id", userId).single();
    if (error || !data) {
      res.json({ onboarded: false, profile: null });
      return;
    }
    res.json({ onboarded: Boolean((data as { university?: string }).university), profile: data });
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

// Authed: partial profile update (display name etc). Full setup goes via /onboarding.
router.put("/me", requireAuth, async (req: Request, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const userId = (req as AuthedRequest).userId as string;
  const d = parsed.data;
  try {
    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .upsert(
        {
          id: userId,
          first_name: d.firstName,
          university: d.university,
          faculty: d.faculty,
          department: d.department,
          level: d.level,
          university_id: d.universityId,
          grad_target: d.gradTarget,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    res.json({ ok: true, profile: data });
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

// Authed: complete onboarding (server-validated — replaces client Firestore write).
router.post("/onboarding", requireAuth, async (req: Request, res: Response) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const userId = (req as AuthedRequest).userId as string;
  const d = parsed.data;
  try {
    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .upsert(
        {
          id: userId,
          first_name: d.firstName,
          university: d.university,
          faculty: d.faculty,
          department: d.department,
          level: d.level,
          university_id: d.universityId ?? null,
          grad_target: d.gradTarget ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    res.json({ ok: true, profile: data });
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

// Public: course list.
router.get("/courses", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin().from("courses").select("code,title").order("code");
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

// Public: one week of a course (noteJson payload).
router.get("/courses/:code/weeks/:week", async (req: Request, res: Response) => {
  const code = decodeURIComponent(req.params.code).toUpperCase();
  const week = Number(req.params.week);
  if (!Number.isInteger(week) || week < 1) {
    res.status(400).json({ error: "Invalid week" });
    return;
  }
  try {
    const sb = supabaseAdmin();
    const variants = [...new Set([code, code.replace(/\s/g, "")])];
    for (const v of variants) {
      const { data, error } = await sb
        .from("weeks")
        .select("course,week,title,subtitle,note_json")
        .eq("course", v)
        .eq("week", week)
        .single();
      if (!error && data) {
        res.json(data);
        return;
      }
    }
    res.status(404).json({ error: "Week not found" });
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

// Authed: mark topic complete -> +XP, returns total xp + streak.
router.post("/progress", requireAuth, async (req: Request, res: Response) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const userId = (req as AuthedRequest).userId as string;
  const { course, week, topic } = parsed.data;
  try {
    const sb = supabaseAdmin();
    const { error: upErr } = await sb.from("topic_progress").upsert(
      { user_id: userId, course, week, topic, done: true, completed_at: new Date().toISOString() },
      { onConflict: "user_id,course,week,topic" }
    );
    if (upErr) throw upErr;
    await sb.from("xp_events").insert({
      user_id: userId,
      amount: TOPIC_XP,
      reason: `topic_complete:${course}:w${week}:t${topic}`,
    });
    const { data: xpRows } = await sb
      .from("xp_events")
      .select("amount,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120);
    const rows = (xpRows ?? []) as { amount: number; created_at: string }[];
    const xp = rows.reduce((s, r) => s + (r.amount || 0), 0);
    res.json({ ok: true, xp, streak: calcStreak(rows.map((r) => r.created_at)) });
  } catch (e) {
    res.status(500).json(dbError(e));
  }
});

export default router;
