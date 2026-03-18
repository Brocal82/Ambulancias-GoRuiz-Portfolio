// backend/src/modules/dienst-templates/models/DienstTemplate.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface DaySchedule {
  /**
   * 0 = domingo, 1 = lunes, ... 6 = sábado
   */
  dayIndex: number;
  /**
   * Hora de inicio en formato "HH:mm".
   * Puede omitirse si es día libre (isOff = true).
   */
  startTime?: string;
  /**
   * Hora de fin en formato "HH:mm".
   * Puede omitirse si es día libre (isOff = true).
   */
  endTime?: string;
  /**
   * Indica si el día es libre.
   */
  isOff: boolean;
}

export interface IDienstTemplate extends Document {
  dienstNumber: number;
  startTime: string; // formato "HH:mm", igual que en Dienst.assignments
  endTime: string; // formato "HH:mm"
  daysOff: number[]; // 0=domingo, ..., 6=sábado
  isActive: boolean;
  /**
   * Horario por día de la semana.
   * Si está definido, más adelante lo usaremos para generar los Diensts
   * con horarios específicos por día.
   * Si no está definido, se seguirá usando startTime/endTime/daysOff.
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
      // NO required: puede faltar si es día libre
    },
    endTime: {
      type: String,
      // NO required: puede faltar si es día libre
    },
    isOff: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    _id: false, // No necesitamos _id para cada entrada de día
  },
);

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
      message: "daysOff must be an array of integers between 0 and 6",
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  perDaySchedule: {
    type: [DayScheduleSchema],
    // No required -> las plantillas existentes siguen siendo válidas.
  },
});

const DienstTemplate: Model<IDienstTemplate> =
  mongoose.models.DienstTemplate ||
  mongoose.model<IDienstTemplate>("DienstTemplate", DienstTemplateSchema);

export default DienstTemplate;
