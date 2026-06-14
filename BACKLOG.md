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
| F4 | Seasonal browser (any winter/spring/summer/fall) | P3 | S–M | — |
| F5 | Recommender ("similar to X" / for you) | P2 | M | — |
| F7 | Deep multi-hop season chain (full S1→S2→S3 ordering) | P3 | M | — (extends shipped F2) |
| F8 | Super Follow (per-title new-season announcement alerts) | P2 | M | Notif. infra, F1 (true push) |
| F9 | Rate your shows (user score UI) | P1 | S | — |
| F10 | Watch trailer | P2 | S | — |
| F11 | "Continue Watching" rail | P1 | S–M | — |
| F12 | Cast & characters on detail | P2 | M | — |
| F13 | Where to watch (streaming links) | P2 | S–M | — |
| F14 | Your stats / "Year in anime" | P3 | M | — |
| F15 | Library search & sort | P2 | S | — |
| F16 | Pull-to-refresh + pagination | P2 | M | — |
| F17 | Backup / export & import (JSON) | P3 | S | — |
| F18 | Genre / tag browse & filters | P2 | M | — (pairs with F4) |

**Suggested build order** (fast value first, heavy infra last):
`F9 → F11 → F15 → F10 → F13 → F12 → F14 → F16 → F17 → F4 → F18 → F5 → F1 → F3 → F7 → F8`.
Start with the **free wins** — F9 and F10 surface data the app *already fetches*
(`TrackEntry.score` + `store.setScore` exist with no UI; `trailer` is in
`MEDIA_FIELDS` but never rendered), and F11/F15 are pure local-data UX. Then
detail depth (F13/F12), insights (F14), and plumbing (F16/F17). The heavier
discovery/infra items (F4/F18/F5/F1/F3/F7/F8) come last. Reorder freely — entries
are independent except where "Depends on" says otherwise.

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

## F9 — Rate your shows (user score UI)

**Goal:** Let users give a title their own 0–10 score and see it on the list.

> **Half-wired today:** the data model and store action already exist —
> `TrackEntry.score` (`src/features/tracking/types.ts`) and
> `setScore(mediaId, score)` (`src/features/tracking/store.ts:104`, already
> clamps 0–10). Nothing in the UI ever calls it, so the field is permanently 0.
> This feature is almost entirely UI.

### Requirements / acceptance criteria
- [ ] From an anime that's on the list, the user can set a personal score (0–10).
- [ ] The score is shown on the detail screen and in the Library row.
- [ ] The score persists across relaunch and clears cleanly (0 = unscored, hidden).
- [ ] Changing the score is one obvious gesture (no buried menu).

### Technical approach
- Add a rating control to the `TrackingPanel` in `app/anime/[id].tsx` (it already
  hosts the status row + episode stepper) — e.g. a tappable 10-point / 5-star row
  calling `useTrackingStore((s) => s.setScore)`. Reuse the `statusColor`/accent
  palette for fill.
- Surface the value in `src/components/LibraryRow.tsx` (a small `★ 8` next to the
  progress) and near the score line on the detail header in `app/anime/[id].tsx`.
- Reuse `formatScore`/the `ScoreBadge` component for consistent rendering; treat
  `score === 0` as unscored everywhere.
- No new persistence work — `setScore` already routes through the repository.

---

## F10 — Watch trailer

**Goal:** Play a title's trailer from the detail screen.

> **Already fetched, never shown:** `MEDIA_FIELDS` in
> `src/api/anilist/queries.ts` already requests `trailer { id site thumbnail }`,
> and it's on the `Media` type — but no screen renders it.

### Requirements / acceptance criteria
- [ ] When a trailer exists, the detail screen shows a clear "Watch trailer" affordance.
- [ ] Tapping it plays the trailer (YouTube or Dailymotion per `trailer.site`).
- [ ] When no trailer exists, nothing is shown (no dead button).

### Technical approach
- Build the watch URL from `media.trailer` (`youtube` → `https://youtu.be/{id}`,
  `dailymotion` → `https://dai.ly/{id}`); a thumbnail tile using `trailer.thumbnail`
  over the banner area in `app/anime/[id].tsx`.
- Simplest: open externally via `Linking.openURL` (or `expo-web-browser`). Richer:
  inline playback with a `WebView` / `expo-video` modal — start with the external
  open, upgrade later.
- Place a play overlay on the existing parallax banner, or a button in the meta row.

---

## F11 — "Continue Watching" rail

**Goal:** Resurface in-progress shows for one-tap episode logging — turn the app
from a catalog into a daily habit.

### Requirements / acceptance criteria
- [ ] A "Continue watching" rail lists `CURRENT` (and optionally `REPEATING`)
      entries, most-recently-updated first.
- [ ] Each card shows progress ("Ep 5 / 12") and a one-tap **+1 episode** control
      that updates without leaving the screen.
- [ ] Tapping the card opens the detail; the rail hides when there's nothing in progress.
- [ ] An entry that reaches its last episode is handled gracefully (e.g. nudge to
      mark Completed) — no negative/over-max counts.

### Technical approach
- Pure local data — read `useTrackingStore`, filter `status === 'CURRENT'`, sort by
  `updatedAt`. No network.
- New `ContinueWatchingRail` component (horizontal `FlatList`) placed at the top of
  Library (`app/(tabs)/library.tsx`) and/or above Trending on Discover
  (`app/(tabs)/index.tsx`).
- The +1 action calls the existing `incrementProgress(mediaId)` from the store
  (already clamps to `totalEpisodes`); reuse the stepper visual language from the
  detail `TrackingPanel`.
- Cards render from the denormalized `TrackEntry` snapshot (title/cover), so the
  rail works offline with zero fetches.

---

## F12 — Cast & characters on detail

**Goal:** Show the main characters (and their voice actors) on a title — table
stakes for an anime app, currently absent.

### Requirements / acceptance criteria
- [ ] The detail screen shows a horizontal rail of main characters with portrait + name.
- [ ] Each character optionally shows its (Japanese) voice actor.
- [ ] The rail is capped to a sensible number (e.g. top ~10 by role) with graceful
      empty/partial handling.

### Technical approach
- Extend `MEDIA_BY_ID_QUERY` (`src/api/anilist/queries.ts`) with
  `characters(sort: ROLE, perPage: 12) { edges { role node { id name { full } image { large } } voiceActors(language: JAPANESE) { id name { full } image { large } } } }`.
- Add the shape to the `Media` detail type in `src/api/anilist/types.ts` and map it
  in `getAnimeById` (`src/api/anilist/index.ts`), mirroring how `relations.edges`
  is flattened today.
- New `CharacterRail` component (reuse the rail pattern from `RelationsRail`),
  rendered in `app/anime/[id].tsx` below the info card.
- Keep it on the single detail fetch (no extra request); mind payload size by
  capping `perPage`.

---

## F13 — Where to watch (streaming links)

**Goal:** Tell users where a title legally streams (Crunchyroll, Netflix, etc.).

### Requirements / acceptance criteria
- [ ] The detail screen lists streaming platforms for the title when available.
- [ ] Each platform opens its page/site in the browser.
- [ ] Non-streaming/info links are excluded or clearly separated; nothing shown when
      there are no links.

### Technical approach
- Add `externalLinks { id site url type color icon }` to `MEDIA_BY_ID_QUERY`
  (`src/api/anilist/queries.ts`); filter to `type === "STREAMING"`.
- Extend the detail `Media` type (`src/api/anilist/types.ts`) and pass through in
  `getAnimeById` (`src/api/anilist/index.ts`).
- New `StreamingLinks` section in `app/anime/[id].tsx` — a wrap of chips
  (reuse `Badge`/`Card`) using each link's `color`/`icon`, opening `url` via
  `Linking.openURL` / `expo-web-browser`.

---

## F14 — Your stats / "Year in anime"

**Goal:** Turn the library into insights — a stats view users want to revisit and share.

### Requirements / acceptance criteria
- [ ] A stats view shows totals: titles tracked, episodes watched, estimated hours,
      and counts per status.
- [ ] A genre/format breakdown of the user's list (top genres by frequency).
- [ ] Score insights: mean user score and a simple score distribution.
- [ ] All computed from the local list; works offline.

### Technical approach
- 100% local — derive from `useTrackingStore` entries. Hours ≈ `Σ progress ×
  duration`; the `TrackEntry` snapshot lacks `duration`/`genres`, so either (a)
  extend the snapshot to store them on `track()` (`src/features/tracking/store.ts`
  `snapshotFromMedia`) going forward, or (b) hydrate from the TanStack Query detail
  cache where present. Document the approximation.
- New screen `app/stats.tsx` (push from Library header or Settings), built from
  small stat cards + a lightweight bar/donut (hand-rolled with `View`s to avoid a
  charting dep, matching the token system).
- Reuse `SectionHeader`, `Card`, and `statusColor` for the per-status rows.

---

## F15 — Library search & sort

**Goal:** Keep the Library usable as it grows past a couple dozen titles.

### Requirements / acceptance criteria
- [ ] A search box filters the Library by title (in addition to the existing status chips).
- [ ] The user can sort by recently-updated (current default), title (A–Z),
      score, and progress.
- [ ] Sort/search compose with the active status filter and update instantly.
- [ ] Empty/no-match states are handled (reuse `EmptyState`).

### Technical approach
- Local-only, in `app/(tabs)/library.tsx`. Add a `SearchBar` (already exists as
  `src/components/SearchBar.tsx`) above the chip bar and a small sort control
  (segmented chips or a sheet).
- Replace the single `updatedAt` sort with a `useMemo`'d sort keyed by a `sortBy`
  state; filter by a lowercased title `includes` over `entry.title`.
- No new data — operates on the in-memory `entries` map from `useTrackingStore`.

---

## F16 — Pull-to-refresh + pagination

**Goal:** Let users refresh and scroll past the first page on Discover, Search,
and Schedule (today they're capped at one page).

### Requirements / acceptance criteria
- [ ] Pull-to-refresh on Discover, Search, and Schedule re-fetches the first page.
- [ ] Scrolling to the end of a grid/list loads the next page (infinite scroll),
      with a footer spinner and a clean "end reached" state.
- [ ] Loading more never duplicates items and respects AniList's ~90 req/min limit.

### Technical approach
- Swap the affected `useQuery` hooks (`useTrending`, `useSeasonal`,
  `useSearchAnime`, `useAiringSchedule` in `src/api/anilist/hooks.ts`) to
  `useInfiniteQuery`, using the existing `pageInfo.hasNextPage`/`currentPage` from
  the API fns in `src/api/anilist/index.ts` as the cursor.
- Wire `onEndReached` + `refreshControl` on the `FlatList`s in
  `app/(tabs)/index.tsx` and `app/(tabs)/schedule.tsx`; flatten `data.pages` for
  `renderItem`.
- Keep `perPage` modest and rely on TanStack Query dedup/cache to stay under the
  rate limit.
- Also paginate `useTrackedAiringSchedule` (Schedule "My list"): it's id-filtered
  so it rarely overflows, but a power user tracking 50+ currently-airing titles
  would hit the same single-page (`perPage: 50`) cap.

---

## F17 — Backup / export & import (JSON)

**Goal:** Protect the local-only list from loss (uninstall, device change) before
cloud sync (F1) lands — and provide a migration on-ramp for it.

### Requirements / acceptance criteria
- [ ] The user can export their entire watch list to a JSON file (share sheet / save).
- [ ] The user can import a previously exported file, merging into (or replacing)
      the current list without corrupting existing entries.
- [ ] Export round-trips losslessly: import-of-export yields the same list.
- [ ] Clear feedback on success/failure and on how conflicts are resolved.

### Technical approach
- Export: serialize `trackingRepository.getAll()` (the same `TrackEntry[]` behind
  the `senpai:tracking:v1` key) to JSON; write + share via `expo-file-system` +
  `expo-sharing`.
- Import: `expo-document-picker` → parse/validate → merge by `mediaId` using the
  existing `updatedAt` field (last-write-wins, the same rule F1 will use). Add a
  `replaceAll`/merge path on the repository (`src/features/tracking/repository.ts`)
  and refresh the store via `hydrate()`.
- Entry point: a row in `app/settings.tsx`. This deliberately prototypes F1's
  merge/conflict logic on a smaller surface.

---

## F18 — Genre / tag browse & filters

**Goal:** Discovery beyond free-text search — browse by genre/tag with sorting.

### Requirements / acceptance criteria
- [ ] The user can browse anime filtered by one or more genres (and optionally tags).
- [ ] Results can be sorted (e.g. Popularity, Score, Trending).
- [ ] Filters compose with the seasonal browser (F4) where it makes sense
      (genre + season + year).
- [ ] Clear active-filter display and a one-tap reset.

### Technical approach
- AniList's `Page.media` already supports `genre_in`, `tag_in`, and `sort` — add a
  `BROWSE_QUERY` (or generalize `SEARCH_QUERY`) in `src/api/anilist/queries.ts`
  plus a `browse(filters, page)` fn in `src/api/anilist/index.ts` and a
  `useBrowse(filters)` hook in `src/api/anilist/hooks.ts` (genre list itself comes
  from AniList's `GenreCollection`, fetched once + cached).
- New screen `app/browse.tsx` (or fold into F4's seasons screen): a genre chip
  multi-select + sort control, rendering the existing `PosterCard` grid.
- Builds naturally on F16's infinite-scroll once that lands; cap fan-out for the
  rate limit.
