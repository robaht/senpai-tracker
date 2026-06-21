import { sortRelations, buildSeasonChain } from '../src/lib/relations';
import { media, relationEdge } from './_fixtures';

describe('sortRelations', () => {
  it('orders prequel before sequel before other relations, dropping non-anime', () => {
    const out = sortRelations([
      relationEdge('SOURCE', { id: 1, format: 'MANGA' as never }),
      relationEdge('SEQUEL', { id: 2 }),
      relationEdge('PREQUEL', { id: 3 }),
    ]);
    expect(out.map((e) => e.relationType)).toEqual(['PREQUEL', 'SEQUEL']);
  });

  it('keeps null-format (unannounced) anime nodes', () => {
    expect(sortRelations([relationEdge('SEQUEL', { id: 2, format: null })])).toHaveLength(1);
  });
});

describe('buildSeasonChain', () => {
  it('returns [] when there is neither a prequel nor a sequel', () => {
    expect(buildSeasonChain(media(1), [])).toEqual([]);
  });

  it('orders prequel, current, sequel', () => {
    const chain = buildSeasonChain(media(1), [
      relationEdge('SEQUEL', { id: 3 }),
      relationEdge('PREQUEL', { id: 2 }),
    ]);
    expect(chain.map((m) => m.id)).toEqual([2, 1, 3]);
  });

  it('prefers a same-format candidate at a branch', () => {
    const chain = buildSeasonChain(media(1, { format: 'TV' }), [
      relationEdge('SEQUEL', { id: 9, format: 'SPECIAL' }),
      relationEdge('SEQUEL', { id: 10, format: 'TV' }),
    ]);
    expect(chain.map((m) => m.id)).toEqual([1, 10]);
  });
});
