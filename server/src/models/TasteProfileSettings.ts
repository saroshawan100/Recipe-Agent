import { Schema, model } from "mongoose";

export interface TasteProfileSettingsDoc {
  clientId: string;
  removedTags: string[];
}

const TasteProfileSettingsSchema = new Schema<TasteProfileSettingsDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    removedTags: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const TasteProfileSettings = model<TasteProfileSettingsDoc>("TasteProfileSettings", TasteProfileSettingsSchema);
