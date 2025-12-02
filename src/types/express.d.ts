// src/types/express.d.ts
import { Profile as FacebookProfile } from "passport-facebook";
import { Profile as GoogleProfile } from "passport-google-oauth20";
import { UserRole } from "../services/blogService";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      role: UserRole;
      profile?: FacebookProfile | GoogleProfile; // ✅ optional now
    }

    interface Request {
      user?: User;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}
