// frontend/src/types/assignment.ts
import type { DienstAssignment, UserRef } from "../types";

export interface FlexibleAssignment extends Omit<
  DienstAssignment,
  "driver" | "medic" | "_id"
> {
  _id?: string;
  driver: string | UserRef;
  medic: string | UserRef;
}
