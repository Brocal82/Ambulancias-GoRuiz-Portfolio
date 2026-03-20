// modules/diensts/models/dienst.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDienstAssignment {
  _id?: Types.ObjectId;
  date: string;
  ambulanceId?: Types.ObjectId;
  startTime: string;
  endTime: string;
  driver?: Types.ObjectId;
  medic?: Types.ObjectId;
}

export interface IDienst extends Document {
  dienstNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  assignments: IDienstAssignment[];
  weekTeamId?: Types.ObjectId | null;
}

const AssignmentSchema = new Schema<IDienstAssignment>(
  {
    date: { type: String, required: true },
    ambulanceId: {
      type: Schema.Types.ObjectId,
      ref: "Ambulance",
      required: false,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User", required: false },
    medic: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { _id: true },
);

const DienstSchema = new Schema<IDienst>({
  dienstNumber: { type: Number, required: true },
  weekStartDate: { type: Date, required: false },
  weekEndDate: { type: Date, required: false },
  assignments: [AssignmentSchema],
  weekTeamId: {
    type: Schema.Types.ObjectId,
    ref: "Team",
    required: false,
    default: null,
  },
});

export default mongoose.model<IDienst>("Dienst", DienstSchema);
