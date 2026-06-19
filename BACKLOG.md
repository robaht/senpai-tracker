# Senpai — feature backlog

Planned features beyond the MVP. Each entry has user-facing requirements
(acceptance criteria) and a technical approach grounded in the current codebase,
so any one can be picked up cold and started smoothly.

> **Current state — where the watch list lives:** on-device only. All tracking
> goes through `TrackingRepository` → `AsyncStorageTrackingRepository`
> (`src/features/tracking/repository.ts`), persisted as a single JSON blob under
> the AsyncStorage key `senpai:tracking:v1` (localStorage on web). Per-device, no
> account, no sync. Feature **F1** changes this.

## Priority & effort overview

| ID | Feature | Priority | Effort | Depends on |
|----|---------|----------|--------|------------|
| F1 | User accounts & cloud sync | P1 | L | — |
| F3 | New-season alerts for watched anime + Upcoming screen | P2 | M–L | Notif. infra, (F1 for true push) |
| F7 | Deep multi-hop season chain (full S1→S2→S3 ordering) | P3 | M | — (extends shipped F2) |
| F8 | Super Follow (per-title new-season announcement alerts) | P2 | M | Notif. infra, F1 (true push) |
| F18 | Tag browse + genre × season composition (genre browse shipped) | P3 | S–M | — (extends shipped genre browse) |
| F22 | Per-screen signature treatments & motion | P3 | M | — (builds on shipped theme/token system) |

**Suggested build order** (fast value first, heavy infra last):
`F1 → F3 → F7 → F8 → F18`.
Start with the heavier discovery/infra items (F1/F3/F7/F8), with F18's small
leftover (tags + season composition) as low-priority polish. Reorder freely —
entries are independent except where "Depends on" says otherwise.

### Shared prerequisites (cross-cutting)
- **Notifications infrastructure** (needed by F3): `expo-notifications` setup +
  a **development build** (push/scheduled notifications don't run in Expo Go on
  current SDKs). One-time setup, then reusable.
- **Cloud backend** (F1): also what enables *true* server-pushed alerts in F3.

---

## F1 — User accounts & cloud sync

**Goal:** Let a user own their list across devices instead of it living on one phone.

### Requirements / acceptance criteria
- [ ] User can create an account and sign in.
- [ ] The watch list syncs across devices for the same account.
- [ ] Offline-first is preserved: the app still works with no connection; changes
      made offline sync when back online.
- [ ] On first login, any existing on-device list is merged into the account
      (no data loss for current local users).
- [ ] Sign-out clears the in-memory list but keeps the local cache intact.

### Two viable approaches
1. **AniList OAuth (zero backend).** "Log in with AniList"; read/write the user's
   real AniList `MediaList` via GraphQL mutations (`SaveMediaListEntry`,
   `DeleteMediaListEntry`). Fastest path; taps lists they may already have.
   Trade-off: requires an AniList account; data model tied to AniList.
2. **Custom backend (Supabase recommended).** Email/social auth + a Postgres
   table mirroring `TrackEntry`. Full control; enables storing app-specific data
   later (theme prefs, recommendation history). Trade-off: a backend to build/host.

> Decision to make when we start: AniList OAuth if you want zero backend + existing
> lists; Supabase if you want your own user base and custom data. Given the rest of
> the roadmap (themes prefs, rec history), Supabase is the more future-proof pick.

### Technical approach
- Add a new `TrackingRepository` implementation (`SupabaseTrackingRepository` or
  `AniListTrackingRepository`) and swap the exported instance in
  `repository.ts`. **This is the payoff of the repository seam — no screen or
  store changes.**
- Sync strategy: keep the local AsyncStorage repo as the offline cache; layer a
  sync engine that pushes/pulls and resolves conflicts using the existing
  `updatedAt` field on `TrackEntry` (last-write-wins to start).
- Auth: `expo-auth-session` (OAuth) or Supabase JS client. Add an auth context +
  an `app/(auth)/` route group with a login screen; gate sync on auth state.
- Migration: on first authenticated launch, `replaceAll`/merge local → cloud.

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
