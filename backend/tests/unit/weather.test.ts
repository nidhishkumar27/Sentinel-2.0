import { describe, expect, it } from 'vitest';
import { Current, deriveAdvisories } from '../../src/modules/weather/weather.service';

const calm: Current = { temperatureC: 28, apparentC: 30, precipitationMm: 0, windSpeedKmh: 10, windGustKmh: 15, weatherCode: 1, summary: 'Partly cloudy' };

describe('weather advisories', () => {
  it('returns nothing for calm weather', () => expect(deriveAdvisories(calm)).toEqual([]));

  it('flags thunderstorms, heavy rain and gusts with severity', () => {
    const a = deriveAdvisories({ ...calm, weatherCode: 96, precipitationMm: 9, windGustKmh: 70 });
    expect(a.map((x) => x.type).sort()).toEqual(['heavy_rain', 'high_wind', 'thunderstorm']);
    expect(a.find((x) => x.type === 'thunderstorm')!.severity).toBe('severe');
    expect(a.find((x) => x.type === 'heavy_rain')!.severity).toBe('warning');
  });

  it('labels every advisory as derived (not an official warning)', () => {
    expect(deriveAdvisories({ ...calm, apparentC: 42 }).every((x) => x.origin === 'derived')).toBe(true);
  });

  it('handles missing provider values', () => {
    expect(deriveAdvisories({ ...calm, precipitationMm: null, windGustKmh: null, apparentC: null, weatherCode: null })).toEqual([]);
  });
});
