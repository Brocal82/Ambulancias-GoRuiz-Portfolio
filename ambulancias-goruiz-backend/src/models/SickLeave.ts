import mongoose, { Schema, Document, Types } from 'mongoose';

export type SickLeaveStatus = 'pending' | 'accepted' | 'rejected';
export type SickDocVerification =
  | 'not_required'
  | 'pending'
  | 'received'
  | 'overdue'
  // si más adelante quieres verificación explícita del admin, descomenta:
  // | 'verified'
  ;

export interface ISickLeave extends Document {
  user: Types.ObjectId;
  startDate: Date;          // límites inclusivos
  endDate: Date;            // límites inclusivos
  status: SickLeaveStatus;  // pending | accepted | rejected

  note?: string;
  documentUrl?: string;

  // Reglas de negocio para Krankschreibung (documento)
  requiresDocument: boolean;                 // true si la baja dura ≥ 3 días
  documentDueAt?: Date;                      // createdAt + 3 días
  verificationStatus: SickDocVerification;   // not_required | pending | received | overdue
  documentVerifiedAt?: Date;                 // opcional, si más adelante hay verificación explícita

  createdAt: Date;
  updatedAt: Date;
}

const SickLeaveSchema = new Schema<ISickLeave>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      required: true,
    },

    note: { type: String, required: false },
    documentUrl: { type: String, required: false },

    requiresDocument: { type: Boolean, required: true, default: false },
    documentDueAt: { type: Date, required: false },
    verificationStatus: {
      type: String,
      enum: ['not_required', 'pending', 'received', 'overdue' /*, 'verified' */],
      required: true,
      default: 'not_required',
    },
    documentVerifiedAt: { type: Date, required: false },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

// Índices útiles
SickLeaveSchema.index({ user: 1, startDate: 1, endDate: 1 });
SickLeaveSchema.index({ status: 1, startDate: 1 });
SickLeaveSchema.index({ verificationStatus: 1, documentDueAt: 1 });

export default mongoose.model<ISickLeave>('SickLeave', SickLeaveSchema);
