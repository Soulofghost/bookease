/**
 * Scheduling Engine for BookEase
 * Manages calendar intervals, provider weekly availability, buffer intervals,
 * and double-booking conflict detection.
 */

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function getDayOfWeekName(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getUTCDay()];
}

function generateAvailableSlots(provider, service, targetDateStr, existingAppointments = []) {
  let availabilitySchedule = {};
  try {
    availabilitySchedule = typeof provider.availability_json === 'string'
      ? JSON.parse(provider.availability_json)
      : provider.availability_json;
  } catch (e) {
    availabilitySchedule = {};
  }

  const dayName = getDayOfWeekName(targetDateStr);
  const dayShift = availabilitySchedule[dayName];
  if (!dayShift || !dayShift.start || !dayShift.end) {
    return [];
  }

  const shiftStartMin = parseTime(dayShift.start);
  const shiftEndMin = parseTime(dayShift.end);

  const duration = parseInt(service.duration_minutes, 10) || 30;
  const buffer = parseInt(service.buffer_minutes, 10) || 0;
  const step = duration + buffer;

  const validExisting = existingAppointments.filter(
    (a) => a.status !== 'CANCELLED' && a.start_time.startsWith(targetDateStr)
  );

  const availableSlots = [];
  let currentMin = shiftStartMin;

  while (currentMin + duration <= shiftEndMin) {
    const slotStartStr = `${targetDateStr}T${formatMinutesToTime(currentMin)}:00Z`;
    const slotEndMin = currentMin + duration;
    const slotEndStr = `${targetDateStr}T${formatMinutesToTime(slotEndMin)}:00Z`;

    // Check collision against active appointments
    const hasOverlap = validExisting.some((a) => {
      return slotStartStr < a.end_time && slotEndStr > a.start_time;
    });

    if (!hasOverlap) {
      availableSlots.push({
        start_time: slotStartStr,
        end_time: slotEndStr,
        duration_minutes: duration,
        provider_id: provider.id,
        service_id: service.id
      });
    }

    currentMin += step;
  }

  return availableSlots;
}

function hasScheduleConflict(newStartStr, newEndStr, existingAppointments = [], excludeId = null) {
  return existingAppointments.some((a) => {
    if (excludeId && a.id === excludeId) return false;
    if (a.status === 'CANCELLED') return false;
    return newStartStr < a.end_time && newEndStr > a.start_time;
  });
}

module.exports = {
  generateAvailableSlots,
  hasScheduleConflict,
  getDayOfWeekName
};
