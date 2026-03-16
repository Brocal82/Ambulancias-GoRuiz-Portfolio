// backend/src/utils/sickUtils.ts
import {
  findOverlappingSickLeaveQuery,
  isOnSickDayQuery,
} from "../modules/sick-leaves";

export async function isOnSickDay(params: {
  userId: string;
  dateISO: string; // 'YYYY-MM-DD'
}): Promise<boolean> {
  return isOnSickDayQuery(params);
}

export async function findOverlappingSickLeave(params: {
  userId: string;
  dateISO: string;
}) {
  return findOverlappingSickLeaveQuery(params);
}
