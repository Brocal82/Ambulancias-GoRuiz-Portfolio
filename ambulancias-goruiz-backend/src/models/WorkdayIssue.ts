import mongoose from "mongoose";

const WorkdayIssueSchema = new mongoose.Schema({
  dienstNumber: { type: Number, required: true },
  date: { type: String, required: true },
  startTime: String,
  endTime: String,
  team: String,
  ambulanceNumber: { type: String, required: true },
  ambulanceId: String,
  finalKm: Number,
  timestamp: { type: String, required: true },
  issueText: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medic: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // 👇 NUEVOS CAMPOS para marcado de "visto"
  isSeen: { type: Boolean, default: false },
  seenAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("WorkdayIssue", WorkdayIssueSchema);
