// user.types.ts

export type UserRole = "user" | "agent" | "admin";
export type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

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

  // 🔒 Signup can request role, but server enforces
  role?: "user" | "agent";

  status?: UserStatus;

  // Appwrite Auth only
  authPhone?: string;
};
