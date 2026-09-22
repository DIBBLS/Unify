import type { Request, Response, NextFunction } from "express";
import { supabaseAnon } from "../lib/supabase";

export interface AuthedRequest extends Request {
  userId?: string;
}

// Verifies the Supabase access-token JWT via the Auth server and attaches userId.
// Keeps Request in the signature (express 4 typings) and casts internally.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const { data, error } = await supabaseAnon().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    (req as AuthedRequest).userId = data.user.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}
