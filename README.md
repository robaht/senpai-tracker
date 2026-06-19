# Senpai — anime tracker

A cross-platform (iOS · Android · web) anime tracking app built with Expo +
React Native. Browse trending/seasonal anime, see a weekly airing schedule with
live countdowns, and track what you're watching — all backed by the AniList API.

## Run it

```bash
cd anime-tracker
npm install
npm start          # then press i / a / w, or scan the QR with Expo Go
# or target one platform:
npm run ios
npm run android
npm run web
```

Type-check anytime with `npm run typecheck`.

> Node 20.19.4+ is recommended (some Expo build tooling warns on older 20.x).

## Deploy to web

The web build is a static site (`app.json` → `web.output: "static"`), so it can be
hosted free on any static host. It's deployed to **Cloudflare Pages**, which
auto-builds on every push to `master`:

| Setting | Value |
|---|---|
| Build command | `npx expo export -p web` |
| Build output directory | `dist` |
| Node version | pinned via `.nvmrc` (20.19.4) |

To build locally: `npx expo export -p web` → output in `dist/`.

> Native-only features (push notifications, secure storage) are no-ops on web.

## Architecture

Designed **local-first, sync-ready**: everything works offline on-device today,
and cloud sync can be added later without touching the UI.

```
app/                      Expo Router screens (file-based routing)
  (tabs)/                   Discover · Schedule · Library
  anime/[id].tsx            Detail screen
src/
  theme/                  Design tokens (colors, type, spacing) — single source of truth
  components/ui/          Primitives: Text, Card, Button, Badge, Skeleton, PressableScale
  components/             Domain widgets: PosterCard, FeaturedCard, ScheduleRow, …
  api/anilist/            GraphQL client, queries, typed fns, TanStack Query hooks
  features/tracking/      Watch list: types, repository (storage seam), Zustand store
  providers/              QueryProvider (TanStack Query + offline persistence)
  lib/                    Formatting helpers
```

### Key decisions

- **Data source — AniList GraphQL.** Rich metadata, airing schedules, and
  `nextAiringEpisode` countdowns, no API key. All reads go through TanStack Query,
  which caches + dedupes (keeps us under AniList's ~90 req/min limit) and persists
  to storage so the app opens instantly and works offline.
- **Tracking — `TrackingRepository` interface.** The store and UI depend only on
  this interface. Today it's backed by `AsyncStorage` (`repository.ts`). To add
  cross-device sync, implement the same interface against AniList OAuth or Supabase
  and swap one exported instance — no screen changes.
- **Watch statuses mirror AniList's `MediaListStatus`** (`CURRENT`, `PLANNING`, …)
  and entries are keyed by AniList media id, so a future sync is a 1:1 upload, not
  a migration.
- **Styling — hand-built token system** (`src/theme`) rather than a CSS framework:
  total control over the look, zero build-config risk. Dark-first.

## Roadmap (next)

Planned features with detailed, ready-to-start requirements live in
[BACKLOG.md](BACKLOG.md): accounts & cloud sync, anime/season relations,
new-season alerts + an Upcoming screen, a full seasonal browser, a recommender,
and multiple themes (incl. a cozy pastel one).

Smaller follow-ups: pull-to-refresh + pagination on Discover/Search; swap the
AsyncStorage repository for MMKV (dev build) for speed.
```
