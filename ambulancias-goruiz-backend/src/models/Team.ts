// src/models/Team.ts
import { Schema, model, Types, Document } from 'mongoose';

export interface ITeamModel extends Document {
  driver: Types.ObjectId;
  medic: Types.ObjectId;

  /**
   * Cómo se comporta este equipo respecto a los Dienst:
   * - 'rotating' → rota de Dienst 1 → 2 → 3 → ... → 1
   * - 'fixed'    → siempre el mismo Dienst (fixedDienstNumber)
   * - 'none'     → sin lógica automática de rotación (asignación manual)
   */
  rotationMode: 'rotating' | 'fixed' | 'none';

  /**
   * Solo tiene sentido cuando rotationMode === 'fixed'.
   * Indica el número de Dienst fijo (por ejemplo, 7).
   */
  fixedDienstNumber?: number | null;

  /**
   * 🚑 Ambulancia fija asociada al equipo (opcional).
   * Si es null, el equipo no tiene ambulancia fija.
   */
  ambulanceId?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeamModel>(
  {
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    medic:  { type: Schema.Types.ObjectId, ref: 'User', required: true },

    rotationMode: {
      type: String,
      enum: ['rotating', 'fixed', 'none'],
      required: true,
      default: 'none', // por defecto no hacemos rotación automática
    },

    fixedDienstNumber: {
      type: Number,
      required: false,
      default: null,
    },

    // 🚑 NUEVO: ambulancia fija del equipo (opcional)
    ambulanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Ambulance',
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

// ❗ Evitar duplicados exactos de pareja
TeamSchema.index({ driver: 1, medic: 1 }, { unique: true });

export default model<ITeamModel>('Team', TeamSchema);
