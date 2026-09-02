# Room Reservations · Intelligence Operations

Reservation app for the spaces run by Intelligence Operations, College of Engineering — the JAG-Ed
Center and the classrooms in the ATB C State Building.

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

That starts PostgreSQL 17 in Docker on **port 5455**, applies the migrations, loads the eleven
listings, and serves <http://localhost:3000>.

> Port 5455 is deliberate: this machine already has a native PostgreSQL listening on both 5432
> and 5433, and it silently shadows Docker's published port.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run db:up` / `db:down` | Start / stop the local database |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio — the admin UI for closures and room policy |
| `npm run photos` | Resize new photos from `img/` into `public/rooms/` |
| `npm run logo` | Regenerate the header logo's light and dark copies |
| `SEED_RESET=1 npm run db:seed` | Overwrite existing rooms with the seed file |
| `npm run verify:overlap` | The double-booking test suite (below) |
| `npm run typecheck` / `lint` | Types and lint |

---

## How double-booking is prevented

Application-level "check then insert" cannot stop two simultaneous requests — both read an empty
slot before either writes. So the guarantee lives in PostgreSQL.

It is not a constraint on bookings, though, because **one physical space can be listed more than
once**. C165 has a movable partition and is listed three ways — C165a, C165b, and the combined
room — over two physical halves. Those are three different `room_id`s, so a per-room constraint
cannot see that booking "the whole room" and booking "half of it" collide.

So a `Space` is the physical unit, a `Room` is a bookable listing over one or more spaces, and
every booking claims one row per space it occupies:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "booking_spaces"
    ADD CONSTRAINT "booking_spaces_no_overlap"
    EXCLUDE USING gist (
        "space_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    );
```

Things that fall out of this:

- **`'[)'` — half open.** A booking ending at 10:00 does not collide with one starting at 10:00.
- **No `WHERE` clause is needed.** A claim exists only while the booking holds the space, and is
  deleted on cancel or deny — so status never has to be kept in sync with the index. A *pending*
  request keeps its claims, so two people cannot both be waiting on approval for the same room.
- **`btree_gist`.** Lets one GiST index mix plain equality on `space_id` with range overlap.
- **Most rooms are one space** and never notice any of this.

Two subtleties worth knowing before changing this code:

- **Each transaction takes an advisory lock per space first**, in sorted order. Ordering the
  inserts alone is not enough: inserting into a GiST exclusion index writes a speculative entry and
  then waits on the conflicting transaction, so a booking claiming two spaces can hold one entry
  while waiting for the other — and two of those deadlock (40P01). Under a burst of simultaneous
  requests that happened often enough to exhaust the retries. The advisory locks make conflicting
  requests queue instead of racing inside the index; the exclusion constraint still decides who
  wins. `createBooking` also retries deadlocks, serialization failures and transaction timeouts
  with a randomised backoff, since none of those mean the slot is taken.
- **There is deliberately only one exclusion constraint.** An earlier per-room constraint on
  `bookings` was dropped: it was fully redundant, and having inserts take locks in two exclusion
  indexes was itself a source of deadlocks. This relies on every room mapping to at least one
  space — `createBooking` refuses otherwise, and the suite asserts it.

**Prisma cannot express exclusion constraints.** The SQL is appended by hand to the generated
migrations. If those are ever regenerated, re-add the blocks or the guarantee silently disappears.

`npm run verify:overlap` proves all of it:

```
Invariants
  PASS  every room maps to at least one physical space
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
Divisible room (C165)
  PASS  the combined room can be booked
  PASS  a half is blocked while the combined room is booked
  PASS  the other half is blocked too
  PASS  cancelling the combined booking frees the halves
  PASS  the two halves stay independent of each other
  PASS  the combined room is blocked while a half is booked
Concurrency across listings of the same floor
  PASS  8 simultaneous requests for the whole room and one half yield exactly one winner
  PASS  the winner holds its own spaces only, never a mix from two bookings
```

It writes and deletes its own rows (`@overlap-test.invalid`), so it is safe against a seeded dev
database — but not against production.

---

## How it is put together

```
auth.ts                    NetID (Entra ID) sign-in configuration
app/
  page.tsx                 Room list, filters, interactive floor plan
  signin/                  Sign-in page
  admin/                   Rooms, photos and access — admins only
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
  auth.ts                  Reads the session, applies roles from staff_members
  storage.ts               Where uploaded photos go (Vercel Blob / local disk)
prisma/
  schema.prisma            Room, Space, Booking, BookingSpace, Amenity, RoomImage, Closure
  seed.ts                  The eleven listings, transcribed from the handouts
scripts/
  verify-overlap.ts        The proof above
  trace_floor_plan.py      Regenerates the floor-plan geometry from img/map.png
  prepare-photos.mjs       Resizes img/ originals into public/rooms/
  make-logo-variants.mjs   Writes the header logo's light and dark copies
```

**Time.** Everything stored is `timestamptz`; everything displayed is Arizona wall time. Arizona
does not observe DST, but the conversions in `lib/time.ts` are DST-correct anyway, so a second
campus in a DST zone would not need new code. Slots are 30 minutes.

**The floor plan** is inline SVG covering both buildings, generated rather than drawn:

```bash
python scripts/trace_floor_plan.py emit
```

`img/map.png` is three-valued — white rooms, grey circulation, black walls — so the rooms are white
islands fenced in by lines. The script finds them by connected-component labelling, traces each
outline and simplifies it, then writes `components/floor-plan/geometry.ts`. Because the polygons
come out of the drawing itself they line up with the map the college already hands out, but as SVG
they can be clicked, tinted live by availability (green = free now, amber = in use), and they
follow light/dark mode. Run `inspect` instead of `emit` to get a numbered overlay when the source
drawing changes and the region ids need remapping. Do not hand-edit the `points`.

Twenty-two spaces are drawn; the ten reservable ones are clickable and the rest — B137/B141/B146,
the B156–B160 offices, the restrooms, C165 and C166A — are shaded for orientation.

**Seats vs occupancy.** `capacity` is the chairs actually set out; `maxOccupancy` is the posted
maximum, where one is given. The booking form checks headcount against `maxOccupancy ?? capacity`,
so a 45-person classroom with 18 chairs can still take a 30-person standing session. Only the
ATB C rooms have a posted figure so far.

**Per-room policy** lives on the `Room` row rather than in code: opening hours, open weekdays,
minimum and maximum booking length, how far ahead people may book, whether it needs approval, and
whether it is bookable at all. Change them in Prisma Studio; no deploy needed. The commons is set
to `needsApproval` and an 8-hour maximum; the two huddle pods cap at 2 hours.

**Closures** are blackout windows (holidays, maintenance, a semester-long class block). A closure
with no `roomId` applies to every room. There is no admin UI yet — add them in Prisma Studio.

---

## Adding or replacing photos

There are three places a photo exists, and they are not interchangeable:

| Where | What it is |
| --- | --- |
| `img/` | **Drop new photos here.** The full-resolution originals, straight off the camera. Never served to the browser. |
| `public/rooms/` | What the app actually serves, at `/rooms/<name>.jpg`. Generated — do not hand-edit. |
| `room_images` table | The URL, alt text, kind and display order. Populated by `prisma/seed.ts`. |

**To replace an existing photo** — drop it in `img/` under the same name, then:

```bash
npm run photos
```

**To add a photo a room does not have yet**, do the same, then add the file to that room's
`images` array in `prisma/seed.ts` with its alt text and re-run `npm run db:seed`. The app reads
image URLs from the **database**, not from the filesystem, so a file in `public/rooms/` that
nothing references will never appear no matter how many times you re-run `npm run photos`. That is
the one step that is easy to miss, so the script now names any unreferenced photo when it finishes:

```
1 photo(s) not referenced by prisma/seed.ts:
  /rooms/b154.jpg
Add each to that room's `images` array, then run: npm run db:seed
```

`npm run photos` does four things worth knowing about:

- **It bakes in EXIF orientation.** Phone cameras usually leave the pixels alone and record the
  rotation in a metadata tag. Browsers honour that tag; many image tools silently ignore it, which
  is how a photo ends up upside down in one place and fine in another. Two of the three JAG-Ed
  Center photos are orientation 3 (rotated 180°) — the script applies the rotation to the pixels
  and drops the tag, so the served file is unambiguous everywhere.
- **It downscales to 2560 px wide** at quality 82. The gallery never renders wider than about
  640 CSS px, so that is still 2x headroom on a retina display. The three new commons photos went
  from 12 MB to 1.5 MB with no visible difference. Raise `MAX_WIDTH` in
  `scripts/prepare-photos.mjs` if you ever need more.

- **It lowercases the served filename.** Windows filesystems are case-insensitive, so a photo
  dropped in as `B154.jpg` answers a request for `/rooms/b154.jpg` locally and then 404s on Vercel,
  which is Linux. Normalising the output means the same file behaves the same in both places, and
  you can name the originals in `img/` however you like.
- **It clears the next/image cache.** This one is worth understanding, because it produces a very
  confusing bug. `next/image` caches optimised output keyed by *(url, width, quality, format)* —
  and the url does not change when a file is overwritten in place. So a replaced photo keeps
  serving the old bytes, but **only for the formats and widths a browser had already requested**.
  The symptom is that `curl` shows a perfectly fresh JPEG while Chrome shows a stale WebP, which
  makes it look like a browser-cache problem when it is actually server-side. Clearing your own
  browser cache does not help. `?v=hash` cache-busting does not work either — Next rejects query
  strings on local images with `"url" parameter is not allowed`.

Photos already smaller than 2560 px and without an orientation tag are copied through byte-for-byte
rather than re-encoded, so re-running the script is safe and does not degrade anything.

**In production** there is no cache to clear, so `images.minimumCacheTTL` in `next.config.ts`
bounds how long a replaced photo can serve its old version — currently one hour. If a swap ever
needs to be live immediately, give the new file a different name and update `prisma/seed.ts`; a new
url is a new cache key and takes effect at once.

Floor plans are separate: the per-room highlight PNGs live in `public/plans/` and are copied by
hand, because the interactive plan is generated from `img/map.png` by
`scripts/trace_floor_plan.py` rather than from those images.

---

## Access, roles and the admin panel

Two roles, stored in the `staff_members` table and managed from the panel:

| | Can do |
| --- | --- |
| **Staff** | Approve, deny and cancel reservations (`/staff`) |
| **Admin** | All of that, plus edit rooms, manage photos, add rooms, and grant or revoke access (`/admin`) |

`ADMIN_EMAILS` is now a **bootstrap, not the list**. Addresses in it are always admins whether or
not they have a row, so it is not possible to lock everyone out of the panel that grants access —
including after a database reset. Everyone else is added in the panel, which records who granted
what. The panel refuses to remove an environment admin, to remove your own access, or to remove the
last remaining admin.

### NetID sign-in

Identity comes from **UA NetID via Microsoft Entra ID** (OIDC), configured in `auth.ts`. Roles stay
in `staff_members` and are read by `lib/auth.ts` — authentication says who you are, authorisation
says what you may do, and the two are deliberately separate. Because roles are keyed by email they
survived the move off the old typed-in identity cookie with no data change, and would survive a
move to Shibboleth the same way.

**What to request from UITS.** An app registration in the University of Arizona Entra tenant, with:

- **Redirect URI** — `https://<your-domain>/api/auth/callback/microsoft-entra-id`
  (and `http://localhost:3000/api/auth/callback/microsoft-entra-id` for development)
- **Scopes** — `openid profile email`. Nothing else is used.
- **Token type** — ID token from the v2.0 endpoint.

They will give you an Application (client) ID, a client secret, and the Directory (tenant) ID. Put
them in `.env` locally and in the Vercel project settings for the deployment:

```
AUTH_MICROSOFT_ENTRA_ID_ID=<application (client) id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<client secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant id>/v2.0
```

**The issuer is not optional.** Left unset, the provider defaults to Microsoft's `common`
endpoint, which would let anyone with any Microsoft account — a personal Outlook address included
— complete a sign-in and appear as a legitimate user. Pinning it to the university tenant is what
makes this *NetID* sign-in rather than *Microsoft* sign-in. `ALLOWED_EMAIL_DOMAINS` is applied as a
second gate, for guest accounts invited into the tenant with outside addresses.

`AUTH_SECRET` signs the session cookie and must be set in every environment. Generate one with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

**Until the registration exists**, a development sign-in form stands in: type any name and email.
`auth.ts` only registers that provider when Entra is unconfigured *and* `NODE_ENV` is not
production, so it cannot be reached on a deployment. The admin panel refuses to run in production
until Entra is configured.

**Booking requires a NetID during the internal rollout**, controlled by
`REQUIRE_SIGN_IN_TO_BOOK`. It defaults to *required*: an access control should fail closed, so a
missing value on a deployment leaves booking locked rather than silently open. Set it to `0` when
the service opens to the public.

Availability stays browsable to everyone either way — only the reservation form is gated, so people
can still see what is free before signing in. Existing reservations can still be cancelled from
their confirmation link without an account.

Enforcement is in `createBookingAction`, not the component: hiding the form is a courtesy, and the
action is what a request actually goes through. Verified by capturing a real server-action request
while signed in, signing out, and replaying it — the replay is refused and writes nothing.

A signed-in reservation is made *as* that person: the session overrides whatever the form posts, so
staff can trust the requester name on a booking. `/reservations` and the staff and admin tools all
require a session.

### Photo uploads

Uploads go to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, and otherwise fall back to writing
into `public/rooms/` so the panel is usable locally before anyone creates a store. The local driver
**refuses to run in production** rather than appearing to work — Vercel's filesystem is read-only,
so a write there either throws or lands on an instance that is about to vanish. The panel says
which driver is in use. Swapping in S3 or R2 means writing one more driver in `lib/storage.ts`.

### Re-seeding is now non-destructive

Once the panel is in use the database is the source of truth, not `prisma/seed.ts`. Re-seeding
therefore **skips rooms that already exist** — fields, amenities and photos are all left alone, so
an edit or an uploaded photo is never silently reverted. `SEED_RESET=1 npm run db:seed` restores the
original transcription.

### Adding a room

A new room is created with its own physical space, so it participates in the no-double-booking
guarantee immediately. Two things it does *not* do automatically: it will not appear on the floor
plan until its outline is traced into the plan geometry, and if it is really one half of a
divisible space like C165 the space mapping has to be set up by hand.

---

## The header logo

The source artwork is `img/COE_Intelligence-Operations_ALTERNATE.svg`. Two copies are served:

```bash
npm run logo
```

- `public/coe-intelligence-operations.svg` — the original, untouched.
- `public/coe-intelligence-operations-dark.svg` — a reversed copy for dark mode.

The reversed copy exists because the wordmark is drawn in Arizona Blue (`#00275B`), which is
effectively invisible on the dark background; the block A survives only because it sits on its own
white field. The script recolours the navy `<path>` and `<rect>` elements — the divider rule, the
registered mark and the wordmark, all of which sit on the page background — and deliberately leaves
the navy `<polygon>` alone, since that is the block A's frame and has to stay dark against its
white field.

The header picks between them with `prefers-color-scheme` in a `<picture>` element, which matches
how the rest of the app themes itself. That is also why it is a plain `<img>` rather than
`next/image`: image components cannot swap sources on a media query, and an SVG has nothing to
optimise.

If the logo is ever replaced, re-run `npm run logo` and check the result — it prints how many
elements it recoloured, and the polygon/path rule is specific to this artwork.

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
3. **Every room now has a photo.** B154 was the last one outstanding.
4. **C165a's info card is titled "Room C166a".** You confirmed the 28×24 / occupancy 45 card is
   C165a and the title is a typo; it is seeded that way. Worth fixing on the source slide, since
   C166A is a real and separate room on the area map.
5. **C165a and C165b are two halves of one room**, confirmed, and the app now models that. They
   are listed separately and as a combined room; booking the combined space holds both halves,
   while the two halves stay independent of each other. The combined listing is called
   **"C165a+b"** as a placeholder — rename `number` / `name` in `prisma/seed.ts` once you know
   what staff actually call it. It is set to need approval, on the assumption someone has to go
   and open the partition; flip `needsApproval` in Prisma Studio if not.
6. **Two diagram files have wrong labels.** `img/JAG-Ed Diagram.png` and
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
