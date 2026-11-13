const request = require('supertest');
const { initDb, getDb } = require('../src/database');

process.env.BOOKEASE_DB_PATH = ':memory:';
const app = require('../src/app');

describe('BookEase REST API & Booking Lifecycle', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll((done) => {
    const db = getDb();
    db.close(done);
  });

  let createdServiceId = '';
  let createdProviderId = '';
  let createdAppointmentId = '';

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('BookEase');
  });

  test('POST /api/services creates a service', async () => {
    const payload = {
      name: 'Executive Health Audit',
      category: 'Healthcare',
      duration_minutes: 60,
      buffer_minutes: 15,
      price: 250.0,
      currency: 'USD',
      description: 'Comprehensive physical & preventative health review'
    };

    const res = await request(app).post('/api/services').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(payload.name);
    createdServiceId = res.body.id;
  });

  test('POST /api/providers creates a provider with availability', async () => {
    const payload = {
      name: 'Dr. Evelyn Vance',
      email: 'evelyn.vance@clinic.org',
      specialization: 'Preventative Medicine',
      availability: {
        Monday: { start: '09:00', end: '17:00' },
        Wednesday: { start: '09:00', end: '17:00' },
        Friday: { start: '09:00', end: '13:00' }
      }
    };

    const res = await request(app).post('/api/providers').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe(payload.email);
    createdProviderId = res.body.id;
  });

  test('GET /api/slots returns open time slots', async () => {
    // 2026-11-16 is a Monday
    const res = await request(app).get(
      `/api/slots?provider_id=${createdProviderId}&service_id=${createdServiceId}&date=2026-11-16`
    );
    expect(res.status).toBe(200);
    expect(res.body.available_slots_count).toBeGreaterThan(0);
    expect(res.body.slots[0].start_time).toBe('2026-11-16T09:00:00Z');
  });

  test('POST /api/appointments creates a confirmed booking', async () => {
    const payload = {
      service_id: createdServiceId,
      provider_id: createdProviderId,
      customer_name: 'Alvin Vance',
      customer_email: 'alvin.vance@example.com',
      customer_phone: '+1-555-0199',
      start_time: '2026-11-16T09:00:00Z',
      end_time: '2026-11-16T10:00:00Z',
      notes: 'First time visit'
    };

    const res = await request(app).post('/api/appointments').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('CONFIRMED');
    createdAppointmentId = res.body.id;
  });

  test('POST /api/appointments prevents double-booking conflict (409)', async () => {
    const conflictingPayload = {
      service_id: createdServiceId,
      provider_id: createdProviderId,
      customer_name: 'Marcus Chen',
      customer_email: 'marcus@example.com',
      start_time: '2026-11-16T09:30:00Z', // overlaps 09:00-10:00
      end_time: '2026-11-16T10:30:00Z'
    };

    const res = await request(app).post('/api/appointments').send(conflictingPayload);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Schedule Conflict');
  });

  test('PATCH /api/appointments/:id/status updates booking lifecycle', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${createdAppointmentId}/status`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  test('GET /api/analytics/booking-summary returns metrics', async () => {
    const res = await request(app).get('/api/analytics/booking-summary');
    expect(res.status).toBe(200);
    expect(res.body.total_appointments).toBe(1);
    expect(res.body.completed_count).toBe(1);
    expect(res.body.total_services).toBe(1);
    expect(res.body.total_providers).toBe(1);
  });
});
