/** Small, dependency-light formatting helpers used across screens. */

/** "2d 4h", "5h 12m", "23m" — compact countdown from seconds-until. */
export function formatCountdown(secondsUntil: number): string {
  if (secondsUntil <= 0) return 'Aired';
  const d = Math.floor(secondsUntil / 86400);
  const h = Math.floor((secondsUntil % 86400) / 3600);
  const m = Math.floor((secondsUntil % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu" / "Today" / "Tomorrow" relative day label for an airing timestamp (unix s). */
export function airingDayLabel(airingAtSeconds: number): string {
  const date = new Date(airingAtSeconds * 1000);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return WEEKDAYS[date.getDay()];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Today" / "Tomorrow" / "Sat 28 Jun" — a calendar-date label, unique per date
 * (unlike `airingDayLabel`, whose weekday names repeat across a long window).
 */
export function airingDateLabel(airingAtSeconds: number): string {
  const date = new Date(airingAtSeconds * 1000);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Badge text for a not-yet-released title's premiere. Returns null once the
 * premiere is in the past; "Airs in 2d 4h" within a week; "Premieres Sat 28 Jun"
 * further out.
 */
export function premiereLabel(premiereAtSeconds: number): string | null {
  const secondsUntil = premiereAtSeconds - Math.floor(Date.now() / 1000);
  if (secondsUntil <= 0) return null;
  if (secondsUntil <= 7 * 86400) return `Airs in ${formatCountdown(secondsUntil)}`;
  return `Premieres ${airingDateLabel(premiereAtSeconds)}`;
}

/** "Premieres Fall 2026" from AniList season parts; null when either is unknown. */
export function premiereSeasonLabel(season: string | null | undefined, year: number | null | undefined): string | null {
  if (!season || !year) return null;
  return `Premieres ${humanizeEnum(season)} ${year}`;
}

/** "8:30 PM" local time for a unix-seconds timestamp. */
export function airingTimeLabel(airingAtSeconds: number): string {
  return new Date(airingAtSeconds * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** AniList averageScore is 0–100; show as "8.6". Returns null when unscored. */
export function formatScore(averageScore: number | null): string | null {
  if (!averageScore) return null;
  return (averageScore / 10).toFixed(1);
}

/** Strip residual HTML tags / entities from AniList descriptions. */
export function stripHtml(input: string | null): string {
  if (!input) return '';
  return input
    .replace(/<br\s*\/?>(\n)?/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&mdash;/g, '—')
    .trim();
}

/** Title-case a SCREAMING_SNAKE enum: "TV_SHORT" -> "TV Short". */
export function humanizeEnum(value: string | null): string {
  if (!value) return '';
  return value
    .split('_')
    .map((w) => (w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}
