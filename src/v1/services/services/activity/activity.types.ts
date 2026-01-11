// services/activity/activity.types.ts
export type ActivityAction =
  | "USER_SIGNUP"
  | "DAILY_LOGIN_REWARD"
  | "CREDITS_ADDED"
  | "CREDITS_SPENT"
  | "PROPERTY_CREATED"
  | "PROPERTY_APPROVED";

export type Activity = {
  id: string;
  actorId: string;
  actorRole: "user" | "agent" | "admin";
  action: ActivityAction;
  message: string;
  refId?: string | null;
  refType?: string | null;
  amount?: number | null;
  createdAt: string;
};
