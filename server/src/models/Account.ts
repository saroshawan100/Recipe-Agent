import { Schema, model } from "mongoose";
import type { Preferences } from "../schemas/recipe.js";

export interface AccountDoc {
  email: string;
  passwordSalt: string;
  passwordHash: string;
  preferences: Preferences;
}

const AccountSchema = new Schema<AccountDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordSalt: { type: String, required: true, select: false },
    passwordHash: { type: String, required: true, select: false },
    preferences: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

export const Account = model<AccountDoc>("Account", AccountSchema);
