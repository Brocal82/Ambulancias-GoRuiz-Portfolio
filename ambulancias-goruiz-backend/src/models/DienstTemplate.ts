import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDienstTemplate extends Document {
  dienstNumber: number;
  startTime: string; // formato "HH:mm", igual que en Dienst.assignments
  endTime: string;   // formato "HH:mm"
  daysOff: number[]; // 0=domingo, ..., 6=sábado
  isActive: boolean;
}

const DienstTemplateSchema = new Schema<IDienstTemplate>({
  dienstNumber: {
    type: Number,
    required: true,
    // Asumimos una plantilla por número de Dienst.
    // Si más adelante quieres permitir varias plantillas con el mismo número, borramos esta línea:
    unique: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  daysOff: {
    type: [Number],
    required: true,
    validate: {
      validator: (arr: number[]) =>
        Array.isArray(arr) &&
        arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      message: 'daysOff must be an array of integers between 0 and 6',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const DienstTemplate: Model<IDienstTemplate> =
  mongoose.models.DienstTemplate ||
  mongoose.model<IDienstTemplate>('DienstTemplate', DienstTemplateSchema);

export default DienstTemplate;
