import mongoose, {
  Schema,
  Document as MongooseDocument,
  Types,
} from "mongoose";

export interface IDocumentDelivery extends MongooseDocument {
  companyId: Types.ObjectId;
  documentId: Types.ObjectId;
  workerId: Types.ObjectId;
  sentAt: Date;
  readAt: Date | null;
}

const DocumentDeliverySchema = new Schema<IDocumentDelivery>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyDocument",
      required: true,
      index: true,
    },
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      required: true,
    },
    readAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },
  },
  {
    timestamps: false,
  },
);

DocumentDeliverySchema.index({ documentId: 1, workerId: 1 }, { unique: true });

export const DocumentDelivery = mongoose.model<IDocumentDelivery>(
  "DocumentDelivery",
  DocumentDeliverySchema,
);

