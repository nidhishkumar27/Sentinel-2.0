import { Router } from 'express';
import { z } from 'zod';
import {
  authenticate,
  authorize,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  latSchema,
  lngSchema,
  objectId,
} from '../../utils/geo';
import { Incident } from '../incidents/incident.model';
import {
  getIncidentWeather,
  getWeather,
} from './weather.service';

const router = Router();

router.use(authenticate);

const q = z.object({
  lat: latSchema,
  lng: lngSchema,
});

const incidentParams = z.object({
  incidentId: objectId,
});

// Existing endpoint — keep this available.
router.get(
  '/',
  validate({ query: q }),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.query as unknown as z.infer<typeof q>;

    res.json({
      success: true,
      data: await getWeather(lat, lng),
    });
  }),
);

// New endpoint — weather at the saved incident location.
// Only authenticated authorities can access it.
router.get(
  '/incidents/:incidentId',
  authorize('authority'),
  validate({ params: incidentParams }),
  asyncHandler(async (req, res) => {
    const { incidentId } = req.params as z.infer<typeof incidentParams>;

    const incident = await Incident.findById(incidentId).select(
      'location address',
    );

    if (!incident) {
      throw new ApiError(404, 'Incident not found');
    }

    // GeoJSON Point coordinates are [longitude, latitude].
    const coordinates = incident.location?.coordinates;

    if (
      !coordinates ||
      coordinates.length !== 2 ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      throw new ApiError(
        422,
        'Incident does not have valid location coordinates',
      );
    }

    const [lng, lat] = coordinates;

    const weather = await getIncidentWeather(
      String(incident._id),
      lat,
      lng,
      incident.address ?? undefined,
    );

    res.json({
      success: true,
      data: weather,
    });
  }),
);

export default router;