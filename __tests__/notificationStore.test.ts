import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import * as ReactTestRenderer from 'react-test-renderer';
import { useNotificationStore, useUnreadCount } from '../src/features/notifications/store';
import { notificationRepository } from '../src/features/notifications/repository';
import { notification } from './_fixtures';

const reset = async () => {
  await AsyncStorage.clear();
  useNotificationStore.setState({ entries: {}, hydrated: false });
};

describe('notificationStore.hydrate', () => {
  beforeEach(reset);

  it('loads persisted notifications from the repository into memory', async () => {
    await notificationRepository.upsert(notification('n1', { mediaId: 1 }));
    await notificationRepository.upsert(notification('n2', { mediaId: 2, read: true }));
    expect(useNotificationStore.getState().hydrated).toBe(false);

    await useNotificationStore.getState().hydrate();

    const state = useNotificationStore.getState();
    expect(state.hydrated).toBe(true);
    expect(Object.keys(state.entries).sort()).toEqual(['n1', 'n2']);
  });
});

describe('notificationStore.add', () => {
  beforeEach(reset);

  it('adds a new notification and persists it', async () => {
    useNotificationStore.setState({ entries: {}, hydrated: true });
    useNotificationStore.getState().add(notification('n1'));
    expect(useNotificationStore.getState().entries['n1']).toBeTruthy();
    // flush the fire-and-forget persist
    await Promise.resolve();
    await Promise.resolve();
    const stored = await notificationRepository.getAll();
    expect(stored.map((n) => n.id)).toEqual(['n1']);
  });

  it('no-ops when the id already exists (dedupe)', async () => {
    useNotificationStore.setState({ entries: {}, hydrated: true });
    useNotificationStore.getState().add(notification('n1', { read: false, message: 'first' }));
    // Same dedupe id arrives again (e.g. a re-run of detection) — must not
    // overwrite or duplicate the existing entry.
    useNotificationStore.getState().add(notification('n1', { read: true, message: 'second' }));
    const entries = useNotificationStore.getState().entries;
    expect(Object.keys(entries)).toHaveLength(1);
    expect(entries['n1'].message).toBe('first');
    expect(entries['n1'].read).toBe(false);
  });
});

describe('notificationStore.markRead / markAllRead', () => {
  beforeEach(reset);

  it('markRead flips a single notification to read and persists it', async () => {
    useNotificationStore.setState({ entries: { n1: notification('n1', { read: false }) }, hydrated: true });
    useNotificationStore.getState().markRead('n1');
    expect(useNotificationStore.getState().entries['n1'].read).toBe(true);
  });

  it('markRead is a no-op for an already-read or unknown id', () => {
    useNotificationStore.setState({ entries: { n1: notification('n1', { read: true }) }, hydrated: true });
    const before = useNotificationStore.getState().entries;
    useNotificationStore.getState().markRead('n1');
    useNotificationStore.getState().markRead('does-not-exist');
    expect(useNotificationStore.getState().entries).toBe(before); // same reference — no set() fired
  });

  it('markAllRead clears every unread entry in one action', () => {
    useNotificationStore.setState({
      entries: {
        n1: notification('n1', { read: false }),
        n2: notification('n2', { read: false }),
        n3: notification('n3', { read: true }),
      },
      hydrated: true,
    });
    useNotificationStore.getState().markAllRead();
    const entries = useNotificationStore.getState().entries;
    expect(Object.values(entries).every((n) => n.read)).toBe(true);
  });

  it('markAllRead no-ops when there is nothing unread', () => {
    useNotificationStore.setState({ entries: { n1: notification('n1', { read: true }) }, hydrated: true });
    const before = useNotificationStore.getState().entries;
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().entries).toBe(before);
  });
});

describe('useUnreadCount', () => {
  beforeEach(reset);

  it('counts only unread entries and updates on markAllRead', () => {
    useNotificationStore.setState({
      entries: {
        n1: notification('n1', { read: false }),
        n2: notification('n2', { read: false }),
        n3: notification('n3', { read: true }),
      },
      hydrated: true,
    });

    let renderedCount = -1;
    function Probe() {
      renderedCount = useUnreadCount();
      return null;
    }

    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(React.createElement(Probe));
    });
    expect(renderedCount).toBe(2);

    ReactTestRenderer.act(() => {
      useNotificationStore.getState().markAllRead();
    });
    expect(renderedCount).toBe(0);

    ReactTestRenderer.act(() => {
      root.unmount();
    });
  });
});
