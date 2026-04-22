import mongoose from "mongoose";

const MechanicsIssueSchema = new mongoose.Schema(
  {
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
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
      default: null,
    },
    isSeen: { type: Boolean, default: false },
    seenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const MechanicsIssue =
  (mongoose.models.MechanicsIssue as mongoose.Model<unknown>) ||
  mongoose.model("MechanicsIssue", MechanicsIssueSchema);

export default MechanicsIssue;
