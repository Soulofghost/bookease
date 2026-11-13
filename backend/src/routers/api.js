const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { generateAvailableSlots, hasScheduleConflict } = require('../engine/scheduler');

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'BookEase',
    version: '1.0.0'
  });
});

// Services CRUD
router.get('/api/services', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM services ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/api/services', (req, res) => {
  const db = getDb();
  const { name, category, duration_minutes, buffer_minutes, price, currency, description } = req.body;

  if (!name || !category || !duration_minutes) {
    return res.status(400).json({ error: 'name, category, and duration_minutes are required' });
  }

  const id = uuidv4();
  const query = `
    INSERT INTO services (id, name, category, duration_minutes, buffer_minutes, price, currency, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, name, category, parseInt(duration_minutes, 10),
    parseInt(buffer_minutes || 15, 10), parseFloat(price || 0.0),
    currency || 'USD', description || ''
  ];

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM services WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

// Providers CRUD
router.get('/api/providers', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM providers ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formatted = rows.map(r => ({
      ...r,
      availability: JSON.parse(r.availability_json || '{}')
    }));
    res.json(formatted);
  });
});

router.post('/api/providers', (req, res) => {
  const db = getDb();
  const { name, email, specialization, availability } = req.body;

  if (!name || !email || !specialization) {
    return res.status(400).json({ error: 'name, email, and specialization are required' });
  }

  const id = uuidv4();
  const availabilityJson = JSON.stringify(availability || {
    Monday: { start: '09:00', end: '17:00' },
    Tuesday: { start: '09:00', end: '17:00' },
    Wednesday: { start: '09:00', end: '17:00' },
    Thursday: { start: '09:00', end: '17:00' },
    Friday: { start: '09:00', end: '17:00' }
  });

  const query = `
    INSERT INTO providers (id, name, email, specialization, availability_json)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(query, [id, name, email, specialization, availabilityJson], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM providers WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json({
        ...row,
        availability: JSON.parse(row.availability_json)
      });
    });
  });
});

// Query Open Available Slots
router.get('/api/slots', (req, res) => {
  const db = getDb();
  const { provider_id, service_id, date } = req.query;

  if (!provider_id || !service_id || !date) {
    return res.status(400).json({ error: 'provider_id, service_id, and date (YYYY-MM-DD) are required' });
  }

  db.get('SELECT * FROM providers WHERE id = ?', [provider_id], (errP, provider) => {
    if (errP || !provider) return res.status(404).json({ error: 'Provider not found' });

    db.get('SELECT * FROM services WHERE id = ?', [service_id], (errS, service) => {
      if (errS || !service) return res.status(404).json({ error: 'Service not found' });

      // Retrieve existing appointments for this provider
      db.all(
        "SELECT * FROM appointments WHERE provider_id = ? AND status != 'CANCELLED'",
        [provider_id],
        (errA, appointments) => {
          if (errA) return res.status(500).json({ error: errA.message });

          const slots = generateAvailableSlots(provider, service, date, appointments);
          res.json({
            date,
            provider_id,
            service_id,
            available_slots_count: slots.length,
            slots
          });
        }
      );
    });
  });
});

// Create Appointment
router.post('/api/appointments', (req, res) => {
  const db = getDb();
  const {
    service_id, provider_id, customer_name, customer_email,
    customer_phone, start_time, end_time, notes
  } = req.body;

  if (!service_id || !provider_id || !customer_name || !customer_email || !start_time || !end_time) {
    return res.status(400).json({ error: 'service_id, provider_id, customer_name, customer_email, start_time, end_time are required' });
  }

  // Double-booking check
  db.all(
    "SELECT * FROM appointments WHERE provider_id = ? AND status != 'CANCELLED'",
    [provider_id],
    (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });

      if (hasScheduleConflict(start_time, end_time, existing)) {
        return res.status(409).json({
          error: 'Schedule Conflict: Selected appointment slot overlaps with an existing booking.'
        });
      }

      const id = uuidv4();
      const insertSql = `
        INSERT INTO appointments (
          id, service_id, provider_id, customer_name, customer_email, customer_phone,
          start_time, end_time, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
      `;

      db.run(
        insertSql,
        [id, service_id, provider_id, customer_name, customer_email, customer_phone || '', start_time, end_time, notes || ''],
        function (errInsert) {
          if (errInsert) return res.status(500).json({ error: errInsert.message });
          db.get('SELECT * FROM appointments WHERE id = ?', [id], (errGet, row) => {
            if (errGet) return res.status(500).json({ error: errGet.message });
            res.status(201).json(row);
          });
        }
      );
    }
  );
});

// List Appointments
router.get('/api/appointments', (req, res) => {
  const db = getDb();
  const { provider_id, status } = req.query;

  let sql = `
    SELECT a.*, s.name as service_name, s.price as service_price, p.name as provider_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN providers p ON a.provider_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (provider_id) {
    sql += ' AND a.provider_id = ?';
    params.push(provider_id);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.start_time ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Update Appointment Status
router.patch('/api/appointments/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  if (!['CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be CONFIRMED, CANCELLED, or COMPLETED' });
  }

  db.run('UPDATE appointments SET status = ? WHERE id = ?', [status, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Appointment not found' });

    db.get('SELECT * FROM appointments WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

// Analytics Summary
router.get('/api/analytics/booking-summary', (req, res) => {
  const db = getDb();
  const summary = {};

  db.get('SELECT COUNT(*) as total FROM appointments', [], (err1, r1) => {
    if (err1) return res.status(500).json({ error: err1.message });
    summary.total_appointments = r1.total;

    db.get("SELECT COUNT(*) as confirmed FROM appointments WHERE status = 'CONFIRMED'", [], (err2, r2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      summary.confirmed_count = r2.confirmed;

      db.get("SELECT COUNT(*) as completed FROM appointments WHERE status = 'COMPLETED'", [], (err3, r3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        summary.completed_count = r3.completed;

        db.get("SELECT COUNT(*) as cancelled FROM appointments WHERE status = 'CANCELLED'", [], (err4, r4) => {
          if (err4) return res.status(500).json({ error: err4.message });
          summary.cancelled_count = r4.cancelled;

          summary.cancellation_rate = summary.total_appointments > 0
            ? Math.round((summary.cancelled_count / summary.total_appointments) * 1000) / 10
            : 0.0;

          db.get("SELECT COUNT(*) as services_count FROM services", [], (err5, r5) => {
            if (err5) return res.status(500).json({ error: err5.message });
            summary.total_services = r5.services_count;

            db.get("SELECT COUNT(*) as providers_count FROM providers", [], (err6, r6) => {
              if (err6) return res.status(500).json({ error: err6.message });
              summary.total_providers = r6.providers_count;
              res.json(summary);
            });
          });
        });
      });
    });
  });
});

module.exports = router;
