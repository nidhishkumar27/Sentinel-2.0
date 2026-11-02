import { useRef, useState, type FormEvent } from 'react';
import { api } from '../../../services/authority/api';
import { ApiRequestError } from '../../../services/authority/http';
import type { AnswerResult } from '../../../types/authority';

interface Msg {
  role: 'user' | 'ai' | 'error';
  text: string;
  result?: AnswerResult;
}

const SUGGESTIONS = [
  'What procedures are relevant to this incident?',
  'What verified information is available about the situation?',
  'Which emergency resources or facilities may be relevant?',
  'What should an authority consider next according to the applicable SOP?',
];

function friendly(e: unknown): string {
  if (e instanceof ApiRequestError) {
    if (e.code === 'AI_UNAVAILABLE') return 'The AI service is unavailable right now. Incident handling is not affected; use the SOPs directly.';
    if (e.code === 'AI_INVALID_RESPONSE' || e.code === 'AI_UPSTREAM_ERROR') return 'The AI returned an unusable answer. Please try again.';
    if (e.code === 'RATE_LIMITED') return 'Too many questions. Please wait a moment.';
    return e.message;
  }
  return 'Something went wrong.';
}

export default function CopilotChat({ incidentId }: { incidentId?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const { data } = await api.copilot(q, incidentId);
      setMessages((m) => [...m, { role: 'ai', text: data.answer, result: data }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'error', text: friendly(e) }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="auth-chat">
      <p className="auth-muted small">
        {incidentId ? 'Answers use this incident’s facts (no reporter personal data) and retrieved SOPs.' : 'General SOP questions. Select an incident for incident-specific answers.'} AI support only: it does not replace official procedure.
      </p>
      <div className="auth-chat-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="auth-suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="auth-btn auth-btn--small" onClick={() => void ask(s)}>{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`auth-msg auth-msg--${m.role}`}>
            <div>{m.text}</div>
            {m.result && (
              <>
                {m.result.fallback && <div className="auth-alert auth-alert--warn">Safe fallback answer: the AI provider was unavailable.</div>}
                {m.result.insufficientEvidence && <div className="auth-alert auth-alert--warn">Limited evidence found. Treat this answer with caution.</div>}
                {m.result.suggestedActions.length > 0 && <ul>{m.result.suggestedActions.map((a, j) => <li key={j}>{a}</li>)}</ul>}
                {m.result.sources.length > 0 && (
                  <div className="small auth-muted">Sources: {m.result.sources.map((s) => s.title).join(' · ')}</div>
                )}
                {m.result.disclaimer && <div className="small auth-muted">{m.result.disclaimer}</div>}
              </>
            )}
          </div>
        ))}
        {busy && <div className="auth-msg auth-msg--ai auth-muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <form className="auth-row" onSubmit={submit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the copilot…" maxLength={2000} aria-label="Question for the copilot" />
        <button className="auth-btn auth-btn--primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
