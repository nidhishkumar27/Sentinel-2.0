import { Schema, model } from 'mongoose';
import { pointSchema } from '../../utils/geo';
import { CATEGORIES, STATUSES } from './incident.constants';

const aiSchema = new Schema(
  {
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'unavailable'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    requestedAt: Date,
    completedAt: Date,
    error: { type: new Schema({ code: String, message: String }, { _id: false }) },
    briefing: { type: Schema.Types.Mixed }, // validated against briefingSchema before being stored
  },
  { _id: false }
);

const incidentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true }, // human-friendly id, e.g. SNT-20261014-K7M2QX
    clientRequestId: { type: String }, // idempotency key from the app (safe retries on flaky networks)
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true },
    severity: { type: String, enum: ['critical', 'high', 'medium'], required: true },
    status: { type: String, enum: STATUSES, default: 'created' },
    description: { type: String, maxlength: 1000 },
    additionalInfo: [{ _id: false, text: { type: String, maxlength: 1000 }, at: { type: Date, default: Date.now } }],

    location: { type: pointSchema, required: true },
    locationAccuracyM: Number,
    address: String,
    clientTimestamp: Date, // device time when SOS was triggered (may differ from createdAt when offline)
    trail: [{ _id: false, coordinates: [Number], accuracyM: Number, at: { type: Date, default: Date.now } }],

    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedAt: Date,
    startedAt: Date,
    resolvedAt: Date,
    resolutionNote: String,
    cancelledAt: Date,

    timeline: [
      {
        _id: false,
        status: String,
        action: String,
        note: String,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],

    // What actually happened when contacts were notified (never assume success)
    contactNotification: {
      status: { type: String, enum: ['pending', 'no_contacts', 'sent', 'partial', 'unavailable', 'failed'], default: 'pending' },
      total: Number,
      inApp: Number,
      sms: Number,
      updatedAt: Date,
    },

    ai: { type: aiSchema, default: () => ({ status: 'pending', attempts: 0 }) },
  },
  { timestamps: true }
);

incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ category: 1, createdAt: -1 });
incidentSchema.index({ updatedAt: -1 });
incidentSchema.index({ reporter: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });

export const Incident = model('Incident', incidentSchema);
