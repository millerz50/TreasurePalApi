// user.mapper.ts
import type { UserDocumentInput, UserRole, UserStatus } from "./user.types";

type UserDocument = {
  accountid: string;

  email: string;
  firstName: string;
  surname: string;

  phone?: string;
  country?: string;
  location?: string;
  dateOfBirth?: string;

  roles: UserRole[];
  status: UserStatus;

  credits: number;
  createdAt: string;
};

export function toUserDocument(
  data: UserDocumentInput,
  accountId: string,
  signupCredits: number
): UserDocument {
  return {
    accountid: accountId,

    email: data.email.toLowerCase().trim(),
    firstName: data.firstName.trim(),
    surname: data.surname.trim(),

    phone: data.phone,
    country: data.country,
    location: data.location,
    dateOfBirth: data.dateOfBirth,

    // 🔒 SERVER SAFETY NETS
    roles:
      Array.isArray(data.roles) && data.roles.length > 0
        ? data.roles
        : ["user"],

    status: data.status ?? "Pending",

    credits: signupCredits,
    createdAt: new Date().toISOString(),
  };
}
