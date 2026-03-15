import mongoose, {
  Schema as MongooseSchema,
  model as mongooseModel,
  models as mongooseModels,
} from "mongoose";

export interface IVacationMonthConfig {
  monthKey: string;
  maxPerDay: number;
  blackouts: { startDate: Date; endDate: Date }[];
}

const VacationMonthConfig =
  (mongooseModels.VacationMonthConfig as
    | mongoose.Model<IVacationMonthConfig>
    | undefined) ||
  mongooseModel<IVacationMonthConfig>(
    "VacationMonthConfig",
    new MongooseSchema<IVacationMonthConfig>(
      {
        monthKey: { type: String, required: true, unique: true, index: true },
        maxPerDay: { type: Number, required: true, default: 2 },
        blackouts: [
          {
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true },
          },
        ],
      },
      { timestamps: true },
    ),
  );

export default VacationMonthConfig;
