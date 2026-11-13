const {
  generateAvailableSlots,
  hasScheduleConflict,
  getDayOfWeekName
} = require('../src/engine/scheduler');

describe('BookEase Scheduler Engine', () => {
  const mockProvider = {
    id: 'prov_1',
    name: 'Dr. Sarah Smith',
    availability_json: JSON.stringify({
      Monday: { start: '09:00', end: '12:00' }, // 180 minutes
      Tuesday: { start: '14:00', end: '18:00' }
    })
  };

  const mockService = {
    id: 'srv_1',
    name: 'Consultation',
    duration_minutes: 45,
    buffer_minutes: 15 // total step 60 mins
  };

  test('getDayOfWeekName returns correct day', () => {
    // 2026-11-16 is a Monday
    expect(getDayOfWeekName('2026-11-16')).toBe('Monday');
    // 2026-11-17 is a Tuesday
    expect(getDayOfWeekName('2026-11-17')).toBe('Tuesday');
    // 2026-11-18 is a Wednesday
    expect(getDayOfWeekName('2026-11-18')).toBe('Wednesday');
  });

  test('generateAvailableSlots creates non-overlapping intervals within shift', () => {
    const slots = generateAvailableSlots(mockProvider, mockService, '2026-11-16', []);
    // 09:00 to 12:00 (180 mins) with 60 min step = 3 slots:
    // Slot 1: 09:00 - 09:45
    // Slot 2: 10:00 - 10:45
    // Slot 3: 11:00 - 11:45
    expect(slots.length).toBe(3);
    expect(slots[0].start_time).toBe('2026-11-16T09:00:00Z');
    expect(slots[0].end_time).toBe('2026-11-16T09:45:00Z');
    expect(slots[1].start_time).toBe('2026-11-16T10:00:00Z');
    expect(slots[2].start_time).toBe('2026-11-16T11:00:00Z');
  });

  test('generateAvailableSlots filters out conflicting appointments', () => {
    const existing = [
      {
        id: 'appt_1',
        start_time: '2026-11-16T10:00:00Z',
        end_time: '2026-11-16T10:45:00Z',
        status: 'CONFIRMED'
      }
    ];

    const slots = generateAvailableSlots(mockProvider, mockService, '2026-11-16', existing);
    expect(slots.length).toBe(2);
    expect(slots.map(s => s.start_time)).not.toContain('2026-11-16T10:00:00Z');
  });

  test('generateAvailableSlots returns empty array on off days', () => {
    // Wednesday is not in mockProvider's availability
    const slots = generateAvailableSlots(mockProvider, mockService, '2026-11-18', []);
    expect(slots).toEqual([]);
  });

  test('hasScheduleConflict correctly detects collisions', () => {
    const existing = [
      {
        id: 'a1',
        start_time: '2026-11-16T10:00:00Z',
        end_time: '2026-11-16T10:45:00Z',
        status: 'CONFIRMED'
      }
    ];

    // Overlapping start inside interval
    expect(hasScheduleConflict('2026-11-16T10:15:00Z', '2026-11-16T11:00:00Z', existing)).toBe(true);

    // Completely before interval
    expect(hasScheduleConflict('2026-11-16T09:00:00Z', '2026-11-16T09:45:00Z', existing)).toBe(false);

    // Cancelled appointments should not conflict
    const cancelled = [
      {
        id: 'a2',
        start_time: '2026-11-16T10:00:00Z',
        end_time: '2026-11-16T10:45:00Z',
        status: 'CANCELLED'
      }
    ];
    expect(hasScheduleConflict('2026-11-16T10:00:00Z', '2026-11-16T10:45:00Z', cancelled)).toBe(false);
  });
});
