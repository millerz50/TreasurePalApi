// types/authenticatedUser.ts
// types/authenticatedUser.ts
export type UserRole = "admin" | "agent" | "user"; // extend as needed

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email?: string;
}
