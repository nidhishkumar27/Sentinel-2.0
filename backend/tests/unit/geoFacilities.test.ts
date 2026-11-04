import { describe, expect, it } from 'vitest';
import { formatReverse, formatSearch, resolveGeocoderUserAgent } from '../../src/modules/geo/geocoder.service';
import { buildOverpassQuery, osmElementToZone } from '../../src/modules/safety-map/facilities.import';

describe('geocoder formatting', () => {
  it('formats a reverse result and rejects error payloads', () => {
    expect(formatReverse({ display_name: 'MG Road, Bengaluru', address: { road: 'MG Road' } })).toEqual({ label: 'MG Road, Bengaluru', address: { road: 'MG Road' } });
    expect(formatReverse({ error: 'Unable to geocode' })).toBeNull();
    expect(formatReverse(null)).toBeNull();
  });
  it('formats search results and drops rows without usable coordinates', () => {
    const r = formatSearch([{ display_name: 'A', lat: '12.9', lon: '77.6', type: 'city' }, { display_name: 'B', lat: 'x', lon: '1' }, { lat: '1', lon: '1' }]);
    expect(r).toEqual([{ label: 'A', lat: 12.9, lng: 77.6, type: 'city' }]);
    expect(formatSearch(undefined)).toEqual([]);
  });
  it('replaces placeholder User-Agents that Nominatim blocks with 403', () => {
    expect(resolveGeocoderUserAgent('SentinelSafetyPlatform/2.0 (you@example.com)')).toBe('SentinelSafetyPlatform/2.0');
    expect(resolveGeocoderUserAgent('SentinelSafetyPlatform/2.0 (admin@example.org)')).toBe('SentinelSafetyPlatform/2.0');
    expect(resolveGeocoderUserAgent('SentinelSafetyPlatform/2.0 (team@realmail.in)')).toBe('SentinelSafetyPlatform/2.0 (team@realmail.in)');
    expect(resolveGeocoderUserAgent('SentinelSafetyPlatform/2.0')).toBe('SentinelSafetyPlatform/2.0');
  });
});

describe('OSM facility mapping', () => {
  it('maps amenities to our categories', () => {
    expect(osmElementToZone({ type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'hospital', name: 'City Hospital', phone: '108' } })).toMatchObject({ externalId: 'node/1', category: 'hospital', name: 'City Hospital', phone: '108' });
    expect(osmElementToZone({ type: 'way', id: 2, center: { lat: 3, lon: 4 }, tags: { amenity: 'police' } })).toMatchObject({ externalId: 'way/2', category: 'police_station', lat: 3, lng: 4 });
    expect(osmElementToZone({ type: 'node', id: 3, lat: 1, lon: 1, tags: { amenity: 'fire_station' } })!.name).toBe('Unnamed fire station');
    expect(osmElementToZone({ type: 'node', id: 4, lat: 1, lon: 1, tags: { emergency: 'assembly_point' } })!.category).toBe('safe_shelter');
  });
  it('skips elements it cannot place or classify', () => {
    expect(osmElementToZone({ type: 'node', id: 5, tags: { amenity: 'hospital' } })).toBeNull();
    expect(osmElementToZone({ type: 'node', id: 6, lat: 1, lon: 1, tags: { amenity: 'cafe' } })).toBeNull();
  });
  it('builds an Overpass query around the point', () => {
    const q = buildOverpassQuery(12.9, 77.6, 5000);
    expect(q).toContain('around:5000,12.9,77.6');
    expect(q).toContain('out center tags');
  });
});
