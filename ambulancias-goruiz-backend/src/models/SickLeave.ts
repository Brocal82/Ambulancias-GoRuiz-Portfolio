import mongoose, { Schema, Document, Types } from 'mongoose';

export type SickLeaveStatus = 'pending' | 'accepted' | 'rejected';
export type SickVerificationStatus = 'not_required' | 'pending' | 'received' | 'overdue';

export interface ISickLeave extends Document {
  user: Types.ObjectId;
  startDate: Date;                 // Inicio de la baja (zona lógica: Europe/Berlin)
  endDate: Date;                   // Fin de la baja (inclusive, zona lógica: Europe/Berlin)
  status: SickLeaveStatus;         // pending | accepted | rejected
  note?: string;                   // Nota opcional del trabajador
  documentUrl?: string;            // URL del Krankschreibung (si aportado)
  requiresDocument: boolean;       // true si la baja >= 3 días naturales (regla de negocio)
  verificationStatus: SickVerificationStatus; // not_required | pending | received | overdue
  documentDueAt?: Date;            // Fecha límite para aportar documento (createdAt + 3 días)
  createdAt: Date;
  updatedAt: Date;
}

const SickLeaveSchema = new Schema<ISickLeave>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    note: { type: String },
    documentUrl: { type: String },

    // Campos de verificación de documento
    requiresDocument: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['not_required', 'pending', 'received', 'overdue'],
      default: 'not_required',
      required: true,
      index: true,
    },
    documentDueAt: { type: Date },
  },
  { timestamps: true }
);

// Índices útiles para búsquedas por rango y usuario
SickLeaveSchema.index({ user: 1, startDate: 1, endDate: 1 });
SickLeaveSchema.index({ startDate: 1, endDate: 1 });

const SickLeave = mongoose.model<ISickLeave>('SickLeave', SickLeaveSchema);
export default SickLeave;
