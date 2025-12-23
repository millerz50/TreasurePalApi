// user.types.ts

/* --------------------
   Roles & Status
-------------------- */

export type UserRole = "user" | "agent" | "admin";

export type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

/* --------------------
   Signup API Payload
   (Auth + Validation)
-------------------- */

export type SignupPayload = {
  accountid?: string;

  email: string;
  password: string;

  firstName: string;
  surname: string;

  phone?: string;
  country?: string;
  location?: string;
  dateOfBirth?: string;

  // Signup may request role, server enforces
  role?: "user" | "agent";

  status?: UserStatus;

  // Appwrite Auth only
  authPhone?: string;
};

/* --------------------
   DB Document Input
   (NO password)
-------------------- */

export type UserDocumentInput = {
  email: string;
  firstName: string;
  surname: string;

  phone?: string;
  country?: string;
  location?: string;
  dateOfBirth?: string;

  roles: UserRole[];
  status: UserStatus;
};
