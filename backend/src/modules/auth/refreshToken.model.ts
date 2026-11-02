import { Schema, model } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true }, // one login session = one family
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-clean

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
