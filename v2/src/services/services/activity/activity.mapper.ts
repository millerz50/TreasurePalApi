import { Activity } from "./activity.types";

export function safeFormatActivity(row: any): Activity {
  return {
    id: row.$id,

    actorId: row.actorId,
    actorRole: row.actorRole,

    action: row.action,
    message: row.message,

    amount: row.amount ?? null,
    refId: row.refId ?? null,
    refType: row.refType ?? null,

    createdAt: row.createdAt ?? row.$createdAt,
  };
}
