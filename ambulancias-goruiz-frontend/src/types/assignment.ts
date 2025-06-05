// frontend/src/types/assignment.ts
import type { DienstAssignment, UserRef } from "./dienst";

export interface FlexibleAssignment extends Omit<DienstAssignment, 'driver' | 'medic' | '_id'> {
  _id?: string;
  driver: string | UserRef;
  medic: string | UserRef;
}
