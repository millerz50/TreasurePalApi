// lib/models/user.ts
export interface UserRow {
  $id?: string;
  accountid?: string;
  email?: string;
  firstName?: string;
  surname?: string;
  role?: string;
  status?: string;
  nationalId?: string | null;
  metadata?: any[];
  country?: string | null;
  location?: string | null;
  dateOfBirth?: string | null;
  agentId?: string | null;
  bio?: string | null;
  phone?: string | null;
  password?: string;
  credits: number;
  lastCreditAction?: string | null; // ✅ ADD THIS
  lastLoginReward?: string | null;
}

export function safeFormat(row: any): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const f: any = { ...(row as Record<string, any>) };
  delete f.password;
  return f as UserRow;
}
