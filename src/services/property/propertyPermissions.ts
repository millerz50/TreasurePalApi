import { Permission, Role } from "node-appwrite";

export function buildPropertyPermissions(agentId: string) {
  return [
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),

    Permission.read(Role.any()),

    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];
}
