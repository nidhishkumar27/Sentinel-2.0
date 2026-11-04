import { describe, expect, it } from 'vitest';
import { deriveHazards, formatEarthquakes } from '../../src/modules/alerts/hazards.service';

describe('formatEarthquakes', () => {
  it('maps USGS features to hazard alerts with distance and severity', () => {
    const raw = {
      features: [
        {
          id: 'eq1',
          properties: { mag: 5.4, place: '10km SSW of Example Town', time: 1700000000000 },
          geometry: { coordinates: [77.2, 28.6, 33] },
        },
        {
          id: 'bad',
          properties: { mag: null, place: 'nowhere', time: 1700000000000 },
          geometry: { coordinates: [77.2, 28.6, 10] },
        },
      ],
    };
    const alerts = formatEarthquakes(raw, 28.61, 77.21);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].category).toBe('EARTHQUAKE');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].magnitude).toBe(5.4);
    expect(alerts[0].depthKm).toBe(33);
    expect(alerts[0].distanceKm).toBeLessThan(5);
    expect(alerts[0].source).toContain('USGS');
  });

  it('returns an empty list for malformed payloads', () => {
    expect(formatEarthquakes(null, 0, 0)).toEqual([]);
    expect(formatEarthquakes({ features: 'nope' }, 0, 0)).toEqual([]);
  });
});

describe('deriveHazards', () => {
  it('derives flood, landslide and cyclone indicators from a severe forecast', () => {
    const alerts = deriveHazards(
      {
        hourlyForecast: Array.from({ length: 24 }, () => ({ precipitationMm: 3 })),
        dailyForecast: [
          { precipitationSumMm: 110, windGustMaxKmh: 95, temperatureMaxC: 31, weatherCode: 96 },
        ],
      },
      'Example Valley',
    );
    const categories = alerts.map((a) => a.category);
    expect(categories).toContain('FLOOD');
    expect(categories).toContain('LANDSLIDE');
    expect(categories).toContain('CYCLONE');
    expect(alerts.every((a) => a.source.includes('Sentinel-derived'))).toBe(true);
    expect(alerts.find((a) => a.category === 'FLOOD')?.severity).toBe('SEVERE');
  });

  it('derives nothing from a calm forecast', () => {
    const alerts = deriveHazards(
      {
        hourlyForecast: [{ precipitationMm: 0 }],
        dailyForecast: [
          { precipitationSumMm: 2, windGustMaxKmh: 20, temperatureMaxC: 28, weatherCode: 1 },
        ],
      },
      'Calm Town',
    );
    expect(alerts).toEqual([]);
  });
});
