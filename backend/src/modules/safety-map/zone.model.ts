import { Schema, model } from 'mongoose';
import { pointSchema } from '../../utils/geo';

export const ZONE_CATEGORIES = ['police_station', 'hospital', 'fire_station', 'safe_shelter', 'high_risk', 'caution'] as const;
export const FACILITY_CATEGORIES = ['police_station', 'hospital', 'fire_station', 'safe_shelter'] as const;

const zoneSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ZONE_CATEGORIES, required: true, index: true },
    location: { type: pointSchema, required: true },
    radiusM: { type: Number, default: 200 },
    phone: { type: String },
    notes: { type: String, maxlength: 500 },
    // provenance: the frontend must only show verified data as fact
    verified: { type: Boolean, default: false, index: true },
    source: { type: String, default: 'authority' }, // authority | osm | official_dataset ...
    externalId: { type: String }, // e.g. "node/123456" for OSM imports (makes imports idempotent)
    lastVerifiedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
zoneSchema.index({ location: '2dsphere' });
zoneSchema.index({ source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });

export const SafetyZone = model('SafetyZone', zoneSchema);
