/**
 * Region-aware "where to watch" logic.
 *
 * AniList has no per-country catalog field — it only tells us which services list
 * a title and, per link, a `language` tag ("German", "English", …). So true
 * "is this in my country's catalog" is impossible; what we *can* do honestly:
 *
 *  1. Drop services that don't operate in the user's country at all (a curated,
 *     best-effort availability map — unknown services are always kept).
 *  2. Among accessible services, treat a link whose `language` matches the user's
 *     region as in-region; one whose language is for a *different* region is a
 *     VPN-only fallback on a service the user can still reach.
 *
 * Both maps are approximate and deliberately conservative: when unsure, keep the
 * link rather than hide it.
 */
import type { ExternalLink } from '../api/anilist/types';

// --- Region → languages -----------------------------------------------------

/**
 * AniList tags streaming links with full English language names. A user's region
 * maps to the language(s) its catalogs are presented in. Used only to rank links
 * as in-region vs. other-region, never to hide them.
 */
const REGION_LANGUAGES: Record<string, string[]> = {
  US: ['English'], GB: ['English'], CA: ['English', 'French'], AU: ['English'],
  NZ: ['English'], IE: ['English'], IN: ['English', 'Hindi'],
  DE: ['German'], AT: ['German'], CH: ['German', 'French', 'Italian'],
  FR: ['French'], BE: ['French'], LU: ['French'],
  ES: ['Spanish'], MX: ['Spanish'], AR: ['Spanish'], CL: ['Spanish'],
  CO: ['Spanish'], PE: ['Spanish'],
  BR: ['Portuguese'], PT: ['Portuguese'],
  IT: ['Italian'],
  JP: ['Japanese'],
  KR: ['Korean'],
  CN: ['Chinese'], TW: ['Chinese'], HK: ['Chinese'],
  RU: ['Russian'],
};

/**
 * Does this link read as belonging to the user's region? An untagged link
 * (no `language`) is treated as global and always matches. Unknown regions fall
 * back to English so international defaults still surface as in-region.
 */
export function languageMatchesRegion(language: string | null, region: string): boolean {
  if (!language) return true;
  const langs = REGION_LANGUAGES[region] ?? ['English'];
  return langs.includes(language);
}

// --- Service → country availability -----------------------------------------

const ENGLISH = ['US', 'GB', 'CA', 'IE', 'AU', 'NZ'];
const EUROPE = ['DE', 'AT', 'CH', 'FR', 'BE', 'NL', 'LU', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'PL', 'IE', 'GB'];
const ASIA = ['JP', 'CN', 'TW', 'HK', 'KR', 'SG', 'MY', 'TH', 'PH', 'ID', 'VN', 'IN'];

/** `only` = exclusively these countries; `global` = everywhere minus `except`. */
type Availability = { only: string[] } | { global: true; except?: string[] };

interface ServiceRule {
  /** Canonical display name. */
  name: string;
  /** Matches against a lower-cased AniList `site` string. */
  test: (site: string) => boolean;
  availability: Availability;
}

/**
 * Curated, best-effort availability. Order matters — first match wins, so more
 * specific tests come first. Anything not listed is treated as globally
 * available (kept), so the map can only ever *remove* clearly region-locked
 * services, never strand a user on a gap in our knowledge.
 */
const SERVICES: ServiceRule[] = [
  { name: 'Crunchyroll', test: (s) => s.includes('crunchyroll'), availability: { global: true, except: ['CN', 'JP'] } },
  { name: 'Funimation', test: (s) => s.includes('funimation'), availability: { only: [...ENGLISH, 'MX', 'BR'] } },
  { name: 'VRV', test: (s) => s.includes('vrv'), availability: { only: ['US'] } },
  { name: 'HIDIVE', test: (s) => s.includes('hidive'), availability: { only: [...ENGLISH, 'DK', 'FI', 'NO', 'SE'] } },
  { name: 'AnimeLab', test: (s) => s.includes('animelab'), availability: { only: ['AU', 'NZ'] } },
  { name: 'Wakanim', test: (s) => s.includes('wakanim'), availability: { only: ['DE', 'AT', 'CH', 'FR', 'BE', 'RU', 'SE', 'NO', 'DK', 'FI'] } },
  { name: 'Hulu', test: (s) => s.includes('hulu'), availability: { only: ['US', 'JP'] } },
  { name: 'Adult Swim', test: (s) => s.includes('adult swim'), availability: { only: ['US'] } },
  { name: 'Max', test: (s) => s.includes('hbo') || s === 'max', availability: { only: [...ENGLISH, 'ES', 'PT', 'SE', 'NO', 'DK', 'FI', 'PL', 'MX', 'AR', 'CL', 'CO', 'BR'] } },
  { name: 'Netflix', test: (s) => s.includes('netflix'), availability: { global: true, except: ['CN', 'SY', 'KP', 'RU'] } },
  { name: 'Disney+', test: (s) => s.includes('disney'), availability: { global: true, except: ['CN', 'JP', 'KR'] } },
  { name: 'Prime Video', test: (s) => s.includes('amazon') || s.includes('prime'), availability: { global: true } },
  { name: 'Bilibili', test: (s) => s.includes('bilibili'), availability: { only: ASIA } },
  { name: 'iQIYI', test: (s) => s.includes('iqiyi') || s.includes('iq.com') || s === 'iq', availability: { only: ASIA } },
  { name: 'Youku', test: (s) => s.includes('youku'), availability: { only: ['CN', 'HK', 'TW'] } },
  { name: 'WeTV', test: (s) => s.includes('wetv') || s.includes('tencent'), availability: { only: ASIA } },
  { name: 'Muse', test: (s) => s.includes('muse'), availability: { only: ASIA } },
  { name: 'Ani-One', test: (s) => s.includes('ani-one') || s.includes('ani one'), availability: { only: ASIA } },
  { name: 'Aniplus', test: (s) => s.includes('aniplus'), availability: { only: ['KR', 'SG', 'MY', 'TH', 'PH', 'ID'] } },
  { name: 'Bahamut', test: (s) => s.includes('bahamut'), availability: { only: ['TW', 'HK'] } },
  { name: 'Abema', test: (s) => s.includes('abema'), availability: { only: ['JP'] } },
  { name: 'Niconico', test: (s) => s.includes('niconico'), availability: { only: ['JP'] } },
  { name: 'RetroCrush', test: (s) => s.includes('retrocrush'), availability: { only: ['US', 'CA'] } },
  { name: 'Tubi', test: (s) => s.includes('tubi'), availability: { only: ['US', 'CA'] } },
];

function resolveService(site: string): { name: string; availability: Availability } {
  const lower = site.toLowerCase();
  const rule = SERVICES.find((r) => r.test(lower));
  // Unknown service: keep it, assume global so we never hide a valid link.
  return rule ? { name: rule.name, availability: rule.availability } : { name: site, availability: { global: true } };
}

function availableInRegion(availability: Availability, region: string): boolean {
  if ('only' in availability) return availability.only.includes(region);
  return !availability.except?.includes(region);
}

// --- Resolution -------------------------------------------------------------

export interface StreamingOption {
  link: ExternalLink;
  /** Canonical service name (deduped on this). */
  service: string;
}

export interface StreamingResult {
  /** Accessible in the user's region and language-matched. Shown first. */
  inRegion: StreamingOption[];
  /**
   * Same services the user can reach in their country, but the listing is for
   * another region's catalog — a VPN may be required. Surfaced only as a
   * fallback when `inRegion` is empty.
   */
  otherRegion: StreamingOption[];
  /** The title has zero streaming links at all. */
  isEmpty: boolean;
  /**
   * Links exist but every one is on a service that doesn't operate in the user's
   * region (so nothing is shown). Lets the UI explain the silence.
   */
  unavailableInRegion: boolean;
}

/**
 * Sort streaming links into what to show for `region`.
 *
 * `region` is a 2-letter country code (e.g. "DE"). When null/empty we can't make
 * regional judgements, so every link is treated as in-region (no hiding).
 */
export function resolveStreaming(
  links: ExternalLink[] | undefined,
  region: string | null,
): StreamingResult {
  const all = links ?? [];
  if (all.length === 0) {
    return { inRegion: [], otherRegion: [], isEmpty: true, unavailableInRegion: false };
  }

  // No region context → show everything, in order, deduped by service.
  if (!region) {
    return {
      inRegion: dedupe(all.map((link) => ({ link, service: resolveService(link.site).name }))),
      otherRegion: [],
      isEmpty: false,
      unavailableInRegion: false,
    };
  }

  const inRegion: StreamingOption[] = [];
  const otherRegion: StreamingOption[] = [];
  let anyAccessible = false;

  for (const link of all) {
    const { name, availability } = resolveService(link.site);
    if (!availableInRegion(availability, region)) continue; // service not in country
    anyAccessible = true;
    const option = { link, service: name };
    if (languageMatchesRegion(link.language, region)) inRegion.push(option);
    else otherRegion.push(option);
  }

  const deRegion = dedupe(inRegion);
  // A service shown as in-region shouldn't also appear as a VPN fallback.
  const inRegionServices = new Set(deRegion.map((o) => o.service));
  const deOther = dedupe(otherRegion).filter((o) => !inRegionServices.has(o.service));

  return {
    inRegion: deRegion,
    otherRegion: deOther,
    isEmpty: false,
    unavailableInRegion: !anyAccessible,
  };
}

/** One chip per service; first occurrence wins (keeps the row clean). */
function dedupe(options: StreamingOption[]): StreamingOption[] {
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.service) ? false : (seen.add(o.service), true)));
}

// --- Region options (for the Settings picker) -------------------------------

export interface RegionOption {
  /** 2-letter country code, or '' for "Auto (device)". */
  code: string;
  label: string;
  flag: string;
}

/** "Auto" first, then a curated set of common anime-streaming markets. */
export const REGION_OPTIONS: RegionOption[] = [
  { code: '', label: 'Auto (device)', flag: '🌐' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'ES', label: 'Spain', flag: '🇪🇸' },
  { code: 'IT', label: 'Italy', flag: '🇮🇹' },
  { code: 'BR', label: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', label: 'Mexico', flag: '🇲🇽' },
  { code: 'JP', label: 'Japan', flag: '🇯🇵' },
  { code: 'KR', label: 'South Korea', flag: '🇰🇷' },
  { code: 'TW', label: 'Taiwan', flag: '🇹🇼' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
];

/** Human label + flag for a resolved region code (falls back gracefully). */
export function regionLabel(code: string): { label: string; flag: string } {
  const found = REGION_OPTIONS.find((r) => r.code === code);
  return found ? { label: found.label, flag: found.flag } : { label: code, flag: '🏳️' };
}
