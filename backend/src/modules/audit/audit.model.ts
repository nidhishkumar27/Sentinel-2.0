import { Schema, model } from 'mongoose';

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true }, // e.g. incident.assign
    targetType: { type: String },
    targetId: { type: String },
    ip: { type: String },
    requestId: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const AuditLog = model('AuditLog', auditSchema);
