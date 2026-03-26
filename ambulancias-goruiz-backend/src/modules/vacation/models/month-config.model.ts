import mongoose, {
  Schema as MongooseSchema,
  model as mongooseModel,
  models as mongooseModels,
} from "mongoose";

export interface IVacationMonthConfig {
  companyId: mongoose.Types.ObjectId;
  monthKey: string;
  maxPerDay: number;
  blackouts: { startDate: Date; endDate: Date }[];
}

const vacationMonthConfigSchema = new MongooseSchema<IVacationMonthConfig>(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    monthKey: { type: String, required: true },
    maxPerDay: { type: Number, required: true, default: 2 },
    blackouts: {
      type: [
        {
          startDate: { type: Date, required: true },
          endDate: { type: Date, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

vacationMonthConfigSchema.index(
  { companyId: 1, monthKey: 1 },
  { unique: true, name: "companyId_monthKey_unique" },
);

const VacationMonthConfig =
  (mongooseModels.VacationMonthConfig as
    | mongoose.Model<IVacationMonthConfig>
    | undefined) ||
  mongooseModel<IVacationMonthConfig>(
    "VacationMonthConfig",
    vacationMonthConfigSchema,
  );

export default VacationMonthConfig;
