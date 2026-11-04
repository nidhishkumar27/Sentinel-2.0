import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { SafetyZone } from '../../src/modules/safety-map/zone.model';
import { toPoint } from '../../src/utils/geo';

const api = '/api/v1';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const spot = { lat: 12.9141, lng: 74.856 };
let mongod: MongoMemoryServer;
let user: any, officer: any;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const pw = 'Passw0rd!123';
  user = (await request(app).post(`${api}/auth/register`).send({ name: 'Asha', email: 'a@t.dev', phone: '+911111111111', password: pw })).body.data;
  officer = (await request(app).post(`${api}/auth/register`).send({ name: 'Officer', email: 'o@t.dev', phone: '+913333333333', password: pw, inviteCode: 'test-invite', department: 'POLICE' })).body.data;
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('geocoding', () => {
  it('requires login and degrades to a stable 503 code when the provider is down', async () => {
    expect((await request(app).get(`${api}/geo/reverse?lat=12.9&lng=77.6`)).status).toBe(401);
    const r = await request(app).get(`${api}/geo/reverse?lat=12.9&lng=77.6`).set(bearer(user.accessToken));
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('GEOCODER_UNAVAILABLE');
  });
  it('validates input', async () => {
    expect((await request(app).get(`${api}/geo/search?q=ab`).set(bearer(user.accessToken))).status).toBe(400);
  });
});

describe('push', () => {
  it('reports disabled when VAPID keys are not configured, and stores subscriptions', async () => {
    const k = await request(app).get(`${api}/push/public-key`).set(bearer(officer.accessToken));
    expect(k.body.data).toEqual({ enabled: false, publicKey: null });
    const body = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p256dh-key-value', auth: 'auth-secret' } };
    expect((await request(app).post(`${api}/push/subscribe`).set(bearer(officer.accessToken)).send(body)).status).toBe(201);
    expect((await request(app).delete(`${api}/push/subscribe`).set(bearer(officer.accessToken)).send({ endpoint: body.endpoint })).status).toBe(200);
  });
});

describe('facilities', () => {
  it('import is authority-only and reports a source outage cleanly', async () => {
    expect((await request(app).post(`${api}/safety-map/import`).set(bearer(user.accessToken)).send({ ...spot })).status).toBe(403);
    const r = await request(app).post(`${api}/safety-map/import`).set(bearer(officer.accessToken)).send({ ...spot });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('FACILITY_SOURCE_UNAVAILABLE');
  });

  it('keeps unverified facilities out of default results until an authority verifies them', async () => {
    const zone = await SafetyZone.create({ name: 'Test Hospital', category: 'hospital', location: toPoint(spot.lat, spot.lng), verified: false, source: 'osm', externalId: 'node/1' });
    const q = `lat=${spot.lat}&lng=${spot.lng}&radius=1000`;
    expect((await request(app).get(`${api}/safety-map/nearby?${q}`).set(bearer(user.accessToken))).body.data).toHaveLength(0);
    expect((await request(app).get(`${api}/safety-map/nearby?${q}&verifiedOnly=false`).set(bearer(user.accessToken))).body.data).toHaveLength(1);

    expect((await request(app).patch(`${api}/safety-map/zones/${zone._id}/verify`).set(bearer(user.accessToken))).status).toBe(403);
    expect((await request(app).patch(`${api}/safety-map/zones/${zone._id}/verify`).set(bearer(officer.accessToken))).status).toBe(200);

    const after = await request(app).get(`${api}/safety-map/nearby?${q}`).set(bearer(user.accessToken));
    expect(after.body.data).toHaveLength(1);
    expect(after.body.data[0]).toMatchObject({ name: 'Test Hospital', verified: true });
  });
});
