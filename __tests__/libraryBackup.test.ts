import { entriesToXml, parseLibraryXml, backupFileName } from '../src/lib/libraryBackup';
import { trackEntry } from './_fixtures';

describe('libraryBackup', () => {
  it('round-trips entries losslessly', () => {
    const entries = [
      trackEntry(21, {
        title: 'FMA & "the <best>"',
        coverImage: 'https://x/c.jpg?a=1&b=2',
        coverColor: '#1a2b3c',
        genres: ['Action', 'Slice of Life'],
        progress: 5,
        score: 8,
        updatedAt: 1700000000000,
        createdAt: 1690000000000,
      }),
      trackEntry(99, {
        status: 'PLANNING',
        totalEpisodes: null,
        duration: null,
        format: null,
        coverImage: null,
        coverColor: null,
        genres: [],
        progress: 0,
        score: 0,
      }),
    ];
    expect(parseLibraryXml(entriesToXml(entries))).toEqual(entries);
  });

  it('escapes and restores XML-special characters', () => {
    const [e] = parseLibraryXml(entriesToXml([trackEntry(1, { title: 'a & b < c > d "e"' })]));
    expect(e.title).toBe('a & b < c > d "e"');
  });

  it('guards corrupt numeric fields against NaN', () => {
    const xml =
      '<senpai-library><anime><mediaId>5</mediaId><status>CURRENT</status>' +
      '<progress>x</progress><totalEpisodes>abc</totalEpisodes><score>zz</score>' +
      '<duration>--</duration><updatedAt>q</updatedAt></anime></senpai-library>';
    const [e] = parseLibraryXml(xml);
    expect(e.totalEpisodes).toBeNull();
    expect(e.duration).toBeNull();
    expect(e.progress).toBe(0);
    expect(e.score).toBe(0);
    expect(Number.isFinite(e.updatedAt)).toBe(true);
  });

  it('clamps score to 0..10 on the way in', () => {
    const [e] = parseLibraryXml(entriesToXml([trackEntry(1, { score: 99 })]));
    expect(e.score).toBe(10);
  });

  it('skips blocks with an invalid status or missing id', () => {
    const xml =
      '<senpai-library>' +
      '<anime><mediaId>1</mediaId><status>BOGUS</status></anime>' +
      '<anime><status>CURRENT</status></anime>' +
      '<anime><mediaId>7</mediaId><status>COMPLETED</status></anime>' +
      '</senpai-library>';
    expect(parseLibraryXml(xml).map((e) => e.mediaId)).toEqual([7]);
  });

  it('parses multiple genres and tolerates empty genres', () => {
    const xml = entriesToXml([
      trackEntry(1, { genres: ['Action', 'Comedy', 'Slice of Life'] }),
      trackEntry(2, { genres: [] }),
    ]);
    const out = parseLibraryXml(xml);
    expect(out[0].genres).toEqual(['Action', 'Comedy', 'Slice of Life']);
    expect(out[1].genres).toEqual([]);
  });

  it('names the backup file by date', () => {
    expect(backupFileName()).toMatch(/^senpai-library-\d{4}-\d{2}-\d{2}\.xml$/);
  });
});
