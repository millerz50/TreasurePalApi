import { Permission, Role } from "node-appwrite";

export function buildPropertyPermissions(agentId: string) {
  console.log(
    "🔐 [buildPropertyPermissions] Building permissions for agent:",
    agentId
  );
  return [
    // Agent can read/update/delete their own property
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),

    // Public can read
    Permission.read(Role.any()),

    // Admin functionality: use API key in server to bypass team permissions
    // No Role.team() here since free tier may not support it
  ];
}
