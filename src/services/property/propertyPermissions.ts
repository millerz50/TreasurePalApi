import { Permission, Role } from "node-appwrite";

export function buildPropertyPermissions(agentId: string) {
  return [
    // Agent can fully manage their own property
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),

    // Allow anyone to read (public listing)
    Permission.read(Role.any()),

    // Admin team can update and delete
    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];
}
