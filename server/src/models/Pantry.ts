import { Schema, model } from "mongoose";

export interface PantryItem {
  name: string;
  category?: string;
  quantity?: string;
  useSoon?: boolean;
}

export interface PantryDoc {
  clientId: string;
  items: PantryItem[];
  staples: string[];
}

const PantryItemSchema = new Schema<PantryItem>(
  {
    name: { type: String, required: true },
    category: String,
    quantity: String,
    useSoon: Boolean,
  },
  { _id: false },
);

const PantrySchema = new Schema<PantryDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    items: { type: [PantryItemSchema], default: [] },
    staples: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Pantry = model<PantryDoc>("Pantry", PantrySchema);
