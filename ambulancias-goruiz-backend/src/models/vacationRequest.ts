// backend/src/models/vacationRequest.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IVacationRequest extends Document {
  user: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  requestedAt: Date;
  status: 'pending' | 'accepted' | 'cancelled' | 'option_sent';
  adminOptionStartDate?: Date;
  adminOptionEndDate?: Date;
  userResponse?: 'accepted' | 'cancelled';
}

const VacationRequestSchema = new Schema<IVacationRequest>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  requestedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'accepted', 'cancelled', 'option_sent'], default: 'pending' },
  adminOptionStartDate: { type: Date },
  adminOptionEndDate: { type: Date },
  userResponse: { type: String, enum: ['accepted', 'cancelled'] },
});

export default mongoose.model<IVacationRequest>('VacationRequest', VacationRequestSchema);
