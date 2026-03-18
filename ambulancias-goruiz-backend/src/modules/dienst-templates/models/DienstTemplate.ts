// backend/src/modules/dienst-templates/models/DienstTemplate.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface DaySchedule {
  /**
   * 0 = domingo, 1 = lunes, ... 6 = sÃ¡bado
   */
  dayIndex: number;
  /**
   * Hora de inicio en formato "HH:mm".
   * Puede omitirse si es dÃ­a libre (isOff = true).
   */
  startTime?: string;
  /**
   * Hora de fin en formato "HH:mm".
   * Puede omitirse si es dÃ­a libre (isOff = true).
   */
  endTime?: string;
  /**
   * Indica si el dÃ­a es libre.
   */
  isOff: boolean;
}

export interface IDienstTemplate extends Document {
  dienstNumber: number;
  startTime: string; // formato "HH:mm", igual que en Dienst.assignments
  endTime: string; // formato "HH:mm"
  daysOff: number[]; // 0=domingo, ..., 6=sÃ¡bado
  isActive: boolean;
  /**
   * Horario por dÃ­a de la semana.
   * Si estÃ¡ definido, mÃ¡s adelante lo usaremos para generar los Diensts
   * con horarios especÃ­ficos por dÃ­a.
   * Si no estÃ¡ definido, se seguirÃ¡ usando startTime/endTime/daysOff.
   */
  perDaySchedule?: DaySchedule[];
}

const DayScheduleSchema = new Schema<DaySchedule>(
  {
    dayIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      // NO required: puede faltar si es dÃ­a libre
    },
    endTime: {
      type: String,
      // NO required: puede faltar si es dÃ­a libre
    },
    isOff: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    _id: false, // No necesitamos _id para cada entrada de dÃ­a
  },
);

const DienstTemplateSchema = new Schema<IDienstTemplate>({
  dienstNumber: {
    type: Number,
    required: true,
    // Asumimos una plantilla por nÃºmero de Dienst.
    // Si mÃ¡s adelante quieres permitir varias plantillas con el mismo nÃºmero, borramos esta lÃ­nea:
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
      message: "daysOff must be an array of integers between 0 and 6",
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  perDaySchedule: {
    type: [DayScheduleSchema],
    // No required -> las plantillas existentes siguen siendo vÃ¡lidas.
  },
});

const DienstTemplate: Model<IDienstTemplate> =
  mongoose.models.DienstTemplate ||
  mongoose.model<IDienstTemplate>("DienstTemplate", DienstTemplateSchema);

export default DienstTemplate;
