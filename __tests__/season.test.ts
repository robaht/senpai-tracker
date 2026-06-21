import { currentSeason, prevSeason, nextSeason } from '../src/api/anilist';

describe('currentSeason', () => {
  it('maps months to AniList seasons', () => {
    expect(currentSeason(new Date(2026, 0, 15))).toEqual({ season: 'WINTER', year: 2026 });
    expect(currentSeason(new Date(2026, 3, 15))).toEqual({ season: 'SPRING', year: 2026 });
    expect(currentSeason(new Date(2026, 6, 15))).toEqual({ season: 'SUMMER', year: 2026 });
    expect(currentSeason(new Date(2026, 9, 15))).toEqual({ season: 'FALL', year: 2026 });
  });

  it("rolls December into the next year's winter", () => {
    expect(currentSeason(new Date(2026, 11, 15))).toEqual({ season: 'WINTER', year: 2027 });
  });
});

describe('prevSeason / nextSeason', () => {
  it('wraps winter back to the previous fall', () => {
    expect(prevSeason({ season: 'WINTER', year: 2026 })).toEqual({ season: 'FALL', year: 2025 });
  });

  it('wraps fall forward to the next winter', () => {
    expect(nextSeason({ season: 'FALL', year: 2026 })).toEqual({ season: 'WINTER', year: 2027 });
  });

  it('steps within the year otherwise', () => {
    expect(nextSeason({ season: 'SPRING', year: 2026 })).toEqual({ season: 'SUMMER', year: 2026 });
    expect(prevSeason({ season: 'SUMMER', year: 2026 })).toEqual({ season: 'SPRING', year: 2026 });
  });
});
