import mongoose from "mongoose";

const WorkdayIssueSchema = new mongoose.Schema({
  dienstNumber: { type: Number, required: true },
  date: { type: String, required: true },
  startTime: String,
  endTime: String,
  team: String,
  vehicleNumber: String,
  ambulanceId: String,
  finalKm: Number,
  timestamp: { type: String, required: true },
  issueText: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medic: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.model("WorkdayIssue", WorkdayIssueSchema);
