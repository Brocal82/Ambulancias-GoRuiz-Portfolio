// backend/src/models/Appointment.ts
import mongoose, { Schema, Model, Document } from "mongoose";
import {
  IAppointment,
  AppointmentStatus,
  TimeSlot,
} from "../types/Appointment";

interface AppointmentDoc extends Omit<IAppointment, "_id">, Document {}

const TimeSlotSchema = new Schema<TimeSlot>(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  { _id: false },
);

const AppointmentSchema = new Schema<AppointmentDoc>(
  {
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User" },

    reason: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: String, required: true, trim: true, maxlength: 5000 },

    status: {
      type: String,
      enum: [
        "pending",
        "proposed",
        "confirmed",
        "cancelled",
        "rescheduled",
      ] satisfies AppointmentStatus[],
      default: "pending",
      index: true,
    },

    proposedSlots: {
      type: [TimeSlotSchema],
      default: [],
      validate: [
        {
          validator: function (slots: TimeSlot[]) {
            return slots.length <= 3;
          },
          message: "proposedSlots no puede tener más de 3 opciones.",
        },
      ],
    },

    selectedSlot: {
      type: TimeSlotSchema,
      default: null,
    },
  },
  { timestamps: true },
);

// Validaciones clave
AppointmentSchema.pre("save", function (next) {
  const now = new Date();

  // proposedSlots: validar estructura siempre; validar "futuro" solo cuando se modifican o es nuevo y no estamos cancelando
  if (this.proposedSlots && this.proposedSlots.length > 0) {
    const enforceFuture =
      (this.isNew || this.isModified("proposedSlots")) &&
      this.status !== "cancelled";

    // (la longitud máxima ya la valida el schema, pero mantenemos el resto)
    for (const s of this.proposedSlots) {
      if (
        !(s.start instanceof Date) ||
        !(s.end instanceof Date) ||
        Number.isNaN(s.start.getTime()) ||
        Number.isNaN(s.end.getTime()) ||
        s.start >= s.end
      ) {
        return next(
          new Error("Cada slot debe tener start/end válidos y start < end."),
        );
      }
      if (enforceFuture && s.start < now) {
        return next(new Error("No se pueden proponer slots en el pasado."));
      }
    }
    for (let i = 1; i < this.proposedSlots.length; i++) {
      if (this.proposedSlots[i - 1].start > this.proposedSlots[i].start) {
        return next(
          new Error(
            "proposedSlots debe venir ordenado por fecha/hora ascendente.",
          ),
        );
      }
    }
  }

  // selectedSlot: reglas según estado
  if (this.selectedSlot) {
    const sel = this.selectedSlot as TimeSlot;

    // Solo impedimos pasado cuando el estado final es confirmed o rescheduled.
    // Al cancelar (status='cancelled'), NO bloqueamos aunque el slot sea pasado.
    if (
      (this.status === "confirmed" || this.status === "rescheduled") &&
      sel.start < now
    ) {
      return next(new Error("No se puede programar un slot en el pasado."));
    }

    // Solo al CONFIRMAR exigimos que el selectedSlot pertenezca a proposedSlots
    if (this.status === "confirmed") {
      const belongs = (this.proposedSlots ?? []).some(
        (s: TimeSlot) =>
          s.start.getTime() === sel.start.getTime() &&
          s.end.getTime() === sel.end.getTime(),
      );

      if (!belongs) {
        return next(
          new Error(
            "selectedSlot debe pertenecer a proposedSlots al confirmar.",
          ),
        );
      }
    }
  }

  next();
});

// Índices útiles para calendario y consultas
AppointmentSchema.index({ "selectedSlot.start": 1 });
AppointmentSchema.index({ workerId: 1, status: 1, "selectedSlot.start": 1 });

export const Appointment: Model<AppointmentDoc> =
  mongoose.models.Appointment ||
  mongoose.model<AppointmentDoc>("Appointment", AppointmentSchema);
