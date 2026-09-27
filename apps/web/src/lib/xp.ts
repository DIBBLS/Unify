// XP-gated access: features unlock as learners bank XP. Students earn
// +10 XP per completed topic; staff bypass gates (work tools, not play).
export const XP_GATES = {
  /** Save/Print a week as PDF (30 completed topics). */
  pdf: 300,
} as const;

export type XpGate = keyof typeof XP_GATES;

export function meetsXpGate(xp: number, gate: XpGate, opts?: { role?: string | null; isAdmin?: boolean }): boolean {
  if (!opts && xp >= XP_GATES[gate]) return true;
  if (opts && (opts.isAdmin || opts.role === 'lecturer' || opts.role === 'collaborator' || opts.role === 'admin')) return true;
  return xp >= XP_GATES[gate];
}
