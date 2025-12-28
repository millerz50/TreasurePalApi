// server/services/propertyPermissions.ts
import { Permission, Role } from "node-appwrite";

/**
 * Build permissions for a property document.
 *
 * Since the server uses the API key, Role.user(agentId) is not required.
 * Public can read, admin team can update/delete.
 */
export function buildPropertyPermissions(agentId: string) {
  console.log(
    "🔐 [buildPropertyPermissions] Building permissions for agent:",
    agentId
  );

  return [
    // Public can read properties
    Permission.read(Role.any()),

    // Admin team can update/delete any property
    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];
}
