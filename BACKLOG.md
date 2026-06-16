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
| F5 | Recommender ("similar to X" / for you) | P2 | M | — |
| F7 | Deep multi-hop season chain (full S1→S2→S3 ordering) | P3 | M | — (extends shipped F2) |
| F8 | Super Follow (per-title new-season announcement alerts) | P2 | M | Notif. infra, F1 (true push) |
| F18 | Genre / tag browse & filters | P2 | M | — (pairs with F4) |
| F20 | Import list from MyAnimeList | P2 | M | — (shares shipped import/merge plumbing) |
| F21 | Anime Wrapped (shareable year-in-review story) | P3 | M–L | shipped F14 (stat derivation); needs share/export plumbing |

**Suggested build order** (fast value first, heavy infra last):
`F21 → F18 → F5 → F1 → F3 → F7 → F8`.
Start with the shareable insights story (F21, building on shipped F14). The heavier
discovery/infra items (F18/F5/F1/F3/F7/F8) come last. Reorder freely — entries
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

## F18 — Genre / tag browse & filters

**Goal:** Discovery beyond free-text search — browse by genre/tag with sorting.

### Requirements / acceptance criteria
- [ ] The user can browse anime filtered by one or more genres (and optionally tags).
- [ ] Results can be sorted (e.g. Popularity, Score, Trending).
- [ ] Filters compose with the shipped seasonal browser (F4) where it makes sense
      (genre + season + year).
- [ ] Clear active-filter display and a one-tap reset.

### Technical approach
- AniList's `Page.media` already supports `genre_in`, `tag_in`, and `sort` — add a
  `BROWSE_QUERY` (or generalize `SEARCH_QUERY`) in `src/api/anilist/queries.ts`
  plus a `browse(filters, page)` fn in `src/api/anilist/index.ts` and a
  `useBrowse(filters)` hook in `src/api/anilist/hooks.ts` (genre list itself comes
  from AniList's `GenreCollection`, fetched once + cached).
- New screen `app/browse.tsx` (or fold into the shipped F4 seasons screen): a genre chip
  multi-select + sort control, rendering the existing `PosterCard` grid.
- Builds naturally on F16's infinite-scroll once that lands; cap fan-out for the
  rate limit.

---

## F20 — Import list from MyAnimeList

**Goal:** Let a MAL user bring their existing anime list into Senpai in one go,
so switching trackers isn't a from-scratch re-entry.

> **Is this legally OK?** Yes, via user-initiated paths: importing the user's own
> MAL **XML export** (Profile → Export, a gzipped XML the user downloads), or
> reading their list through MAL's **official OAuth2 API** with their consent.
> Both are the user acting on their own data. What to avoid is scraping MAL's HTML
> pages (against their ToS). Default to XML import — no API client, no auth, no
> rate limits, and it's unambiguously the user's data.

### Requirements / acceptance criteria
- [ ] The user can import their MAL list (start with a MAL XML export file).
- [ ] Imported entries map to the right Senpai status, episode progress, and score.
- [ ] Entries resolve to the correct AniList title (so detail/relations/airing all
      work afterward), and unresolved titles are reported rather than silently dropped.
- [ ] Import merges with the existing list without clobbering newer local entries;
      re-importing is idempotent (no duplicates).
- [ ] Clear progress + summary ("imported 142, skipped 3") and it stays within
      AniList's ~90 req/min limit.

### Technical approach
- **Parse:** accept a MAL XML export via `expo-document-picker`; read the `<anime>`
  nodes — `series_animedb_id` (MAL id), `series_title`, `my_status`,
  `my_watched_episodes`, `my_score` (already 0–10, same scale as `TrackEntry.score`).
- **Map status** MAL → our `WatchStatus` (`src/features/tracking/types.ts`, which
  mirrors AniList): Watching→`CURRENT`, Completed→`COMPLETED`, On-Hold→`PAUSED`,
  Dropped→`DROPPED`, Plan to Watch→`PLANNING`.
- **Resolve ids:** our tracking is keyed by *AniList* id, and `MEDIA_FIELDS` already
  fetches `idMal`. AniList lets you query by MAL id — add a query/fn (e.g.
  `Page(perPage: 50) { media(idMal_in: $malIds, type: ANIME) { ...MediaFields } }`)
  in `src/api/anilist/queries.ts` / `index.ts`, batched in chunks of ~50 and cached
  via TanStack Query to respect the rate limit. Build `TrackEntry`s from the
  resolved `Media` (reusing the store's `snapshotFromMedia`).
- **Merge:** reuse the **shipped** import/merge plumbing — `useTrackingStore.importFromList(list, mode)`
  (last-write-wins by `updatedAt`, built for the AniList-username import) and the
  repository's `replaceAll`. MAL import just needs to produce the same
  `ImportedListEntry[]` shape and hand it to `importFromList`.
- **UI:** an "Import from MyAnimeList" row in `app/settings.tsx` with a picker,
  progress, and an unresolved-titles summary.
- **Optional upgrade (later):** MAL official OAuth2 API for a no-file, live import
  — heavier (register a client id + `expo-auth-session` flow), defer until the XML
  path proves the mapping/merge.

---

## F21 — Anime Wrapped (shareable year-in-review story)

**Goal:** A swipeable, animated, shareable "year in anime" — Spotify-Wrapped-style
— generated from the user's tracked list.

### How this differs from F14
F14 is an always-on **stats dashboard** you open to look things up. F21 is a
seasonal, narrative, full-screen **story** you swipe through and share to social.
F14 = reference; F21 = a moment built to be screenshotted and posted. They share
the same underlying stat derivation; F21 is the presentation/virality layer on top.

### Requirements / acceptance criteria
- [ ] A full-screen, swipeable sequence of story cards (tap or swipe to advance),
      each surfacing one headline stat with a bold visual treatment.
- [ ] Cards cover the highlights: titles completed, episodes watched, estimated
      hours, top genre(s), highest-rated title, busiest period, status breakdown.
- [ ] A "personality"/standout card (e.g. your #1 by score, or most-binged title).
- [ ] A final summary card is exportable as an image to the OS share sheet
      (Instagram / X / etc.).
- [ ] Scoped to a period (default: current year, year selectable) and computed
      entirely from the local list — works offline.
- [ ] Tasteful motion: cards animate in; honors the OS "reduce motion" setting.
- [ ] Graceful with a sparse list (few entries): still yields a coherent story or
      a friendly "not enough watched yet" state.

### Technical approach
- **Data (shared with F14):** derive everything from `useTrackingStore` entries
  (`src/features/tracking/store.ts`), filtered to the period via
  `TrackEntry.updatedAt`. Factor the math into a shared `computeStats(entries,
  range)` helper so F14's dashboard and F21's story read from one source of truth.
  Same snapshot caveat as F14 — the `TrackEntry` snapshot lacks `duration`/`genres`,
  so hours and genre breakdown need either extending `snapshotFromMedia` going
  forward or hydrating from the TanStack Query detail cache; document the estimate.
- **Screen:** new `app/wrapped.tsx` as a full-screen modal route (expo-router),
  pushed from the Library/Settings header and from F14's stats screen. A
  horizontally-paged `FlatList` (or a `react-native-reanimated` pager) of
  `WrappedCard`s, with a segmented progress bar on top and tap-to-advance + swipe.
- **Motion:** `react-native-reanimated` for entrance/parallax; gate it on
  `AccessibilityInfo.isReduceMotionEnabled` for the reduce-motion path.
- **Share/export:** capture a card to an image with `react-native-view-shot`
  (`captureRef`), then share via `expo-sharing` + `expo-file-system`. This share
  plumbing is **net-new** — the shipped AniList import only *reads* a list, so no
  file-export/share path exists yet. Use a dedicated share-card layout (9:16 /
  square) distinct from the on-screen card so exports look intentional.
- **Visuals:** hand-rolled `View`s + gradients on the existing token system (no
  charting dep), reusing `statusColor`, `SectionHeader`, and `Card`, matching F14.
- **Limitation to document:** tracking has no true "watched-on" timestamp beyond
  `updatedAt`, so per-month/season attribution is approximate until richer history
  is stored — call this out in the "busiest period" card.
