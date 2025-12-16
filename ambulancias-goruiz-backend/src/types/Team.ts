//src/types/Team.ts
export interface ITeam {
  _id: string;
  driver: string; // ObjectId<User>
  medic: string; // ObjectId<User>
  createdAt?: string;
  updatedAt?: string;
  rotationMode?: "rotating" | "fixed" | "none";
  fixedDienstNumber?: number | null;
}
