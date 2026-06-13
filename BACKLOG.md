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
| F2 | Anime relations / season linking | P2 | M | — |
| F3 | New-season alerts for watched anime + Upcoming screen | P2 | M–L | F2, Notif. infra, (F1 for true push) |
| F4 | Seasonal browser (any winter/spring/summer/fall) | P3 | S–M | — |
| F5 | Recommender ("similar to X" / for you) | P2 | M | — |
| F6 | Multiple themes (incl. cozy pastel) | P2 | M | Theme refactor |
| F7 | Deep multi-hop season chain (full S1→S2→S3 ordering) | P3 | M | F2 |

**Suggested build order** (fast value first, heavy infra last):
`F2 → F4 → F5 → F6 → F1 → F3 → F7`. Quick AniList-data wins (F2/F4/F5) ship value with
no new infrastructure; F6 is a self-contained refactor; F1 + F3 are the
foundational/infra-heavy pair. Reorder freely — entries are independent except
where "Depends on" says otherwise.

### Shared prerequisites (cross-cutting)
- **Notifications infrastructure** (needed by F3): `expo-notifications` setup +
  a **development build** (push/scheduled notifications don't run in Expo Go on
  current SDKs). One-time setup, then reusable.
- **Theme refactor** (needed by F6): move components off the static `colors`
  import onto a `useTheme()` hook. Benefits everything.
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

## F2 — Anime relations / season linking

**Goal:** From any anime, see and jump to its related entries — sequels, prequels,
side stories — so from S1 you can discover S2, S3, etc.

### Requirements / acceptance criteria
- [ ] The detail screen shows a "Related" rail of connected anime.
- [ ] Each related item is labeled by relation type (Sequel, Prequel, Side story,
      Movie, …) and tapping it opens that anime's detail.
- [ ] If a clean sequel/prequel chain exists, present it as an ordered
      "Seasons" list (S1 → S2 → S3).
- [ ] Items the user already tracks show their status dot (reuse `PosterCard`).

### Technical approach
- Extend the detail query (`MEDIA_BY_ID_QUERY` in `queries.ts`) with:
  `relations { edges { relationType node { id title coverImage format
  seasonYear status } } }`.
- Add `RelationEdge` / `RelationType` types to `api/anilist/types.ts`
  (SEQUEL, PREQUEL, SIDE_STORY, PARENT, ALTERNATIVE, SPIN_OFF, …).
- New component `RelationsRail` (horizontal list of compact poster cards with a
  relation-type badge); render it in `app/anime/[id].tsx` below the info card.
- **Nuance to document:** AniList has no "season number" field — relations form a
  graph. To produce a linear season list, walk PREQUEL/SEQUEL edges from the
  current node. Keep this as a helper in `lib/`.

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

## F4 — Seasonal browser (any season, past & future)

**Goal:** Browse any anime season/year, not just the current one.

### Requirements / acceptance criteria
- [ ] User can pick a season (Winter/Spring/Summer/Fall) and year and see that
      season's anime grid.
- [ ] Easy nav to previous/next season and quick "current season" reset.
- [ ] Future seasons (not-yet-released) are browsable too.

### Technical approach
- Backend already exists: `getSeasonal(season, year)` + `SEASONAL_QUERY`. The
  current `useSeasonal()` hook is hardcoded to the current season — add a
  parameterized `useSeasonalBrowse(season, year)` hook.
- Add `prevSeason()` / `nextSeason()` helpers next to `currentSeason()` in
  `api/anilist/index.ts`.
- UI: a season segmented control + year stepper. New screen `app/seasons.tsx`
  (push from Discover) or a "Seasons" entry point. Reuse `PosterCard` grid.

---

## F5 — Recommender ("similar to X" and "for you")

**Goal:** Help users find their next watch from something they like.

### Requirements / acceptance criteria
- [ ] On a detail screen, a "More like this" rail of similar anime.
- [ ] A "For you" view: recommendations aggregated from the user's liked/completed
      list, excluding anime they already track.
- [ ] Tapping a recommendation opens its detail.

### Technical approach
- AniList provides per-title recommendations: add
  `recommendations(sort: RATING_DESC) { nodes { rating mediaRecommendation
  { ...MediaFields } } }` to the detail query (or a dedicated query/hook).
- Component `RecommendationsRail` on the detail screen.
- "For you": fetch recommendations for the user's top liked/completed entries,
  tally by frequency × rating, drop already-tracked ids, sort. Compute
  client-side; cache via TanStack Query and cap fan-out to respect rate limits.
- Later upgrade: genre/tag affinity scoring computed from the user's list.

---

## F6 — Multiple themes (incl. cozy pastel)

**Goal:** Let users switch the app's look — at minimum the current dark theme and
a cozy, lighter pastel theme.

### Requirements / acceptance criteria
- [ ] User can choose a theme from settings; choice persists across launches.
- [ ] At least: "Midnight" (current dark) and "Cozy" (light pastel).
- [ ] Optional "Follow system" (light/dark) mode.
- [ ] All screens, the status bar, and gradients adapt; text stays legible
      (contrast checked) in every theme.

### Technical approach
- **Refactor (the bulk of the work):** today components import `colors`
  statically from `src/theme`. Introduce a `ThemeProvider` + `useTheme()` hook
  returning the active palette, and migrate components to consume it instead of
  the static import. `tokens.ts` already separates the raw `palette` from
  semantic names (`colors`, `gradients`) — that's the clean swap surface; define
  multiple palettes sharing the same shape.
- Persist the selection with a small zustand store + AsyncStorage (same pattern
  as tracking; could add a `PreferencesRepository`).
- Drive `<StatusBar>` style and screen background from the active theme.
- **Note:** a light/pastel theme is not an inversion — every color (text on light
  surfaces, overlays/scrims on posters, skeleton shades) needs a deliberate value
  and a contrast check. Budget time for visual QA per screen.

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
