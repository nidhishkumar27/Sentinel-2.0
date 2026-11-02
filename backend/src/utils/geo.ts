import { Schema } from 'mongoose';
import { z } from 'zod';

export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

export const toPoint = (lat: number, lng: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });

export const latSchema = z.coerce.number().min(-90).max(90);
export const lngSchema = z.coerce.number().min(-180).max(180);
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
