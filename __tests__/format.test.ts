import {
  formatCountdown,
  formatScore,
  stripHtml,
  humanizeEnum,
  premiereLabel,
} from '../src/lib/format';

describe('premiereLabel', () => {
  const now = () => Math.floor(Date.now() / 1000);

  it('returns null once the premiere is in the past', () => {
    expect(premiereLabel(now() - 3600)).toBeNull();
  });

  it('counts down within a week', () => {
    expect(premiereLabel(now() + 2 * 86400 + 4 * 3600 + 30)).toMatch(/^Airs in 2d 4h$/);
  });

  it('shows a calendar date further out', () => {
    expect(premiereLabel(now() + 20 * 86400)).toMatch(/^Premieres /);
  });
});

describe('formatCountdown', () => {
  it('formats days / hours / minutes and past times', () => {
    expect(formatCountdown(0)).toBe('Aired');
    expect(formatCountdown(-5)).toBe('Aired');
    expect(formatCountdown(90000)).toBe('1d 1h');
    expect(formatCountdown(3700)).toBe('1h 1m');
    expect(formatCountdown(100)).toBe('1m');
  });
});

describe('formatScore', () => {
  it('renders 0-100 as a /10 string, null when unscored', () => {
    expect(formatScore(null)).toBeNull();
    expect(formatScore(0)).toBeNull();
    expect(formatScore(86)).toBe('8.6');
  });
});

describe('stripHtml', () => {
  it('strips tags, turns <br> into newlines, decodes common entities', () => {
    expect(stripHtml('<i>hi</i><br>there &amp; you')).toBe('hi\nthere & you');
    expect(stripHtml(null)).toBe('');
  });
});

describe('humanizeEnum', () => {
  it('title-cases snake enums but keeps short tokens upper', () => {
    expect(humanizeEnum('TV_SHORT')).toBe('TV Short');
    expect(humanizeEnum(null)).toBe('');
  });
});
