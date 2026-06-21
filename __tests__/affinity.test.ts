import { computeAffinity, matchScore } from '../src/features/recommendations/affinity';
import { media, trackEntry } from './_fixtures';

describe('computeAffinity', () => {
  it('spreads an entry weight across its genres and normalizes the scale', () => {
    const a = computeAffinity([trackEntry(1, { status: 'COMPLETED', score: 0, genres: ['Action', 'Comedy'] })]);
    expect(a.weights.Action).toBeCloseTo(1); // COMPLETED(2) * mult(1) / 2 genres
    expect(a.weights.Comedy).toBeCloseTo(1);
    expect(a.scale).toBeCloseTo(1);
  });

  it('treats DROPPED as a negative signal', () => {
    const a = computeAffinity([trackEntry(1, { status: 'DROPPED', score: 0, genres: ['Horror'] })]);
    expect(a.weights.Horror).toBeLessThan(0);
  });

  it('ignores entries with no genres', () => {
    expect(Object.keys(computeAffinity([trackEntry(1, { genres: [] })]).weights)).toHaveLength(0);
  });
});

describe('matchScore', () => {
  const affinity = computeAffinity([trackEntry(1, { status: 'COMPLETED', score: 8, genres: ['Action'] })]);

  it('returns null when the title has no genres', () => {
    expect(matchScore(media(2, { genres: [] }), affinity).score).toBeNull();
  });

  it('returns null when there is no taste profile', () => {
    expect(matchScore(media(2, { genres: ['Action'] }), { weights: {}, scale: 1 }).score).toBeNull();
  });

  it('scores a liked genre highly and explains why', () => {
    const r = matchScore(media(2, { genres: ['Action'] }), affinity);
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.reasons).toContain('Action');
  });
});
