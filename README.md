# JAG-Ed Center Room Reservations

Reservation app for the College of Engineering's reservable spaces in the JAG-Ed Center.

Next.js (App Router) · PostgreSQL · Prisma · Tailwind v4 · deploys to Vercel.

---

## Running it locally

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:up && npm run db:deploy && npm run db:seed && npm run dev
```

That starts PostgreSQL 17 in Docker on **port 5455**, applies the migration, loads the eight
rooms from the handout, and serves <http://localhost:3000>.

> Port 5455 is deliberate: this machine already has a native PostgreSQL listening on both 5432
> and 5433, and it silently shadows Docker's published port.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run db:up` / `db:down` | Start / stop the local database |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio — the admin UI for closures and room policy |
| `npm run verify:overlap` | The double-booking test suite (below) |
| `npm run typecheck` / `lint` | Types and lint |

---

## How double-booking is prevented

Application-level "check then insert" cannot stop two simultaneous requests — both read an empty
slot before either writes. So the guarantee lives in PostgreSQL, in
[the init migration](prisma/migrations):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_no_overlap"
    EXCLUDE USING gist (
        "room_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
```

Three things fall out of that definition:

- **`'[)'` — half open.** A booking ending at 10:00 does not collide with one starting at 10:00.
- **The `WHERE` clause.** Cancelled and denied rows leave the index, so a slot frees up the
  instant someone cancels. A *pending* request still holds its slot, so two people cannot both be
  waiting on staff approval for the same room and time.
- **`btree_gist`.** Lets one GiST index mix plain equality on `room_id` with range overlap.

`lib/bookings.ts` still does a pre-flight query first — but only so the common case gets a
friendly message. The constraint is what makes it correct; the code catches SQLSTATE `23P01` and
turns it into a 409-style "someone booked that a moment before you".

**Prisma cannot express exclusion constraints.** The SQL is appended by hand to the generated
migration. If that migration is ever regenerated, re-add the block or the guarantee silently
disappears.

`npm run verify:overlap` proves all of it, including 12 concurrent `createBooking()` calls for the
same slot:

```
Database constraint
  PASS  a first booking is accepted
  PASS  an identical booking is rejected
  PASS  a booking starting inside it is rejected
  PASS  a booking ending inside it is rejected
  PASS  a booking that swallows it is rejected
  PASS  a PENDING request over a confirmed booking is rejected
  PASS  a booking starting exactly when it ends is accepted
  PASS  the same slot in a different room is accepted
  PASS  the slot frees up after a cancellation
  PASS  ends_at before starts_at is rejected
Concurrency through createBooking()
  PASS  exactly one of 12 simultaneous requests wins the slot
  PASS  every loser gets a CONFLICT, not a crash
  PASS  only one row is actually stored
```

It writes and deletes its own rows (`@overlap-test.invalid`), so it is safe against a seeded dev
database — but not against production.

---

## How it is put together

```
app/
  page.tsx                 Room list, filters, interactive floor plan
  rooms/[slug]/page.tsx    Room detail, availability, booking
  reservations/page.tsx    Look up and cancel your own reservations
  staff/page.tsx           Approve / deny / cancel — gated by ADMIN_EMAILS
  actions.ts               Server Actions (all mutations)
  api/rooms/…              Read-only JSON, for kiosks or future integrations
components/
  floor-plan/              Interactive SVG plan + traced geometry
  booking-panel.tsx        Date → slot → duration → details, in one client component
lib/
  time.ts                  The only place local wall time ↔ UTC conversion happens
  availability.ts          Slot generation; pure, no database
  bookings.ts              Booking rules + conflict handling
  auth.ts                  Prototype identity shim — replace this with SSO
prisma/
  schema.prisma            Room, Amenity, RoomImage, Booking, Closure
  seed.ts                  The eight rooms, transcribed from the handout
scripts/verify-overlap.ts  The proof above
```

**Time.** Everything stored is `timestamptz`; everything displayed is Arizona wall time. Arizona
does not observe DST, but the conversions in `lib/time.ts` are DST-correct anyway, so a second
campus in a DST zone would not need new code. Slots are 30 minutes.

**The floor plan** is inline SVG, not the handout PNGs. The polygons were traced pixel-by-pixel out
of the `B### HL.png` highlight files, so they match the diagrams staff already hand out — but as
SVG they can be clicked, tinted live by availability (green = free now, amber = in use), and they
follow light/dark mode. The original PNGs are still seeded as each room's `PLAN` image.

**Per-room policy** lives on the `Room` row rather than in code: opening hours, open weekdays,
minimum and maximum booking length, how far ahead people may book, whether it needs approval, and
whether it is bookable at all. Change them in Prisma Studio; no deploy needed. The commons is set
to `needsApproval` and an 8-hour maximum; the two huddle pods cap at 2 hours.

**Closures** are blackout windows (holidays, maintenance, a semester-long class block). A closure
with no `roomId` applies to every room. There is no admin UI yet — add them in Prisma Studio.

---

## Deploying to Vercel

1. Push this repository to GitHub and import it into Vercel.
2. Provision Postgres (Vercel Postgres, Neon and Supabase all support `btree_gist`).
3. Set environment variables:
   - `DATABASE_URL` — the **pooled** connection string.
   - `DIRECT_URL` — the direct one. Migrations cannot run through a pgbouncer pool. Add
     `directUrl = env("DIRECT_URL")` to the `datasource` block when you add this.
   - `ADMIN_EMAILS` — comma-separated, who sees `/staff`.
   - `ALLOWED_EMAIL_DOMAINS` — optional. Set to `arizona.edu` for the internal-tool phase to
     reject non-campus addresses; leave empty when you open to the public.
   - `NEXT_PUBLIC_TZ` — defaults to `America/Phoenix`.
4. The build command is already `prisma generate && next build`. Run `npx prisma migrate deploy`
   against the production database once before the first deploy.

---

## Data questions for the space owners

Transcribed from `reference/Room Reservation Presentation (1).pdf`. Four things need confirming:

1. **Is B142 and B143's availability intended?** The handout's summary slide lists only B138,
   B139, B153, B154 and B155 as available, but there are full detail slides for B142 and B143.
   Both are seeded as bookable. Set `isBookable = false` on either if that is wrong.
2. **The commons has no amenity list.** Its slide reads `xxxxxxx`. No amenities are seeded, and the
   room page says so rather than inventing any.
3. **B154 has no photo.** Every other room does. Its card shows a "photo coming soon" placeholder.
4. **Two diagram files have wrong labels.** `img/JAG-Ed Diagram.png` and
   `img/JAG-Ed Center Diagram.png` each label two rooms `B139` and two rooms `B153`. The per-room
   `B### HL.png` files are correct (B137/B138/B139 and B146/B153/B154/B155) and are what the app's
   geometry came from. Worth fixing at the source before those diagrams get reprinted.

Capacities and dimensions come straight from the handout. Room types are a judgement call —
meeting for B138/B139/B142/B143, conference for B154/B155, adaptable for B153 (wheeled tables) and
the commons. Change them in `prisma/seed.ts`.

---

## What is deliberately not built yet

**Authentication.** `lib/auth.ts` is a shim: you type a name and email, it goes in a cookie, and
that is all. Anyone can type any email. It is fine for a prototype and *not* fine once this is
internal. The replacement is NextAuth with a Microsoft Entra ID (NetID) provider — `getViewer()`
reads the session instead of the cookie, and `isStaff` comes from a group claim instead of
`ADMIN_EMAILS`. Everything staff-only already calls `requireStaff()`, so it is a one-file change.
The per-booking `manageToken` exists only so a person without an account can cancel; drop it
after SSO.

**Email.** Nobody is notified of anything. Confirmations, approval decisions and day-before
reminders all want an email step — Resend or the campus SMTP relay, triggered from the same
Server Actions that already mutate bookings.

**Recurring reservations.** "Every Tuesday this semester" is the most likely first request from
staff, and it interacts with the exclusion constraint in an interesting way: expand the series into
individual rows and let the constraint reject the ones that clash, then report which dates failed.

**Room layouts.** Every room in the handout has a "Layouts Available" slide. A `RoomLayout` model
(name, diagram, capacity for that layout) that the requester picks during booking would tell staff
how to set the room — see the virtual-tour notes below, where it earns its keep twice.

**Calendar integration.** An `.ics` feed per room, and eventually two-way Outlook sync. The
read-only JSON API under `/api/rooms` is the seam for that.

---

## Virtual tours — a recommendation

You mentioned three.js + WebGPU and wanting higher resolution, possibly via Blender. Some thoughts,
in the order I would actually do them.

**First, the likely diagnosis.** If a three.js scene looked low-resolution, the renderer is
probably not the cause. WebGPU raises the ceiling on *throughput*, not on fidelity — a real-time
scene with unbaked lighting and 1K textures looks the same on WebGPU as on WebGL2. What produces
the jump in quality is baked global illumination and higher-resolution lightmaps, which is a
Blender-side change. Switching renderers first is likely to cost compatibility without buying
much: campus lab machines and older iPads still lack WebGPU. Use three.js `WebGPURenderer`, which
falls back to WebGL2 automatically, rather than requiring WebGPU.

**Phase 1 — 360° panoramas. Do this one.** One afternoon with a Ricoh Theta or Insta360, one
equirectangular image per room, rendered on a sphere. It is photoreal by definition, roughly
2–5 MB per room with tiling, works on every phone, and needs no 3D pipeline. It answers the
question people actually have — *what does this room feel like?* Add `PANORAMA` to the `ImageKind`
enum and it drops straight into the existing gallery. This gets most of the value for a fraction
of the effort of anything below.

**Phase 2 — Blender models, but only for the adaptable rooms.** This is where authored 3D beats
photography, and it is specific to your spaces: B153's tables are on wheels and the commons
reconfigures entirely. A photo can only show one arrangement. A Blender model with baked lightmaps,
exported as glTF/GLB (2–5 MB, Draco-compressed), lets someone toggle *rows / pods / U-shape* and
see the room in that layout — then pick it as part of the reservation, which tells staff how to set
up. That ties directly into the `RoomLayout` model above and turns a nice visual into an
operational win. Bake in Cycles, export the lightmap at 2K–4K per room; that is where the
resolution you were missing comes from.

**Phase 3 — Gaussian splatting, if you want the wow.** Capture a room on a phone, train a splat,
render it in the browser. It is the current state of the art for photoreal free-roam and would look
genuinely impressive for the commons. It is also 20–80 MB per room and heavy on mobile GPUs, so
treat it as an enhancement behind a "explore in 3D" button, never as the default view.

**Two practical notes.** Do not serve tour assets from the Next.js bundle or the repo — put them in
object storage (Vercel Blob, S3, R2) behind a CDN and keep only URLs in Postgres, the same way
`RoomImage` works now. And load any 3D viewer with `next/dynamic` and `ssr: false` behind an
explicit click, so the reservation flow — which is the thing people came for — never waits on a
40 MB download.
