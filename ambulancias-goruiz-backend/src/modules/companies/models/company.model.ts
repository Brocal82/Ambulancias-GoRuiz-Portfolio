import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICompany extends Document {
  name: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

const Company = mongoose.model<ICompany>("Company", companySchema);
export default Company;
