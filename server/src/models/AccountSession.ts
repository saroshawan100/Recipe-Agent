import { Schema, model } from "mongoose";

export interface AccountSessionDoc {
  tokenHash: string;
  accountId: string;
  expiresAt: Date;
}

const AccountSessionSchema = new Schema<AccountSessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    accountId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export const AccountSession = model<AccountSessionDoc>("AccountSession", AccountSessionSchema);
