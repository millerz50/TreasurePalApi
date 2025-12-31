/// user.types.ts

/* --------------------
   Roles & Status
-------------------- */

export type UserRole = "user" | "agent" | "admin";

export type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

/* --------------------
   Signup API Payload
   (Client → Server)
-------------------- */

export type SignupPayload = {
  /**
   * Optional — used for migrations or system-created users
   */
  accountid?: string;

  /**
   * Auth credentials
   */
  email: string;
  password: string;

  /**
   * Profile info
   */
  firstName: string;
  surname: string;

  phone?: string;
  country?: string;
  location?: string;
  dateOfBirth?: string;

  /**
   * Appwrite Auth only (OTP / phone verification)
   */
  authPhone?: string;

  /**
   * Optional profile image upload (File/Blob from client)
   */
  profileImage?: File | Blob;
};

/* --------------------
   DB Document Input
   (Server → Database)
   🚫 NO password here
-------------------- */

export type UserDocumentInput = {
  email: string;
  firstName: string;
  surname: string;

  phone?: string;
  country?: string;
  location?: string;
  dateOfBirth?: string;

  /**
   * Roles are additive
   * Example: ["user", "agent"]
   */
  roles: UserRole[];

  /**
   * Controlled by server/admin only
   */
  status: UserStatus;

  /**
   * Optional reference to profile image file ID in Appwrite
   */
  profileImageId?: string;
};
