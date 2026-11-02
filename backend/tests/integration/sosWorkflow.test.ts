import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';

const api = '/api/v1';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const where = { lat: 12.9141, lng: 74.856 };

let mongod: MongoMemoryServer;
let user: any, stranger: any, officer: any, officer2: any;
let incidentId: string;

async function register(body: Record<string, unknown>) {
  const res = await request(app).post(`${api}/auth/register`).send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}
async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v as T;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timed out');
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const pw = 'Passw0rd!123';
  user = await register({ name: 'Asha', email: 'asha@test.dev', phone: '+911111111111', password: pw });
  stranger = await register({ name: 'Ravi', email: 'ravi@test.dev', phone: '+912222222222', password: pw });
  officer = await register({ name: 'Officer One', email: 'o1@test.dev', phone: '+913333333333', password: pw, inviteCode: 'test-invite', badgeId: 'B-1' });
  officer2 = await register({ name: 'Officer Two', email: 'o2@test.dev', phone: '+914444444444', password: pw, inviteCode: 'test-invite', badgeId: 'B-2' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('auth', () => {
  it('assigns roles correctly and rejects a wrong invite code', async () => {
    expect(user.user.role).toBe('user');
    expect(officer.user.role).toBe('authority');
    const bad = await request(app).post(`${api}/auth/register`).send({ name: 'X Y', email: 'x@test.dev', phone: '+915555555555', password: 'Passw0rd!123', inviteCode: 'nope' });
    expect(bad.status).toBe(403);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const first = user.refreshToken;
    const r1 = await request(app).post(`${api}/auth/refresh`).send({ refreshToken: first });
    expect(r1.status).toBe(200);
    user.accessToken = r1.body.data.accessToken;
    const replay = await request(app).post(`${api}/auth/refresh`).send({ refreshToken: first });
    expect(replay.status).toBe(401);
    // the whole session is revoked after reuse
    const afterReuse = await request(app).post(`${api}/auth/refresh`).send({ refreshToken: r1.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });
});

describe('SOS → authority workflow', () => {
  it('records an SOS even though the AI engine and weather provider are down', async () => {
    const res = await request(app)
      .post(`${api}/incidents`)
      .set(bearer(user.accessToken))
      .send({ category: 'medical', description: 'Feeling faint', ...where, accuracyM: 12, clientRequestId: 'req-abc-12345' });
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^SNT-/);
    expect(res.body.data.status).toBe('created');
    expect(res.body.data.severity).toBe('critical');
    incidentId = res.body.data.id;
  });

  it('is idempotent for the same clientRequestId and for an already-open incident', async () => {
    const again = await request(app).post(`${api}/incidents`).set(bearer(user.accessToken)).send({ category: 'medical', ...where, clientRequestId: 'req-abc-12345' });
    expect(again.status).toBe(200);
    expect(again.body.meta.duplicate).toBe(true);
    expect(again.body.data.id).toBe(incidentId);
  });

  it('AI enrichment degrades to "unavailable" without affecting the incident', async () => {
    const final = await waitFor(async () => {
      const r = await request(app).get(`${api}/incidents/${incidentId}`).set(bearer(officer.accessToken));
      return ['unavailable', 'failed'].includes(r.body.data.ai.status) ? r.body.data : undefined;
    });
    expect(final.status).toBe('created');
    expect(final.ai.briefing).toBeNull();
  });

  it('lets an authority see the incident but hides the reporter phone', async () => {
    const list = await request(app).get(`${api}/incidents?category=medical`).set(bearer(officer.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data[0].id).toBe(incidentId);
    expect(list.body.data[0].reporter.phone).toBeUndefined();
  });

  it('blocks unauthorised access', async () => {
    expect((await request(app).get(`${api}/incidents/${incidentId}`)).status).toBe(401);
    expect((await request(app).get(`${api}/incidents/${incidentId}`).set(bearer(stranger.accessToken))).status).toBe(403);
    expect((await request(app).get(`${api}/incidents`).set(bearer(user.accessToken))).status).toBe(403);
    expect((await request(app).patch(`${api}/incidents/${incidentId}/acknowledge`).set(bearer(user.accessToken))).status).toBe(403);
  });

  it('enforces the lifecycle', async () => {
    const skip = await request(app).patch(`${api}/incidents/${incidentId}/status`).set(bearer(officer.accessToken)).send({ status: 'in_progress' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_TRANSITION');

    const ack = await request(app).patch(`${api}/incidents/${incidentId}/acknowledge`).set(bearer(officer.accessToken));
    expect(ack.status).toBe(200);
    expect(ack.body.data.status).toBe('acknowledged');

    const early = await request(app).get(`${api}/incidents/${incidentId}/responder-info`).set(bearer(officer.accessToken));
    expect(early.status).toBe(403); // not assigned yet

    const assign = await request(app).patch(`${api}/incidents/${incidentId}/assign`).set(bearer(officer.accessToken)).send({ assigneeId: officer.user._id });
    expect(assign.status).toBe(200);
    expect(assign.body.data.reporter.phone).toBe('+911111111111'); // visible to the assignee only

    const notMine = await request(app).patch(`${api}/incidents/${incidentId}/status`).set(bearer(officer2.accessToken)).send({ status: 'in_progress' });
    expect(notMine.status).toBe(403);
    expect(notMine.body.error.code).toBe('NOT_ASSIGNEE');

    const info = await request(app).get(`${api}/incidents/${incidentId}/responder-info`).set(bearer(officer.accessToken));
    expect(info.status).toBe(200);

    const start = await request(app).patch(`${api}/incidents/${incidentId}/status`).set(bearer(officer.accessToken)).send({ status: 'in_progress' });
    expect(start.body.data.status).toBe('in_progress');
    const done = await request(app).patch(`${api}/incidents/${incidentId}/status`).set(bearer(officer.accessToken)).send({ status: 'resolved', note: 'Patient handed to ambulance' });
    expect(done.body.data.status).toBe('resolved');

    const cancelResolved = await request(app).patch(`${api}/incidents/${incidentId}/cancel`).set(bearer(user.accessToken));
    expect(cancelResolved.status).toBe(409);
  });

  it('shows the reporter their own status without responder identity', async () => {
    const r = await request(app).get(`${api}/incidents/${incidentId}`).set(bearer(user.accessToken));
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('resolved');
    expect(r.body.data.responderAssigned).toBe(true);
    expect(JSON.stringify(r.body.data)).not.toContain('Officer One');
    expect(r.body.data.contactNotification.status).toBeDefined();
  });

  it('keeps a full audit history', async () => {
    const h = await request(app).get(`${api}/incidents/${incidentId}/history`).set(bearer(officer.accessToken));
    expect(h.status).toBe(200);
    const actions = h.body.data.audit.map((a: any) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['incident.create', 'incident.acknowledge', 'incident.assign', 'incident.resolved']));
  });

  it('returns the unified error shape', async () => {
    const r = await request(app).get(`${api}/nope`);
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ success: false, error: { code: 'ROUTE_NOT_FOUND' } });
    expect(r.body.requestId).toBeTruthy();
  });
});
