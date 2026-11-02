
import { toPoint } from '../../utils/geo';
import { SafetyZone } from './zone.model';

interface Opts {
  radiusM?: number;
  categories?: readonly string[];
  verifiedOnly?: boolean;
  limit?: number;
}

/** Nearest-first search with computed distance in metres. */
export async function findNearbyResources(
  lat: number,
  lng: number,
  o: Opts = {},
) {
  const query: Record<string, unknown> = {};

  if (o.categories?.length) {
    query.category = { $in: o.categories };
  }

  if (o.verifiedOnly ?? true) {
    query.verified = true;
  }

  return SafetyZone.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng, lat] as [number, number],
        },
        distanceField: 'distanceM',
        maxDistance: o.radiusM ?? 3000,
        spherical: true,
        query,
      },
    },
    { $limit: o.limit ?? 50 },
    {
      $project: {
        name: 1,
        category: 1,
        phone: 1,
        notes: 1,
        radiusM: 1,
        verified: 1,
        source: 1,
        lastVerifiedAt: 1,
        location: 1,
        distanceM: { $round: ['$distanceM', 0] },
      },
    },
  ]);
}
