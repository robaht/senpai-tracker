import { parseMalXml } from '../src/lib/malImport';

/** ASCII XML → bytes without relying on TextEncoder (env-agnostic). */
const bytes = (xml: string) => Uint8Array.from(xml, (c) => c.charCodeAt(0));

describe('parseMalXml', () => {
  const xml =
    '<myanimelist>' +
    '<anime><series_animedb_id>1</series_animedb_id>' +
    '<series_title><![CDATA[Cowboy Bebop]]></series_title>' +
    '<my_watched_episodes>26</my_watched_episodes>' +
    '<my_status>Completed</my_status><my_score>10</my_score></anime>' +
    '<anime><series_animedb_id>2</series_animedb_id>' +
    '<series_title>Trigun</series_title>' +
    '<my_watched_episodes>5</my_watched_episodes>' +
    '<my_status>Watching</my_status><my_score>15</my_score></anime>' +
    '<anime><series_animedb_id>3</series_animedb_id><my_status>Bogus</my_status></anime>' +
    '</myanimelist>';

  it('parses valid anime rows, mapping MAL status to WatchStatus', () => {
    const out = parseMalXml(bytes(xml));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ malId: 1, title: 'Cowboy Bebop', status: 'COMPLETED', progress: 26, score: 10 });
    expect(out[1]).toMatchObject({ malId: 2, status: 'CURRENT', progress: 5 });
  });

  it('clamps the score and skips rows with an unrecognized status', () => {
    const out = parseMalXml(bytes(xml));
    expect(out[1].score).toBe(10); // 15 clamped
    expect(out.find((e) => e.malId === 3)).toBeUndefined();
  });

  it('returns [] for a non-MAL document', () => {
    expect(parseMalXml(bytes('<nope/>'))).toEqual([]);
  });
});
