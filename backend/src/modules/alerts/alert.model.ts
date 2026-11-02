import { Schema, model } from 'mongoose';
import { pointSchema } from '../../utils/geo';

const alertSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, maxlength: 1000 },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    center: { type: pointSchema }, // optional: omit for city-wide alerts
    radiusM: { type: Number, min: 50, max: 50000 },
    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
alertSchema.index({ center: '2dsphere' });

export const Alert = model('Alert', alertSchema);
