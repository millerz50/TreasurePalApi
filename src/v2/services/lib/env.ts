// lib/env.ts
import { Client } from "node-appwrite";

export function getEnv(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}
export function requireEnv(key: string): string {
  const v = getEnv(key);
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

let _client: Client | null = null;
export function getClient(): Client {
  if (_client) return _client;
  _client = new Client()
    .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
    .setProject(requireEnv("APPWRITE_PROJECT_ID"))
    .setKey(requireEnv("APPWRITE_API_KEY"));
  return _client;
}
