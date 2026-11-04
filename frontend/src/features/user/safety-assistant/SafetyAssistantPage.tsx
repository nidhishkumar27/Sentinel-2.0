import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../../components/ui/Icon";
import { safetyIntegrations } from "../../../app/integrations";
import type {
  AssistantCitation,
  AssistantOutcome,
} from "../../../types/assistantIntegration";

const maximumQuestionLength = 2000;

type ConversationTurn = {
  id: number;
  question: string;
  status: "pending" | "answered" | "insufficient-evidence" | "unavailable" | "timeout" | "error";
  answer?: string;
  citations: AssistantCitation[];
};

function safeCitationUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function displayableCitations(citations: AssistantCitation[]) {
  return citations
    .filter((citation) => citation.title.trim().length > 0)
    .map((citation) => ({
      title: citation.title.trim(),
      url: safeCitationUrl(citation.url),
    }));
}

function resultStatus(outcome: AssistantOutcome): ConversationTurn["status"] {
  switch (outcome.status) {
    case "success":
      return "answered";
    case "insufficient-evidence":
      return "insufficient-evidence";
    case "unavailable":
      return "unavailable";
    case "timeout":
      return "timeout";
    case "error":
      return "error";
  }
}

function outcomeMessage(status: ConversationTurn["status"]) {
  switch (status) {
    case "unavailable":
      return {
        title: "Assistant unavailable",
        body: "No AI service is connected. Your question was not answered.",
      };
    case "timeout":
      return {
        title: "The response timed out",
        body: "No answer was confirmed. You can retry this question manually.",
      };
    case "error":
      return {
        title: "The response could not be loaded",
        body: "The assistant service returned an error. You can retry this question manually.",
      };
    case "insufficient-evidence":
      return {
        title: "Not enough evidence",
        body: "The connected service could not find enough supporting information to answer this question.",
      };
    default:
      return null;
  }
}

export function SafetyAssistantPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [busyTurnId, setBusyTurnId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState("");
  const nextTurnId = useRef(0);
  const requestGeneration = useRef(0);
  const questionInput = useRef<HTMLTextAreaElement>(null);

  async function runQuestion(turnId: number, text: string) {
    const generation = ++requestGeneration.current;
    setBusyTurnId(turnId);
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? { ...turn, status: "pending", answer: undefined, citations: [] }
          : turn,
      ),
    );

    let outcome: AssistantOutcome;
    try {
      outcome = await safetyIntegrations.assistant.ask({ question: text });
    } catch {
      outcome = { status: "error" };
    }

    if (generation !== requestGeneration.current) {
      return;
    }

    const status = resultStatus(outcome);
    const answer =
      outcome.status === "success" && outcome.response.answer.trim()
        ? outcome.response.answer.trim()
        : undefined;
    const citations =
      outcome.status === "success" ||
      outcome.status === "insufficient-evidence"
        ? displayableCitations(
            outcome.status === "success"
              ? outcome.response.citations
              : outcome.citations,
          )
        : [];

    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              status:
                outcome.status === "success" && !answer
                  ? "error"
                  : status,
              answer,
              citations,
            }
          : turn,
      ),
    );
    setBusyTurnId(null);
    questionInput.current?.focus();
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (busyTurnId !== null) {
      return;
    }
    if (!trimmedQuestion) {
      setValidationError("Enter a question to continue.");
      questionInput.current?.focus();
      return;
    }
    if (trimmedQuestion.length > maximumQuestionLength) {
      setValidationError(
        `Questions must be ${maximumQuestionLength} characters or fewer.`,
      );
      questionInput.current?.focus();
      return;
    }

    setValidationError("");
    const id = nextTurnId.current++;
    setTurns((current) => [
      ...current,
      { id, question: trimmedQuestion, status: "pending", citations: [] },
    ]);
    setQuestion("");
    void runQuestion(id, trimmedQuestion);
  }

  function retryTurn(turn: ConversationTurn) {
    if (busyTurnId !== null) {
      return;
    }
    void runQuestion(turn.id, turn.question);
  }

  function clearConversation() {
    requestGeneration.current += 1;
    setTurns([]);
    setBusyTurnId(null);
    setQuestion("");
    setValidationError("");
    questionInput.current?.focus();
  }

  const characterCount = question.length;

  return (
    <div className="assistant-page">
      <header className="assistant-page-heading">
        <div>
          <p className="eyebrow">GUIDANCE FROM AN AI SYSTEM</p>
          <h1>Safety assistant</h1>
          <p>
            Ask a travel-safety question. Responses depend on the connected
            service and its available evidence.
          </p>
        </div>
        {turns.length > 0 && (
          <button
            className="assistant-clear-button"
            onClick={clearConversation}
            type="button"
          >
            <Icon name="close" />
            New conversation
          </button>
        )}
      </header>

      <div className="assistant-safety-notice" role="note">
        <Icon name="help" />
        <p>
          <strong>This is an AI assistant and may be wrong.</strong> It cannot
          contact emergency services or dispatch help. If you are in immediate
          danger, contact local emergency services directly or use the{" "}
          <Link to="/sos">SOS page</Link> to review the available options.
        </p>
      </div>

      <section
        aria-label="Assistant conversation"
        aria-live="polite"
        className="assistant-conversation"
        role="log"
      >
        {turns.length === 0 ? (
          <div className="assistant-empty">
            <span className="assistant-empty-icon">
              <Icon name="assistant" />
            </span>
            <h2>What would you like to know?</h2>
            <p>
              No conversation is stored between page visits. Do not include
              sensitive personal or precise location details.
            </p>
          </div>
        ) : (
          turns.map((turn) => {
            const notice = outcomeMessage(turn.status);
            return (
              <article className="assistant-turn" key={turn.id}>
                <div className="assistant-message assistant-message--user">
                  <span className="assistant-message-label">You</span>
                  <p>{turn.question}</p>
                </div>
                {turn.status === "pending" ? (
                  <div
                    aria-label="Waiting for assistant response"
                    className="assistant-message assistant-message--pending"
                    role="status"
                  >
                    <span className="assistant-message-label">Assistant</span>
                    <p>
                      <Icon name="clock" />
                      Waiting for a response…
                    </p>
                  </div>
                ) : notice ? (
                  <div
                    className={`assistant-outcome assistant-outcome--${turn.status}`}
                    role={turn.status === "error" || turn.status === "timeout" ? "alert" : "status"}
                  >
                    <strong>{notice.title}</strong>
                    <p>{notice.body}</p>
                    {(turn.status === "error" || turn.status === "timeout") && (
                      <button
                        className="assistant-retry-button"
                        disabled={busyTurnId !== null}
                        onClick={() => retryTurn(turn)}
                        type="button"
                      >
                        Retry question
                      </button>
                    )}
                    {turn.citations.length > 0 && (
                      <CitationList citations={turn.citations} />
                    )}
                  </div>
                ) : (
                  <div className="assistant-message assistant-message--answer">
                    <span className="assistant-message-label">Assistant · AI</span>
                    <p>{turn.answer}</p>
                    {turn.citations.length > 0 && (
                      <CitationList citations={turn.citations} />
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      <form className="assistant-composer" onSubmit={submitQuestion}>
        <label htmlFor="assistant-question">Your question</label>
        <textarea
          aria-describedby="assistant-question-help assistant-question-count"
          aria-invalid={validationError ? "true" : undefined}
          className="assistant-question-input"
          id="assistant-question"
          maxLength={maximumQuestionLength + 1}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (validationError) {
              setValidationError("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Type a question…"
          ref={questionInput}
          rows={3}
          value={question}
        />
        <div className="assistant-composer-footer">
          <div>
            <span id="assistant-question-help">
              Press Enter to send; Shift+Enter for a new line.
            </span>
            <span aria-live="polite" id="assistant-question-count">
              {characterCount}/{maximumQuestionLength}
            </span>
          </div>
          <button
            className="assistant-send-button"
            disabled={busyTurnId !== null}
            type="submit"
          >
            <Icon name="arrow" />
            {busyTurnId === null ? "Send question" : "Waiting…"}
          </button>
        </div>
        {validationError && (
          <p className="assistant-validation-error" role="alert">
            {validationError}
          </p>
        )}
      </form>
      <p className="assistant-retention-note">
        Questions and answers stay in this page only and are cleared when you
        start a new conversation or leave the page.
      </p>
    </div>
  );
}

function CitationList({ citations }: { citations: AssistantCitation[] }) {
  return (
    <div className="assistant-citations">
      <h3>Sources provided with this response</h3>
      <ul>
        {citations.map((citation, index) => (
          <li key={`${citation.title}-${index}`}>
            {citation.url ? (
              <a
                aria-label={`${citation.title} (opens in a new tab)`}
                href={citation.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {citation.title}
              </a>
            ) : (
              <span>{citation.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
