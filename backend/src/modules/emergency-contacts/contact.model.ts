import { Schema, Types, model } from 'mongoose';

const contactSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export interface IEmergencyContact {
  user: Types.ObjectId;
  name: string;
  phone: string;
  relationship?: string;
  isPrimary: boolean;
}
export const EmergencyContact = model('EmergencyContact', contactSchema);
