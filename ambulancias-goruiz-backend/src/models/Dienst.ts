import mongoose, { Schema, Document } from 'mongoose';

export interface IDienst extends Document {
  dienstNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  assignments: {
    date: string;
    vehicleNumber: string;
    startTime: string;
    endTime: string;
    driver: string;
    medic: string;
  }[];
}

const DienstSchema: Schema = new Schema({
  dienstNumber: { type: Number, required: true },
  weekStartDate: { type: Date, required: true },
  weekEndDate: { type: Date, required: true },
  assignments: [
    {
      date: { type: String, required: true },
      vehicleNumber: { type: String, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      driver: { type: String, required: true },
      medic: { type: String, required: true },
    }
  ]
});

export default mongoose.model<IDienst>('Dienst', DienstSchema);
