// --------------------
// types/authenticatedUser.ts
// --------------------

import { UserRole } from "../services/user/user.types";

export interface AuthenticatedUser {
  id: string; // Appwrite account ID
  email?: string; // optional email
  role: UserRole; // primary role (for legacy checks)
  roles: UserRole[]; // all assigned roles
}
