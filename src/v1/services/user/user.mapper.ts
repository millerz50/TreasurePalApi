// user.mapper.ts
import type { UserDocumentInput, UserRole, UserStatus } from "./user.types";

export type UserDocument = {
  accountid: string;

  email: string;
  firstName: string;
  surname: string;

  phone?: string | null;
  country?: string | null;
  location?: string | null;
  dateOfBirth?: string | null;

  roles: UserRole[];
  status: UserStatus;

  credits: number;

  // Optional profile image reference (Appwrite file ID)
  profileImageId?: string | null;

  // ❌ DO NOT define createdAt
  // Appwrite provides $createdAt automatically
};

export function toUserDocument(
  data: UserDocumentInput,
  accountId: string,
  signupCredits: number
): UserDocument {
  return {
    accountid: accountId,

    email: data.email?.toLowerCase().trim() ?? "",
    firstName: data.firstName?.trim() ?? "",
    surname: data.surname?.trim() ?? "",

    phone: data.phone ?? null,
    country: data.country ?? null,
    location: data.location ?? null,
    dateOfBirth: data.dateOfBirth ?? null,

    // 🔒 SERVER SAFETY NETS
    roles:
      Array.isArray(data.roles) && data.roles.length > 0
        ? data.roles
        : ["user"],

    status: data.status ?? "Pending",

    credits: signupCredits,

    profileImageId: data.profileImageId ?? null,
  };
}
