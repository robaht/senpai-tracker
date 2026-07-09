# Senpai — feature backlog

Planned features beyond the MVP. Each entry has user-facing requirements
(acceptance criteria) and a technical approach grounded in the current codebase,
so any one can be picked up cold and started smoothly.

> **Current state — where the watch list lives:** local-first
> (`AsyncStorageTrackingRepository`, `senpai:tracking:v1`), now optionally synced
> to an **AniList account via OAuth** (F1 — shipped; `src/features/auth/` +
> `src/features/tracking/sync.ts`). Local remains the offline cache; AniList is
> the source of truth when signed in (zero backend — no custom server).

## Priority & effort overview

| ID | Feature | Priority | Effort | Depends on |
|----|---------|----------|--------|------------|
| F3 | New-season alerts for watched anime + Upcoming screen | P2 | M–L | Notif. infra; true push needs a server |
| F7 | Deep multi-hop season chain (full S1→S2→S3 ordering) | P3 | M | — (extends shipped F2) |
| F8 | Super Follow (per-title new-season announcement alerts) | P2 | M | Notif. infra; true push needs a server |
| F18 | Tag browse + genre × season composition (genre browse shipped) | P3 | S–M | — (extends shipped genre browse) |
| F22 | Per-screen signature treatments & motion | P3 | M | — (builds on shipped theme/token system) |
| F26 | Network resilience — AniList 429/Retry-After + request timeout | P3 | S–M | — |
| F27 | Web runtime robustness — ErrorBoundary, bounded cache persistence, sheet a11y | P3 | M | — |
| F28 | Notification center — new-episode/new-season alerts (in-app feed; local push is a native stretch) | P2 | M–L | Detection runs on app open; true push needs a server (same limitation as F3/F8) |
| F29 | Notification delivery layer — per-category settings, native local push via `expo-notifications`, status-change events | P3 | M | Extends shipped F28 (in-app feed + detection loop) |

**Suggested build order** (fast value first, heavy infra last):
`F3 → F7 → F8 → F18`, with the review items (F26/F27/F28) as independent
hardening whenever. Reorder freely — entries are independent except where
"Depends on" says otherwise.

### Shared prerequisites (cross-cutting)
- **Notifications infrastructure** (needed by F3): `expo-notifications` setup +
  a **development build** (push/scheduled notifications don't run in Expo Go on
  current SDKs). One-time setup, then reusable. `expo-notifications` is already
  an installed dependency and registered as an Expo config plugin
  (`app.json`), but no code uses it yet — F3/F8/F28 are all still on the "in-app,
  detected-on-open" side of this line.
- **Push server** (for *true* app-closed alerts in F3/F8): F1 shipped as AniList
  OAuth (zero backend), so server-pushed notifications still need a small service
  polling AniList. Not built — without it, detection happens on app open.
- **F28's detection loop** (batch-fetch tracked titles via `getAnimeById`, diff
  against a locally stored snapshot, dedupe by id) is the general-purpose building
  block F3/F8 can reuse for their own on-open checks — but F28 ships first as a
  self-contained in-app notification center, independent of F3/F8.

---

## F3 — New-season alerts for watched anime + "Upcoming" screen

**Goal:** When a sequel/new season of something the user already watched is
announced or starts airing, surface it (and optionally notify).

### Requirements / acceptance criteria
- [ ] A dedicated "Upcoming" view lists not-yet-released or newly-airing sequels/
      new seasons of titles in the user's list (esp. `COMPLETED`).
- [ ] Each entry shows the source title ("because you watched X"), release info,
      and a countdown if a date exists.
- [ ] (Notifications) The user can opt in to be alerted when such a season is
      detected or when it starts airing.
- [ ] No duplicate/repeat alerts for the same season.

### Technical approach
- Reuses F2's relations: for each watched/completed entry, find SEQUEL nodes with
  status `NOT_YET_RELEASED` or recently `RELEASING`; compute date from
  `startDate` / `nextAiringEpisode`.
- New screen (e.g. `app/(tabs)/upcoming.tsx` or a section in Library), driven by a
  TanStack Query hook that batches relation lookups for the user's list (mind the
  ~90 req/min limit — batch + cache aggressively).
- Notifications: `expo-notifications` (requires the dev build). Local scheduled
  notifications cover "season starts airing on date X."
- **Limitation:** true *announcement* push (notify the moment AniList adds a
  sequel, app closed) needs a server polling AniList → depends on **F1's backend**.
  Without it, detection happens on app open. Document this clearly.

---

## F7 — Deep multi-hop season chain (full S1 → S2 → S3 ordering)

**Goal:** From any anime, present the *complete* ordered run of seasons
(S1 → S2 → S3 → S4 …), not just the direct prequel/sequel neighbors that F2 ships.

### Requirements / acceptance criteria
- [ ] The "Seasons" list spans the full chain in order, not only the immediate
      prev/next entries — following sequels forward and prequels backward across
      multiple hops.
- [ ] The currently-viewed anime is clearly marked within the ordered chain.
- [ ] Each season node is tappable into its detail and shows its tracked-status
      dot (reuse `PosterCard`, as in F2).
- [ ] Cycles and branches (e.g. a title with multiple sequels, or a
      prequel/sequel loop) terminate cleanly with no infinite traversal or dupes.
- [ ] Traversal respects AniList's rate limit and stays responsive: partial chain
      renders as hops resolve rather than blocking on the whole walk.

### Technical approach
- Builds directly on F2's relations data. F2 leaves a `buildSeasonChain` helper in
  `src/lib/relations.ts` that orders only *direct* PREQUEL/SEQUEL edges from one
  fetched node. F7 generalizes it into a recursive walk: from the current node,
  follow SEQUEL edges forward and PREQUEL edges backward, fetching each newly
  discovered node's relations until the chain ends.
- Each hop is another `getAnimeById` call (`src/api/anilist/index.ts`), which F2
  already extends to return `relations`. Add a dedicated hook in
  `src/api/anilist/hooks.ts` (e.g. `useSeasonChain(id)`) that orchestrates the
  traversal on top of TanStack Query — reuse the existing `animeKeys.detail(id)`
  cache so already-visited nodes are free, and cap concurrency/fan-out to respect
  the ~90 req/min limit (batch + cache aggressively).
- Track visited ids in a `Set` to guarantee termination on cycles; when a node has
  multiple SEQUEL/PREQUEL edges (branch), pick the linear path (e.g. prefer the
  same-`format` TV continuation) and surface the rest via F2's Related rail rather
  than forcing them into the linear chain.
- UI: promote F2's inline "Seasons" ordering in `app/anime/[id].tsx` (or its
  `RelationsRail`/seasons component) to consume the resolved deep chain, rendering
  progressively as hops arrive with a subtle loading affordance on the tail.
- **Limitation to document:** AniList exposes relations only as a graph with no
  season-number field, so the "correct" linear order is heuristic at branch
  points. Deep walks are inherently multi-request — this is why F2 ships the cheap
  single-fetch neighbors first and defers the full walk here.

---

## F8 — Super Follow (per-title new-season announcement alerts)

**Goal:** Let a user explicitly "Super Follow" a specific title and get notified
the moment a new season/sequel of it is *announced* on AniList — not just when it
starts airing.

### How this differs from F3
F3 passively surfaces upcoming sequels for the user's whole list in an "Upcoming"
screen and offers air-date reminders. F8 is an **explicit, per-title opt-in** with
a stronger promise: alert at *announcement* time (the instant a SEQUEL relation
with status `NOT_YET_RELEASED` appears), for just the handful of titles the user
deliberately marked. F3 is breadth; F8 is a sharp, user-chosen signal. They share
the same detection plumbing and notification infra.

### Requirements / acceptance criteria
- [ ] From a title's detail screen, the user can toggle "Super Follow" on/off
      (independent of whether the title is on their watch list).
- [ ] Super-followed titles are listed somewhere the user can review/manage them.
- [ ] When a new sequel/season of a super-followed title is announced, the user is
      alerted — even if they haven't watched/completed it.
- [ ] Each announcement alerts exactly once: no repeat alerts for a season already
      surfaced, and no alert for sequels that existed when the follow was created.
- [ ] Toggling off stops all alerts for that title.
- [ ] Works offline-tolerantly: the follow set persists locally and survives
      relaunch.

### Technical approach
- **Follow set (local):** add a small store + repository alongside tracking
  (`src/features/tracking/` is the pattern — a `SuperFollowRepository` persisting a
  `Set<mediaId>` under a `senpai:superfollow:v1` AsyncStorage key, exposed via a
  zustand store like `useTrackingStore`). A super-follow is just a media id, so it
  doesn't require the title to be a `TrackEntry`.
- **Snapshot for dup-free detection:** on follow, store the set of currently-known
  SEQUEL/child relation node ids for that title (from F2's `relations`, fetched via
  `getAnimeById` / `MEDIA_BY_ID_QUERY`). "New announcement" = a SEQUEL node id not
  in the stored snapshot. Update the snapshot when an alert fires so it never
  repeats.
- **Detection on app-open (no backend):** a hook (e.g. `useSuperFollowChecks` in
  `src/api/anilist/`) batch-fetches relations for the followed ids, diffs against
  the stored snapshots, and schedules a local notification for any new sequel —
  reusing F3's `expo-notifications` setup (needs the dev build). Batch + cache via
  TanStack Query to respect the ~90 req/min limit.
- **True announcement push (app closed):** requires a server polling AniList for
  the followed ids and pushing when a new relation appears — this is the F1 backend
  + push-token plumbing. Document that without F1, detection is app-open only
  (same limitation noted in F3).
- **UI:** a bell/"Super Follow" toggle in `app/anime/[id].tsx` (near the
  Add-to-list action), and a managed list (a section in Library or a dedicated
  screen) reusing `PosterCard`.
- **Overlap with F28:** F28 ships a general "new-episode/new-season for my whole
  list" feed first, with its own snapshot-diff detection loop. F8 is narrower
  (explicit per-title follow, not gated on watch status) and can eventually
  funnel its alerts into F28's same notification center/store rather than
  inventing a second inbox — worth revisiting once both exist.

---

## F18 — Tag browse + genre × season composition (remaining scope)

The core of F18 **shipped**: `app/browse.tsx` with genre multi-select, sort
(Popularity/Score/Trending), one-tap reset, and an infinite `PosterCard` grid,
backed by `BROWSE_QUERY` + `useBrowse`/`useGenres`. Two deferred pieces remain.

### Requirements / acceptance criteria
- [ ] Browse/filter by AniList **tags**, not just genres. `tag_in` is already
      supported server-side; the UX needs a searchable tag picker (there are
      hundreds of tags, so a flat chip row like genres won't scale).
- [ ] Compose the genre filters with the shipped seasonal browser (F4):
      genre + season + year in one view.

### Technical approach
- Extend the shipped `BrowseFilters` / `browse()` to carry `tags` and optional
  `season`/`seasonYear`, threading them into `BROWSE_QUERY` (`tag_in`, `season`,
  `seasonYear`).
- Add a tag picker (search + recently-used) rather than rendering all tags; fetch
  the tag list from AniList's `MediaTagCollection`, cached once like genres.
- Either fold season/year controls into `app/browse.tsx` or let `app/seasons.tsx`
  hand its season+year into the browse filters.

---

## F22 — Per-screen signature treatments & motion

**Goal:** Give each major screen its own distinct, intentional visual identity
and tasteful motion — so Discover, Library, Schedule, Detail, Stats, etc. each
feel purpose-built rather than like one generic list reskinned — without breaking
the shared token system or theme switching.

### How this differs from existing work
The shipped theme system (`src/theme/tokens.ts` + `ThemeContext`) already varies
*palette* globally across themes. F22 is orthogonal: it varies *layout language and
motion per screen* (within whatever theme is active), e.g. an editorial hero on
Discover vs. a dense quiet grid on Library vs. a timeline rhythm on Schedule.
The shipped Wrapped story is one-off story motion; F22 is the everyday in-app polish layer.

### Requirements / acceptance criteria
- [ ] Each of the core screens (`app/(tabs)/index.tsx` Discover, `library.tsx`,
      `schedule.tsx`, `app/anime/[id].tsx` Detail, `app/stats.tsx`) has a documented,
      deliberate visual treatment that differentiates it (hero/grid/timeline/etc.),
      not just the same card list.
- [ ] All treatments are built from the existing tokens (`spacing`, `radii`,
      `typography`, `colors`, `gradients`) — no hard-coded hexes or magic numbers —
      so every theme still looks coherent and live theme switching is unaffected.
- [ ] Tasteful, consistent motion: shared screen-transition + list-item entrance +
      press feedback, with a single reusable motion spec (durations/easings) rather
      than ad-hoc per-component values.
- [ ] Motion honors the OS "reduce motion" setting (`AccessibilityInfo`): animations
      degrade to instant/opacity-only when reduce-motion is on.
- [ ] No regression in scroll performance on the list-heavy screens (Library/Schedule).
- [ ] Each design choice is captured briefly (a short note in the theme/docs) so the
      per-screen intent is intentional and reviewable, not accidental.

### Technical approach
- **Motion tokens first:** extend `src/theme/tokens.ts` with a theme-invariant
  `motion` block (durations + easing curves + standard spring config) so animation
  values live in the token system like spacing/radii do. Add a `useReducedMotion()`
  helper (wrapping `AccessibilityInfo.isReduceMotionEnabled` + the change event)
  and gate every animation on it.
- **Reusable primitives:** add a couple of small wrappers under `src/components/ui/`
  — e.g. an `AnimatedScreen`/entrance fade-slide and a `Pressable` scale-on-press —
  built on the already-installed `react-native-reanimated@4.2.1`, consumed by
  screens so motion is consistent and centralized.
- **Per-screen identity:** define each screen's signature treatment on top of the
  existing component kit rather than forking it — e.g. promote `FeaturedCard` into a
  parallax editorial hero on Discover, keep Library a calm token-spaced grid of
  `PosterCard`/`LibraryRow`, give Schedule a timeline spine on `ScheduleRow`, and add
  a collapsing/parallax header to `app/anime/[id].tsx`. Reuse `SectionHeader` and the
  poster/row components so the variation is in layout + motion, not bespoke styling.
- **Detail header & shared transition:** use expo-router's screen options and
  reanimated scroll handlers in `app/anime/[id].tsx` for the collapsing header; apply
  a single consistent stack transition in `app/_layout.tsx` / `(tabs)/_layout.tsx`.
- **Scope guard:** this is a polish pass, not a redesign — land it screen-by-screen
  behind the shared primitives so each screen can be reviewed and tuned independently,
  and so a screen with no special treatment still works with the default motion.

**Open question (worth a quick decision when we start):** how *divergent* should the
screens be — subtle accents on a unified language (safer, more cohesive) vs. bold,
genuinely distinct per-screen aesthetics (more striking, higher inconsistency risk)?
Default to the cohesive end and dial up per screen.

---

## F26 — Network resilience: AniList 429 / Retry-After + request timeout

**Goal:** Degrade gracefully when AniList rate-limits or hangs, instead of blind
retries and indefinitely-pending requests.

### The gap
`src/api/anilist/client.ts` documents "retry-after handling on 429" as a future
concern but doesn't implement it; the global TanStack config
(`src/providers/QueryProvider.tsx`) uses `retry: 2`, which **retries a 429
immediately** and can deepen the rate-limit hole. There's also no request
timeout — a stalled fetch stays pending forever.

### Requirements / acceptance criteria
- [ ] On HTTP 429, honor the `Retry-After` header (back off, don't hammer).
- [ ] Don't retry non-retriable errors (e.g. 404 from a bad username/id).
- [ ] Requests time out and surface a clean error rather than hanging.
- [ ] Behavior is centralized so all queries inherit it.

### Technical approach
- Add 429/`Retry-After` handling and an `AbortController` timeout in
  `anilistRequest` (`client.ts`) — the existing single choke point for all reads.
- Replace the blanket `retry: 2` with a function that skips 4xx (except 429) and
  defers to the backoff for 429.

---

## F27 — Web runtime robustness (ErrorBoundary, bounded cache persistence, sheet a11y)

**Goal:** Harden the deployed web build against whole-app crashes, storage-quota
failures, and a couple of web-only UX gaps.

### Requirements / acceptance criteria
- [ ] A render error in one screen shows a recoverable fallback (with a reload/back
      action) instead of white-screening the whole app — there's no `ErrorBoundary`
      today, so any uncaught render throw kills everything.
- [ ] The persisted TanStack query cache can't blow the browser's localStorage
      quota: today `PersistQueryClientProvider` dehydrates **all** queries
      (`QueryProvider.tsx`), including every infinite list + covers, to
      AsyncStorage→localStorage (~5 MB on web). A quota write failure should not
      break the app, and large/low-value queries shouldn't be persisted.
- [ ] `BottomSheet` (`src/components/ui/BottomSheet.tsx`) closes on `Escape` and
      restores focus on web (native `Modal.onRequestClose` doesn't fire for web Esc).

### Technical approach
- Add a root `ErrorBoundary` in `app/_layout.tsx` (class component or
  `react-error-boundary`) wrapping the navigator, themed via tokens.
- Add a `dehydrateOptions.shouldDehydrateQuery` filter (and/or `maxAge`/size cap)
  to the persister so only small, high-value queries persist; wrap the persist
  restore so a quota error degrades to in-memory-only.
- In `BottomSheet`, add a web-only `keydown` Escape listener while open.

---

## F28 — Notification center (new-episode/new-season alerts, in-app feed)

**Goal:** Give the user one place — a bell icon + notification center — that
surfaces "a new episode of X just aired" and "a new season of X was announced"
for their tracked anime, detected when the app is opened (no backend push server
exists, so this is honestly scoped as on-open detection, not true push).

### The gap
There is no notification system in the app today. F3 (Upcoming screen) and F8
(Super Follow) each sketch their *own* narrow alerting UI for a slice of this
problem (whole-list upcoming sequels; explicit per-title follows) but neither is
built, and neither proposes a persistent, reviewable list of past alerts. F28 is
the general-purpose piece: a single notification feed covering the two most
valuable signals — new episodes and new seasons — for everything the user is
already tracking, with read/unread state, that F3/F8 can point at later instead
of building their own inboxes.

### What "notification" means here (no backend)
Every AniList read in this app happens on-demand (`src/api/anilist/`); there is
no server, so nothing can be pushed to a closed app. F28's notifications are
computed client-side by **diffing fresh AniList data against a locally stored
snapshot of what was last seen**, run when the app is opened (and on manual
pull-to-refresh in the notification center). This is the same honest limitation
F3/F8 already document — see "Shared prerequisites" above.

### Requirements / acceptance criteria
- [ ] A bell icon (with an unread-count badge) is reachable from the app's main
      screen and opens a dedicated notification center.
- [ ] The notification center lists new-episode and new-season events for the
      user's tracked titles, newest first, each showing the title, a poster
      thumbnail, a human-readable message ("Episode 12 is out", "Season 2
      announced"), and a relative timestamp.
- [ ] Unread notifications are visually distinguished from read ones; opening a
      notification (or a per-row action) marks it read; a "mark all read" action
      exists; the bell badge count reflects unread notifications and clears
      accordingly.
- [ ] Tapping a notification navigates to the relevant anime's detail screen
      (the source title for a new episode; the newly-announced sequel for a new
      season).
- [ ] An empty state ("You're all caught up") shows when there are no
      notifications yet.
- [ ] No duplicate notification is ever created for the same episode or the same
      newly-announced season — running detection twice in a row produces no new
      rows the second time.
- [ ] Installing this feature on an existing list with history does **not**
      flood the user with a notification per already-existing episode/season on
      first run — only events detected *after* the feature starts tracking a
      title generate a notification (first sight of a title silently baselines
      it).
- [ ] Detection runs automatically on app open and is rate-limit-conscious (not
      a fresh unbounded AniList call per tracked title on every single foreground).
- [ ] Works identically on web and native (this is a universal Expo Router app);
      on native, a stretch (not required) is a local `expo-notifications` alert
      fired alongside a new in-app notification — explicitly optional, gated
      behind its own opt-in, and out of scope for the initial pass since it needs
      the dev-build notifications infra noted in "Shared prerequisites."

### Technical approach
- **New feature module `src/features/notifications/`**, mirroring the
  `src/features/tracking/` repository/store split:
  - `types.ts` — `AppNotification` (id/type/mediaId/title/cover/message/
    episode info/sequel info/createdAt/read) and `NotificationSnapshot`
    (per-mediaId last-seen released-episode count + known SEQUEL relation ids +
    an `initialized` bootstrap flag, so a title's *first* check seeds the
    snapshot without emitting anything).
  - `repository.ts` — an `AsyncStorageNotificationRepository` for the
    notification list (`senpai:notifications:v1`), same read-modify-write +
    serial-queue pattern as `AsyncStorageTrackingRepository`.
  - A second small repository/keyspace for snapshots
    (`senpai:notification-snapshots:v1`) — kept separate from the user-facing
    notification list since its lifecycle (internal dedupe cache) is different.
  - `store.ts` — a zustand `useNotificationStore` (entries, hydrated, hydrate,
    add, markRead, markAllRead, unread count selector), following
    `useTrackingStore`'s shape.
  - `detect.ts` — `runNotificationDetection()`: for each tracked entry whose
    status makes it eligible (episode checks: `CURRENT`/`REPEATING`/`PAUSED`;
    season checks: `COMPLETED`), batch-fetch `getAnimeById` (already returns
    `episodes`, `nextAiringEpisode`, and `relations` in one call — see
    `src/api/anilist/index.ts`), diff against the stored snapshot, emit
    `AppNotification`s for newly released episodes / newly appeared SEQUEL
    relation nodes, and update the snapshot. Internally throttled (e.g. skip if
    the last global run was under ~15 min ago, unless force-refreshed) and
    capped in fan-out per run to respect AniList's ~90 req/min limit — same
    concern F3/F7/F8 already call out.
- **Wiring:** `app/_layout.tsx` hydrates the new store alongside the existing
  `hydrateTracking`/`hydrateComfort`/etc. calls and fires
  `runNotificationDetection()` once tracking is hydrated (mirrors the existing
  `pullAndReconcile()` on-auth effect).
- **UI:** a bell icon + unread badge added to the Discover header row in
  `app/(tabs)/index.tsx` (next to the existing settings avatar button),
  navigating to a new `app/notifications.tsx` screen registered in the root
  `Stack` (`app/_layout.tsx`) with `slide_from_bottom`, matching
  `settings`/`stats`/`comfort`. The screen follows `settings.tsx`'s
  back-button-header pattern, a `FlatList` of rows (poster thumbnail via
  `expo-image`, message, relative time via the already-installed `date-fns`,
  unread dot), `EmptyState` for the empty case, and pull-to-refresh calling
  `runNotificationDetection({ force: true })`.
- **True push (app closed):** out of scope, same as F3/F8 — needs the
  not-yet-built push server polling AniList. Local `expo-notifications` alerts
  *while the app is foregrounded* are a documented native stretch only.

---

## F29 — Notification delivery layer (per-category settings, native local push, status-change events)

**Goal:** Extend the shipped F28 notification center with a settings screen for
per-category opt-in/out, native local push via `expo-notifications` on
iOS/Android (as a foreground/dev-build stretch, not true app-closed delivery),
and a broader event model that also covers status changes (e.g.
`RELEASING → FINISHED`), not just new episodes and new seasons.

### How this extends F28
F28 shipped the detection loop, the persisted event log, and the web/universal
in-app feed (bell icon + `/notifications` screen) — that's the foundation this
item builds on, not a duplicate of it. F29 adds:
1. A **settings screen** so users can opt in/out per event category, instead of
   all detected events always landing in the feed.
2. A **native delivery fork**: on iOS/Android, opted-in events *also* schedule a
   local `expo-notifications` alert (foreground-triggered, dev build required —
   see "Shared prerequisites" above) with a tap target that deep links to the
   title. On web this is a no-op since the event is already in the feed.
3. A **third event type**, `status_change`, alongside F28's `new-episode` and
   `new-season` — e.g. a tracked title flipping `RELEASING → FINISHED`.

### Requirements / acceptance criteria
- [ ] A notification settings screen (or section within existing Settings) lets
      the user opt in/out per category: new episode, new season, status change.
      Opted-out categories are not written to the feed and don't schedule local
      push.
- [ ] **Mobile (iOS/Android):** opted-in events also schedule a local
      notification via `expo-notifications` (dev build required — Expo Go
      doesn't support this on current SDKs) with a tap target that deep links
      to the relevant title's detail screen.
- [ ] `status_change` detection: extend `runNotificationDetection` (F28's
      `src/features/notifications/detect.ts`) to also diff a tracked title's
      AniList `status` field against the stored snapshot and emit an event on
      `RELEASING → FINISHED` (start with this one transition; others are a
      follow-up).
- [ ] Per-category preferences persist locally and are respected by both the
      detection loop (whether to write an event at all) and the native delivery
      fork (whether to also schedule a push).
- [ ] Documented limitation carried over from F28: without a backend, all
      detection still happens on app open/foreground — this applies to status
      changes and native local push exactly as it does to F28's existing event
      types.

### Technical approach
- **Reuse, don't fork, F28's model:** extend `AppNotification`'s `type` union
  with `'status-change'` and extend `NotificationSnapshot` with whatever
  status-tracking field the diff needs (e.g. `lastKnownStatus`) rather than
  introducing a parallel event/repository system.
- **Settings:** a small preferences object (e.g.
  `{ newEpisode: boolean; newSeason: boolean; statusChange: boolean }`),
  persisted via AsyncStorage (mirror F28's repository pattern), read by
  `detect.ts` before writing an event and by the native delivery fork before
  scheduling a push.
- **Native delivery fork:** `Platform.OS !== 'web'` branch inside (or just
  after) `store.add` — call `expo-notifications`' local scheduling API with a
  deep link into `app/anime/[id].tsx`. Needs the dev-build / config-plugin setup
  noted under "Shared prerequisites" above (already installed, not yet wired to
  any code).
- **True push (app closed):** still out of scope — needs the not-yet-built push
  server polling AniList, same as F3/F8/F28.

---
