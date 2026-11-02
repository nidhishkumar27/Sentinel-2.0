import { Schema, model } from 'mongoose';

const digitalIdSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, trim: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    allergies: [{ type: String, trim: true }],
    medicalConditions: [{ type: String, trim: true }],
    govIdType: { type: String, trim: true }, // e.g. Aadhaar, Passport
    govIdLast4: { type: String, match: /^\d{4}$/ }, // never store the full ID number
    photoUrl: { type: String },
    shareToken: { type: String, unique: true, sparse: true },
    shareEnabled: { type: Boolean, default: false },
    shareExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const DigitalId = model('DigitalId', digitalIdSchema);
