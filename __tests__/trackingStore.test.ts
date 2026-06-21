import { useTrackingStore } from '../src/features/tracking/store';
import type { ImportedListEntry } from '../src/api/anilist';
import { media, trackEntry } from './_fixtures';

const reset = () => useTrackingStore.setState({ entries: {}, hydrated: true });

describe('trackingStore.restoreEntries', () => {
  beforeEach(reset);

  it('adds all entries into an empty list (merge)', () => {
    const sum = useTrackingStore.getState().restoreEntries([trackEntry(1), trackEntry(2)], 'merge');
    expect(sum).toMatchObject({ added: 2, updated: 0, unchanged: 0, total: 2 });
    expect(Object.keys(useTrackingStore.getState().entries)).toHaveLength(2);
  });

  it('merge keeps the newer copy (last-write-wins) and preserves createdAt', () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { updatedAt: 2000, createdAt: 500, progress: 3 }) },
    });
    const sum = useTrackingStore.getState().restoreEntries(
      [
        trackEntry(1, { updatedAt: 3000, createdAt: 9999, progress: 7 }),
        trackEntry(2, { updatedAt: 1000 }),
      ],
      'merge',
    );
    const e1 = useTrackingStore.getState().entries[1];
    expect(sum).toMatchObject({ added: 1, updated: 1, unchanged: 0 });
    expect(e1.progress).toBe(7);
    expect(e1.createdAt).toBe(500);
  });

  it('merge leaves an older incoming copy unchanged', () => {
    useTrackingStore.setState({ entries: { 1: trackEntry(1, { updatedAt: 5000, progress: 9 }) } });
    const sum = useTrackingStore
      .getState()
      .restoreEntries([trackEntry(1, { updatedAt: 1000, progress: 1 })], 'merge');
    expect(sum).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(useTrackingStore.getState().entries[1].progress).toBe(9);
  });

  it('replace swaps the whole list', () => {
    useTrackingStore.setState({ entries: { 1: trackEntry(1), 2: trackEntry(2) } });
    const sum = useTrackingStore.getState().restoreEntries([trackEntry(3)], 'replace');
    expect(sum).toMatchObject({ added: 1, total: 1 });
    expect(Object.keys(useTrackingStore.getState().entries)).toEqual(['3']);
  });
});

describe('trackingStore.importFromList', () => {
  beforeEach(reset);

  const imported = (id: number, over: Partial<ImportedListEntry> = {}): ImportedListEntry => ({
    media: media(id),
    status: 'COMPLETED',
    progress: 12,
    score: 8,
    updatedAt: 2000,
    ...over,
  });

  it('imports media into entries with snapshot fields', () => {
    const sum = useTrackingStore.getState().importFromList([imported(1)], 'merge');
    expect(sum).toMatchObject({ added: 1, total: 1 });
    const e = useTrackingStore.getState().entries[1];
    expect(e.status).toBe('COMPLETED');
    expect(e.title).toBe('Title 1');
    expect(e.genres).toEqual(['Action']);
  });

  it('clamps an out-of-range imported score', () => {
    useTrackingStore.getState().importFromList([imported(1, { score: 50 })], 'merge');
    expect(useTrackingStore.getState().entries[1].score).toBe(10);
  });
});
