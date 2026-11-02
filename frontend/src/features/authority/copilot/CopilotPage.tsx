import { useState } from 'react';
import CopilotChat from '../components/CopilotChat';
import { useLive } from '../live/LiveDataProvider';

export default function CopilotPage() {
  const { markers } = useLive();
  const [incidentId, setIncidentId] = useState('');
  return (
    <>
      <h1>Authority Copilot</h1>
      <div className="auth-card">
        <label>Incident context
          <select value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
            <option value="">General SOP questions (no incident)</option>
            {markers.map((m) => <option key={m.id} value={m.id}>{m.reference} · {m.category} · {m.status.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
      </div>
      <div className="auth-card"><CopilotChat key={incidentId} incidentId={incidentId || undefined} /></div>
    </>
  );
}
