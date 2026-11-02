
import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose';
import { pointSchema } from '../../utils/geo';

export const AUTHORITY_DEPARTMENTS = [
  'POLICE',
  'MEDICAL',
  'FIRE',
  'DISASTER',
  'OTHER',
] as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    role: {
      type: String,
      enum: ['user', 'authority'],
      default: 'user',
    },

    badgeId: { type: String, trim: true },

   department: {
  type: String,
  enum: ['POLICE', 'MEDICAL', 'FIRE', 'DISASTER', 'OTHER'],
  required: function (this: any) {
    return this.role === 'authority';
  },
},

    isActive: { type: Boolean, default: true },
    lastLocation: { type: pointSchema },
    lastLocationAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export type IUser = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<IUser>;

export const User = model('User', userSchema);
