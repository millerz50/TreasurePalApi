import { UserDocumentInput } from "./user.types";

export function toUserDocument(
  data: UserDocumentInput,
  accountId: string,
  signupCredits: number
) {
  return {
    accountid: accountId,

    email: data.email,
    firstName: data.firstName,
    surname: data.surname,

    phone: data.phone,
    country: data.country,
    location: data.location,
    dateOfBirth: data.dateOfBirth,

    roles: data.roles,
    status: data.status,

    credits: signupCredits,
    metadata: [],
  };
}
