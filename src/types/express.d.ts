// src/types/express.d.ts
export interface AuthenticatedUser {
  id: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// types/express.d.ts
import { UserRole } from "../services/blogService"; // or wherever you define roles

declare global {
  namespace Express {
    interface User {
      id: string;
      role: UserRole; // "user" | "agent" | "admin"
    }

    interface Request {
      user?: User; // optional, since middleware attaches it
    }
  }
}

export {};
