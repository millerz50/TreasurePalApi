import { Permission, Role } from "node-appwrite";

export function buildPropertyPermissions(agentId: string) {
  return [
    // Allow agent to create, read, update, delete their own property
    Permission.create(Role.user(agentId)),
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),

    // Allow anyone to read
    Permission.read(Role.any()),

    // Admin team can update and delete
    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];
}
