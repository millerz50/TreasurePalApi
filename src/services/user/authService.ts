// lib/services/authService.ts
import { Account } from "node-appwrite";
import { getClient } from "../../services/lib/env";

export function getAccount(): Account {
  return new Account(getClient());
}

export async function createAuthUser(
  accountId: string,
  email: string,
  password: string
) {
  const account = getAccount();
  return account.create(accountId, email, password);
}

export async function createSession(email: string, password: string) {
  const account = getAccount();
  return account.createSession(email, password);
}
