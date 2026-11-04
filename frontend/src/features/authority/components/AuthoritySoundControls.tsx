import { useState } from 'react';
import { playUiSound, prepareUiSound } from '../../../services/soundEffects';
import { useOnLiveEvent } from '../live/LiveDataProvider';

const INCIDENT_SOUND = '/sounds/new-incident.mp3';

export function AuthoritySoundControls() {
  const [soundReady, setSoundReady] = useState(false);
  const [error, setError] = useState('');

  useOnLiveEvent((event) => {
    if (event.type !== 'created') return;
    void playUiSound(INCIDENT_SOUND).then((played) => {
      setError(played ? '' : 'Incident received, but browser audio is locked. Click “Enable incident sound” for future alerts.');
    });
  });

  const enable = () => {
    void prepareUiSound(INCIDENT_SOUND).then((prepared) => {
      setSoundReady(prepared);
      setError(prepared ? '' : 'Could not enable sound. Check browser audio settings.');
    });
  };

  return (
    <>
      <button className="auth-btn auth-btn--small" type="button" aria-pressed={soundReady} disabled={soundReady} onClick={enable}>
        {soundReady ? 'Incident sound ready' : 'Enable incident sound'}
      </button>
      {error && <span className="auth-muted small" role="status">{error}</span>}
    </>
  );
}
