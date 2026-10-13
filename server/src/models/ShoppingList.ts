import { Schema, model } from "mongoose";

export interface ShoppingQuantity {
  amount: number | null;
  unit: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  aisle: string;
  quantities: ShoppingQuantity[];
  checked: boolean;
  recipes: { id: string; title: string }[];
  addedAt: Date;
}

export interface ShoppingListDoc {
  clientId: string;
  items: ShoppingItem[];
}

const ShoppingItemSchema = new Schema<ShoppingItem>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    aisle: { type: String, default: "Other" },
    quantities: {
      type: [new Schema<ShoppingQuantity>({ amount: Number, unit: String }, { _id: false })],
      default: [],
    },
    checked: { type: Boolean, default: false },
    recipes: {
      type: [new Schema({ id: String, title: String }, { _id: false })],
      default: [],
    },
    addedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ShoppingListSchema = new Schema<ShoppingListDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    items: { type: [ShoppingItemSchema], default: [] },
  },
  { timestamps: true },
);

export const ShoppingList = model<ShoppingListDoc>("ShoppingList", ShoppingListSchema);
