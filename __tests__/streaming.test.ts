import { resolveStreaming, languageMatchesRegion } from '../src/lib/streaming';
import { link } from './_fixtures';

describe('languageMatchesRegion', () => {
  it('treats an untagged link as global', () => {
    expect(languageMatchesRegion(null, 'DE')).toBe(true);
  });

  it('matches the region language and rejects others', () => {
    expect(languageMatchesRegion('German', 'DE')).toBe(true);
    expect(languageMatchesRegion('German', 'US')).toBe(false);
  });
});

describe('resolveStreaming', () => {
  it('flags empty when there are no links', () => {
    expect(resolveStreaming([], 'US').isEmpty).toBe(true);
  });

  it('shows every link deduped by service when region is null', () => {
    const r = resolveStreaming([link('Crunchyroll'), link('Crunchyroll'), link('Netflix')], null);
    expect(r.inRegion.map((o) => o.service).sort()).toEqual(['Crunchyroll', 'Netflix']);
  });

  it('drops services that do not operate in the region', () => {
    const r = resolveStreaming([link('Crunchyroll'), link('Wakanim')], 'US');
    expect(r.inRegion.map((o) => o.service)).toEqual(['Crunchyroll']);
  });

  it('routes a reachable-but-foreign-language listing to otherRegion (VPN)', () => {
    const r = resolveStreaming([link('Crunchyroll', { language: 'German' })], 'US');
    expect(r.inRegion).toHaveLength(0);
    expect(r.otherRegion.map((o) => o.service)).toEqual(['Crunchyroll']);
  });

  it('marks unavailableInRegion when every service is region-locked out', () => {
    const r = resolveStreaming([link('Wakanim')], 'US');
    expect(r.unavailableInRegion).toBe(true);
    expect(r.inRegion).toHaveLength(0);
  });
});
