//src/models/Team.ts

import { Schema, model, Types, Document } from 'mongoose';

export interface ITeamModel extends Document {
  driver: Types.ObjectId;
  medic: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeamModel>(
  {
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    medic:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// ❗ Evitar duplicados exactos de pareja
TeamSchema.index({ driver: 1, medic: 1 }, { unique: true });

export default model<ITeamModel>('Team', TeamSchema);
