// types/express.d.ts
import { AuthenticatedUser } from "./authenticatedUser";

declare global {
  namespace Express {
    interface Request {
      // Multer file uploads
      file?: Multer.File;
      files?: Multer.File[];

      // Appwrite-authenticated user
      authUser?: AuthenticatedUser;

      // Account ID from Appwrite
      UserId?: string;
    }
  }
}
