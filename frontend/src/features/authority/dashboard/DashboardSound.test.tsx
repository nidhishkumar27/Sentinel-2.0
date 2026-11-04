// @vitest-environment jsdom

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthoritySoundControls } from '../components/AuthoritySoundControls';

const live = vi.hoisted(() => ({ callback: null as ((event: any) => void) | null }));
const sounds = vi.hoisted(() => ({
  play: vi.fn().mockResolvedValue(true),
  prepare: vi.fn().mockResolvedValue(true),
}));

vi.mock('../live/LiveDataProvider', () => ({
  useLive: () => ({ markers: [], connection: 'live', lastSyncAt: Date.now() }),
  useOnLiveEvent: (callback: (event: any) => void) => { live.callback = callback; },
}));
vi.mock('../auth/AuthorityAuthContext', () => ({
  useAuthorityAuth: () => ({ user: { name: 'Test responder' } }),
}));
vi.mock('../../../services/authority/api', () => ({
  api: { analytics: vi.fn().mockResolvedValue({ data: { aiEnrichment: {} } }) },
}));
vi.mock('../../../services/soundEffects', () => ({
  playUiSound: sounds.play,
  prepareUiSound: sounds.prepare,
}));

afterEach(() => {
  live.callback = null;
  sounds.play.mockClear();
  sounds.prepare.mockClear();
  vi.restoreAllMocks();
});

describe('authority incident sound', () => {
  it('plays the incident sound for a live created event after sound is enabled', async () => {
    const user = userEvent.setup();

    render(<AuthoritySoundControls />);
    await user.click(screen.getByRole('button', { name: /enable incident sound/i }));
    await screen.findByRole('button', { name: /incident sound ready/i });
    expect(sounds.prepare).toHaveBeenCalledWith('/sounds/new-incident.mp3');

    act(() => live.callback?.({ type: 'created', id: 'incident-1', marker: {} }));
    await waitFor(() => expect(sounds.play).toHaveBeenCalledTimes(1));
    expect(sounds.play).toHaveBeenCalledWith('/sounds/new-incident.mp3');

    act(() => live.callback?.({ type: 'updated', id: 'incident-1', marker: {} }));
    expect(sounds.play).toHaveBeenCalledTimes(1);
  });
});
