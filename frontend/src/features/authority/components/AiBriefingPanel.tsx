import type { IncidentDetail } from '../../../types/authority';
import { fmtDate } from '../lib/format';
import { AiBadge } from './Badges';

interface Props {
  ai: IncidentDetail['ai'];
  onRetry?: () => void;
  busy?: boolean;
}

export default function AiBriefingPanel({ ai, onRetry, busy }: Props) {
  const b = ai.briefing;
  return (
    <section className="auth-card" aria-live="polite">
      <div className="auth-row">
        <h3>AI briefing</h3>
        <AiBadge status={ai.status} />
        {onRetry && ['failed', 'unavailable'].includes(ai.status) && (
          <button className="auth-btn auth-btn--small" onClick={onRetry} disabled={busy}>Retry</button>
        )}
      </div>

      {(ai.status === 'pending' || ai.status === 'processing') && <p className="auth-muted">The briefing is being prepared. Handle the incident normally; the AI is optional support.</p>}
      {ai.status === 'unavailable' && <p className="auth-alert auth-alert--warn">The AI service is unavailable. The incident is unaffected. Use the SOPs directly or retry.</p>}
      {ai.status === 'failed' && <p className="auth-alert auth-alert--warn">The AI briefing could not be produced{ai.error?.message ? ` (${ai.error.message})` : ''}.</p>}

      {b && (
        <>
          <p className="auth-muted small">AI-generated from the supplied incident facts. Verify against official procedures before acting.</p>
          {b.insufficientEvidence && <p className="auth-alert auth-alert--warn">Not enough evidence was found to give reliable guidance.</p>}
          <h4>Summary</h4>
          <p>{b.summary}</p>
          {b.nextSteps.length > 0 && (<><h4>Suggested next steps</h4><ol>{b.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ol></>)}
          {b.procedures.length > 0 && (
            <>
              <h4>Relevant procedures</h4>
              {b.procedures.map((p, i) => (
                <details key={i}>
                  <summary>{p.title}</summary>
                  <ol>{p.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>
                </details>
              ))}
            </>
          )}
          {b.uncertainties.length > 0 && (<><h4>Uncertainties</h4><ul>{b.uncertainties.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
          {b.sources.length > 0 && (
            <>
              <h4>Sources</h4>
              <ul>
                {b.sources.map((s, i) => (
                  <li key={s.id ?? i}>
                    {s.url && /^https?:\/\//.test(s.url) ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}
                    {s.documentType ? ` · ${s.documentType}` : ''}{s.section ? ` · ${s.section}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="auth-muted small">Generated {fmtDate(b.generatedAt ?? ai.completedAt)}{b.model ? ` · ${b.model}` : ''}{b.disclaimer ? ` · ${b.disclaimer}` : ''}</p>
        </>
      )}
    </section>
  );
}
