export type SignupPayload = {
  accountid?: string;

  email: string;
  password: string;

  firstName: string;
  surname: string;

  phone?: string;
  country?: string;
  location?: string;

  role?: "user" | "agent" | string;
  status?: "Not Verified" | "Pending" | "Active" | "Suspended";

  nationalId?: string;
  bio?: string;
  metadata?: any[];
  dateOfBirth?: string;

  authPhone?: string;
};
