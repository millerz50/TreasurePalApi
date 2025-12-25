import type { UserRole } from "../services/user/user.types";

export interface AuthenticatedUser {
  id: string;
  roles: UserRole[];
  email?: string;
  role: UserRole; //
}
