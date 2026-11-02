# MongoDB schema (Mongoose)

| Collection | Key fields | Indexes |
|---|---|---|
| `users` | name, email, phone, passwordHash (select:false), role, badgeId, isActive, lastLocation | `email` unique, `phone` |
| `refreshtokens` | user, tokenHash (sha256), family, expiresAt, revokedAt | `tokenHash` unique, `family`, TTL on `expiresAt` |
| `incidents` | reference, clientRequestId, reporter, category, severity, status, description, additionalInfo[], location(Point), locationAccuracyM, clientTimestamp, trail[≤100], acknowledgedBy/At, assignedTo/At, startedAt, resolvedAt, resolutionNote, timeline[], contactNotification{}, ai{status,attempts,requestedAt,completedAt,error,briefing} | `reference` unique; `location` 2dsphere; `{status,createdAt}`; `{category,createdAt}`; `updatedAt`; `{reporter,clientRequestId}` unique partial |
| `auditlogs` | actor, actorRole, action, targetType, targetId, ip, requestId, meta, createdAt | `{targetType,targetId,createdAt}`, `action`, `actor` |
| `emergencycontacts` | user, name, phone, relationship, isPrimary | `user` |
| `digitalids` | user (unique), fullName, DOB, bloodGroup, allergies, medicalConditions, govIdLast4, shareToken, shareEnabled, shareExpiresAt | `user`, `shareToken` unique sparse |
| `safetyzones` | name, category, location, radiusM, phone, verified, source, lastVerifiedAt | `location` 2dsphere, `category`, `verified` |
| `alerts` | title, message, severity, center, radiusM, active, expiresAt, createdBy | `center` 2dsphere, `active` |
| `notifications` | user, type, title, body, data, read | `user` |

Notes: coordinates are GeoJSON `[lng, lat]`. Only the last 4 digits of a government ID are stored. Weather is not stored (cached in memory with provider timestamp). Audit logs are append-only.
