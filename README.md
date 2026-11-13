# BookEase

[![CI Pipeline](https://github.com/Soulofghost/bookease/actions/workflows/ci.yml/badge.svg)](https://github.com/Soulofghost/bookease/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-v22%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.19%2B-lightgrey.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **BookEase** is an appointment scheduling and resource reservation platform. It features conflict-free calendar booking, provider shift modeling with buffer intervals, and double-booking prevention.

---

## 1. System Architecture

BookEase separates appointment scheduling, slot calculation, and administrative calendar coordination.

```
┌─────────────────────────────────────────────────────────────┐
│                 Appointment Booking UI                      │
│   • Multi-step reservation wizard (Service -> Specialist)   │
│   • Real-time available slot picker                         │
│   • Practice appointments queue & status controls           │
│   • Operations KPI ribbon                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON
┌──────────────────────────────▼──────────────────────────────┐
│                    Express.js REST Tier                     │
│   • Slot calculation & interval generator                   │
│   • Atomic conflict validation                              │
│   • Appointment status state-machine                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│    Scheduling Engine        │         │   High-Throughput Storage   │
│  • Provider shift parsing   │         │   • SQLite 3 WAL Mode       │
│  • Buffer time enforcement  │         │   • Foreign Key Cascade     │
│  • Collision detection      │         │   • Indices on intervals    │
└─────────────────────────────┘         └─────────────────────────────┘
```

---

## 2. Key Capabilities

### A. Dynamic Open Slot Generator
Calculates bookable time windows based on provider schedules:
- Evaluates provider weekly shifts.
- Slices working hours by `duration_minutes + buffer_minutes`.
- Eliminates any intervals overlapping with active appointments (`CONFIRMED`).

### B. Double-Booking Prevention
At booking creation time, an atomic conflict check validates:
$$\text{Overlap} \iff \text{NewStart} < \text{ExistingEnd} \land \text{NewEnd} > \text{ExistingStart}$$
Conflicting reservations are rejected with HTTP 409 Conflict.

### C. Booking Lifecycle Management
Appointments transition cleanly through `CONFIRMED` $\to$ `COMPLETED` or `CANCELLED`.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Engine** | Node.js 22+ / Express.js | REST routing & scheduling calculations |
| **Data Persistence** | SQLite 3 | WAL mode with relational constraints |
| **Frontend UI** | Vanilla JS / CSS3 | Nordic teal booking suite |
| **Testing** | Jest + Supertest | Unit & integration test suites |
| **DevOps** | Docker / Compose | Multi-stage container deployment |
| **CI/CD** | GitHub Actions | Automated build and test pipeline |

---

## 4. API Reference

### Services & Providers
- `GET /api/services` — List service offerings.
- `POST /api/services` — Create service with duration and buffer minutes.
- `GET /api/providers` — List specialists and weekly shift availability.
- `POST /api/providers` — Register specialist.

### Scheduling
- `GET /api/slots?provider_id={id}&service_id={id}&date={YYYY-MM-DD}` — Calculate open intervals.
- `POST /api/appointments` — Book appointment with collision check.
- `GET /api/appointments` — List appointments with optional filters.
- `PATCH /api/appointments/:id/status` — Update appointment status (`CONFIRMED`, `COMPLETED`, `CANCELLED`).

### Health & Metrics
- `GET /api/analytics/booking-summary` — Total bookings, cancellation rate, utilization metrics.
- `GET /health` — Service readiness probe.

---

## 5. Local Setup & Testing

### Installation
```bash
# Clone the repository
git clone https://github.com/Soulofghost/bookease.git
cd bookease/backend

# Install dependencies
npm ci
```

### Running the Server
```bash
npm start
```
Open `http://localhost:8000` in your browser.

### Running Test Suite
```bash
npm test
```

---

## 6. Docker Deployment

```bash
docker-compose up --build -d
docker-compose logs -f
```

---

## 7. License

Licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
