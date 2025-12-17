// lib/services/authService.ts
import { Account } from "node-appwrite";
import { getClient } from "../../services/lib/env";

/* ======================================
   Appwrite Account Helper
====================================== */
export function getAccount(): Account {
  return new Account(getClient());
}

/* ======================================
   Create Auth User
====================================== */
export async function createAuthUser(
  accountId: string,
  email: string,
  password: string
) {
  const account = getAccount();

  // Appwrite requires normalized email
  return account.create(accountId, email.toLowerCase().trim(), password);
}

/* ======================================
   Create Email/Password Session
====================================== */
export async function createSession(email: string, password: string) {
  const account = getAccount();

  return account.createSession(email.toLowerCase().trim(), password);
}

/* ======================================
   Destroy Current Session
====================================== */
export async function destroySession(sessionId = "current") {
  const account = getAccount();
  return account.deleteSession(sessionId);
}
