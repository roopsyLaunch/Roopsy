# Barber marketplace — step-wise requirements (MVP+)

**Stack:** MongoDB, Node.js, Express, Expo, React Native (JavaScript).

This document lists roles, flows, and what is implemented in this repo versus recommended next steps.

---

## 1) Roles

| Role | Description |
|------|-------------|
| **Customer** | Registers, browses **approved** shops, books time slots and services (haircut, beard, combo, etc.). |
| **Barber** | Registers a **shop application** (address, KYC last-4 Aadhaar, bank/UPI for payouts). Stays **pending** until **Admin** approves. After approval: dashboard (poster URL, map lat/lng, chairs, rates, open/closed). |
| **Admin** | Reviews pending applications; **approve** or **reject** with reason. |

---

## 2) Step-by-step flows

### A. Barber onboarding

1. Barber signs up and submits **shop name**, **address**, **chair count**, **Aadhaar last 4 digits**, **bank / UPI** (demo — encrypt in production).
2. Status = `pending`. Barber sees **Status** tab until approved.
3. Admin reviews in **Approvals** tab (`GET /api/admin/barbers/pending`, `PATCH /api/admin/barbers/:id/decision`).
4. If **approved** → shop appears in public list; barber gets **Queue**, **Dashboard**, **Profile**.
5. If **rejected** → barber sees reason on **Status** (extend with re-apply flow in v2).

### B. Customer booking

1. Customer registers / logs in.
2. **Home** lists only **approved** barbers (open/closed badge, city).
3. **Barber detail** shows poster, address, **Open in Maps** (if lat/lng set), services with **category** and **₹** price.
4. Picks date → available slots (respects **chairs** and overlapping bookings).
5. **My bookings** lists appointments; cancel allowed.

### C. Barber operations (approved)

1. **Dashboard:** edit shop poster URL, address, map coordinates, KYC/bank, **shop open** switch, per-chair **available** toggles, add services (category, duration, price).
2. **Queue:** confirm / decline incoming bookings.

### D. Admin

1. Log in as seeded admin (`admin@demo.com` / `password123` after `npm run seed`).
2. **Approvals** tab → Approve / Reject.

---

## 3) Implemented API (summary)

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (returns `user` + `barber` summary for barbers).
- **Public barbers:** `GET /api/barbers` (approved only), `GET /api/barbers/:id` (optional auth for owner viewing pending).
- **Barber owner:** `GET/PATCH /api/barbers/me`.
- **Services:** `GET/POST /api/services`, `PATCH/DELETE /api/services/:id`.
- **Bookings:** create/list/patch as before; slots respect **approval**, **shop open**, and **chair capacity**.
- **Admin:** `GET /api/admin/barbers/pending`, `PATCH /api/admin/barbers/:id/decision`.

---

## 4) Security & compliance (recommended next)

- **Never store full Aadhaar or raw bank numbers in plain text** in production — use tokenization, encryption at rest, or a licensed KYC provider.
- **Document uploads** (Aadhaar scan, cancelled cheque): store in **S3 / Cloudinary** with signed URLs; save only references in MongoDB.
- **Payments:** integrate **Razorpay / Stripe** for customer pay-in and barber payouts after admin policy.
- **Rate limiting** on auth and admin routes (partially on register/login).
- **HTTPS** everywhere in production.

---

## 5) Product ideas added here (beyond your list)

- Service **categories** (haircut / beard / combo) for clearer menus.
- **Multi-chair** scheduling: multiple overlapping bookings up to available chairs.
- **Shop open** toggle blocks new bookings when closed.
- **Admin** role in the **same Expo app** for quick demos (for production, prefer a separate web admin).

---

## 6) Local run

1. MongoDB Atlas or local Mongo — set `MONGODB_URI` and `JWT_SECRET` in `server/.env` (see `.env.example`).
2. `cd server && npm install && npm run seed && npm run dev`
3. `cd mobile && npm start` — on a **physical device**, set `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:5000`.

---

## 7) Demo accounts (after seed)

| Account | Password | Role |
|---------|----------|------|
| admin@demo.com | password123 | Admin |
| demo@customer.com | password123 | Customer |
| demo@barber.com | password123 | Barber (pre-approved) |
