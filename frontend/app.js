const API_BASE = window.location.origin;

// State
let servicesList = [];
let providersList = [];
let selectedSlot = null;

// Initial Seeds
const DEFAULT_SERVICES = [
  {
    name: "Preventative Health Audit",
    category: "Healthcare",
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 250.0,
    currency: "USD",
    description: "Holistic metabolic, physical, and preventative health review."
  },
  {
    name: "Cloud Architecture & Scalability Review",
    category: "Engineering",
    duration_minutes: 45,
    buffer_minutes: 15,
    price: 350.0,
    currency: "USD",
    description: "Deep-dive technical assessment into distributed systems, bottlenecks, and costs."
  },
  {
    name: "Legal IP & Corporate Consultation",
    category: "Legal",
    duration_minutes: 30,
    buffer_minutes: 10,
    price: 200.0,
    currency: "USD",
    description: "Patent filings, trademark defense, and commercial venture governance."
  }
];

const DEFAULT_PROVIDERS = [
  {
    name: "Dr. Evelyn Vance",
    email: "evelyn.vance@clinic.org",
    specialization: "Preventative & Internal Medicine",
    availability: {
      Monday: { start: "09:00", end: "17:00" },
      Tuesday: { start: "09:00", end: "17:00" },
      Wednesday: { start: "09:00", end: "17:00" },
      Thursday: { start: "09:00", end: "17:00" },
      Friday: { start: "09:00", end: "13:00" }
    }
  },
  {
    name: "Marcus Vance, Principal Architect",
    email: "marcus.vance@techcorp.io",
    specialization: "Cloud Infrastructure & Distributed Systems",
    availability: {
      Monday: { start: "10:00", end: "18:00" },
      Tuesday: { start: "10:00", end: "18:00" },
      Thursday: { start: "10:00", end: "18:00" }
    }
  }
];

// DOM Elements
const metricTotal = document.getElementById("metric-total");
const metricConfirmed = document.getElementById("metric-confirmed");
const metricCompleted = document.getElementById("metric-completed");
const metricCancelRate = document.getElementById("metric-cancel-rate");

const serviceSelect = document.getElementById("service-select");
const providerSelect = document.getElementById("provider-select");
const dateSelect = document.getElementById("date-select");
const slotsContainer = document.getElementById("slots-container");
const selectedStartInput = document.getElementById("selected-start");
const selectedEndInput = document.getElementById("selected-end");

const bookingForm = document.getElementById("booking-form");
const custNameInput = document.getElementById("cust-name");
const custEmailInput = document.getElementById("cust-email");
const custPhoneInput = document.getElementById("cust-phone");
const custNotesInput = document.getElementById("cust-notes");

const appointmentsList = document.getElementById("appointments-list");
const statusFilter = document.getElementById("status-filter");

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
  // Set default date to upcoming Monday
  const today = new Date();
  const nextMonday = new Date();
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  dateSelect.value = nextMonday.toISOString().split("T")[0];

  setupEventListeners();
  await initSeedData();
  await loadServicesAndProviders();
  await loadAnalytics();
  await loadAppointments();
});

function setupEventListeners() {
  serviceSelect.addEventListener("change", fetchAvailableSlots);
  providerSelect.addEventListener("change", fetchAvailableSlots);
  dateSelect.addEventListener("change", fetchAvailableSlots);

  bookingForm.addEventListener("submit", handleBookingSubmit);
  statusFilter.addEventListener("change", () => loadAppointments(statusFilter.value));
}

async function initSeedData() {
  try {
    const sRes = await fetch(`${API_BASE}/api/services`);
    const services = await sRes.json();
    if (services.length === 0) {
      for (const s of DEFAULT_SERVICES) {
        await fetch(`${API_BASE}/api/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s)
        });
      }
    }

    const pRes = await fetch(`${API_BASE}/api/providers`);
    const providers = await pRes.json();
    if (providers.length === 0) {
      for (const p of DEFAULT_PROVIDERS) {
        await fetch(`${API_BASE}/api/providers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p)
        });
      }
    }
  } catch (err) {
    console.error("Init seed error:", err);
  }
}

async function loadServicesAndProviders() {
  try {
    const sRes = await fetch(`${API_BASE}/api/services`);
    servicesList = await sRes.json();
    serviceSelect.innerHTML = servicesList.map(s => `
      <option value="${s.id}">${escapeHtml(s.name)} (${s.duration_minutes}m · $${s.price})</option>
    `).join("");

    const pRes = await fetch(`${API_BASE}/api/providers`);
    providersList = await pRes.json();
    providerSelect.innerHTML = providersList.map(p => `
      <option value="${p.id}">${escapeHtml(p.name)} - ${escapeHtml(p.specialization)}</option>
    `).join("");

    fetchAvailableSlots();
  } catch (err) {
    console.error(err);
  }
}

async function fetchAvailableSlots() {
  const serviceId = serviceSelect.value;
  const providerId = providerSelect.value;
  const dateStr = dateSelect.value;

  if (!serviceId || !providerId || !dateStr) {
    slotsContainer.innerHTML = `<div class="slots-hint">Select a service, provider, and date.</div>`;
    return;
  }

  slotsContainer.innerHTML = `<div class="slots-hint" style="color:var(--teal-primary);">Checking calendar availability...</div>`;
  selectedSlot = null;
  selectedStartInput.value = "";
  selectedEndInput.value = "";

  try {
    const res = await fetch(`${API_BASE}/api/slots?provider_id=${providerId}&service_id=${serviceId}&date=${dateStr}`);
    if (!res.ok) throw new Error("Slots query failed");
    const data = await res.json();

    if (data.slots.length === 0) {
      slotsContainer.innerHTML = `<div class="slots-hint">No slots available on this date (Provider off or fully booked).</div>`;
      return;
    }

    slotsContainer.innerHTML = data.slots.map(s => {
      const timeLabel = s.start_time.substring(11, 16);
      return `
        <div class="slot-pill" data-start="${s.start_time}" data-end="${s.end_time}" onclick="selectSlot(this)">
          ${timeLabel} UTC
        </div>
      `;
    }).join("");
  } catch (err) {
    slotsContainer.innerHTML = `<div class="slots-hint" style="color:var(--danger);">${err.message}</div>`;
  }
}

window.selectSlot = function(el) {
  document.querySelectorAll(".slot-pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  selectedSlot = {
    start: el.dataset.start,
    end: el.dataset.end
  };
  selectedStartInput.value = el.dataset.start;
  selectedEndInput.value = el.dataset.end;
};

async function handleBookingSubmit(e) {
  e.preventDefault();

  if (!selectedStartInput.value || !selectedEndInput.value) {
    alert("Please click and select an available time slot before booking.");
    return;
  }

  const payload = {
    service_id: serviceSelect.value,
    provider_id: providerSelect.value,
    customer_name: custNameInput.value.trim(),
    customer_email: custEmailInput.value.trim(),
    customer_phone: custPhoneInput.value.trim(),
    start_time: selectedStartInput.value,
    end_time: selectedEndInput.value,
    notes: custNotesInput.value.trim()
  };

  const submitBtn = document.getElementById("btn-submit-booking");
  submitBtn.disabled = true;
  submitBtn.textContent = "Locking Reservation...";

  try {
    const res = await fetch(`${API_BASE}/api/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      alert("Booking Conflict: This slot was just reserved by another client. Please choose another slot.");
      fetchAvailableSlots();
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      alert(`Booking failed: ${err.error || "Validation Error"}`);
      return;
    }

    alert("Appointment confirmed successfully!");
    custNameInput.value = "";
    custEmailInput.value = "";
    custPhoneInput.value = "";
    custNotesInput.value = "";

    await fetchAvailableSlots();
    await loadAppointments();
    await loadAnalytics();
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm & Book Slot";
  }
}

async function loadAppointments(status = "") {
  try {
    let url = `${API_BASE}/api/appointments`;
    if (status) url += `?status=${status}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const appts = await res.json();
    renderAppointments(appts);
  } catch (err) {
    console.error(err);
  }
}

function renderAppointments(appts) {
  if (appts.length === 0) {
    appointmentsList.innerHTML = `<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-muted);">No appointments found.</div>`;
    return;
  }

  appointmentsList.innerHTML = appts.map(a => {
    const startDate = a.start_time.substring(0, 10);
    const startTime = a.start_time.substring(11, 16);
    const endTime = a.end_time.substring(11, 16);

    return `
      <div class="appt-card">
        <div class="appt-top">
          <div>
            <div class="appt-service">${escapeHtml(a.service_name || 'Service')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.provider_name || 'Specialist')}</div>
          </div>
          <span class="appt-status ${a.status}">${a.status}</span>
        </div>

        <div class="appt-details">
          <span>Client: <strong>${escapeHtml(a.customer_name)}</strong> (${escapeHtml(a.customer_email)})</span>
          <span class="appt-time">📅 ${startDate} · ${startTime} - ${endTime}</span>
        </div>

        ${a.notes ? `<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">"${escapeHtml(a.notes)}"</div>` : ''}

        <div class="appt-footer">
          <span>Fee: <strong>$${a.service_price || '0.00'}</strong></span>
          <div class="appt-actions">
            ${a.status === 'CONFIRMED' ? `
              <button class="btn btn-small btn-complete" onclick="updateApptStatus('${a.id}', 'COMPLETED')">✓ Complete</button>
              <button class="btn btn-small btn-cancel" onclick="updateApptStatus('${a.id}', 'CANCELLED')">Cancel</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

window.updateApptStatus = async function(id, status) {
  try {
    const res = await fetch(`${API_BASE}/api/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      await loadAppointments(statusFilter.value);
      await fetchAvailableSlots();
      await loadAnalytics();
    }
  } catch (err) {
    console.error("Status update error:", err);
  }
};

async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/api/analytics/booking-summary`);
    if (!res.ok) return;
    const data = await res.json();
    metricTotal.textContent = data.total_appointments;
    metricConfirmed.textContent = data.confirmed_count;
    metricCompleted.textContent = data.completed_count;
    metricCancelRate.textContent = `${data.cancellation_rate}%`;
  } catch (err) {
    console.error("Analytics fetch error:", err);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
