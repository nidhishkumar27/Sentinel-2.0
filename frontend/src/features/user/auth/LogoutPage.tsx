import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Icon } from "../../../components/ui/Icon";
import { useAuth } from "./authContext";

export function LogoutPage() {
  const { signOut, status } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  if (status === "checking") {
    return (
      <section aria-live="polite" className="account-state" role="status">
        Checking account session…
      </section>
    );
  }

  if (signedOut) {
    return <Navigate replace to="/login" />;
  }

  if (status === "unauthenticated" || status === "unavailable") {
    return (
      <section aria-labelledby="logout-heading" className="account-state">
        <span className="account-state-icon">
          <Icon name="lock" />
        </span>
        <p className="eyebrow">ACCOUNT</p>
        <h1 id="logout-heading">
          {status === "unavailable"
            ? "Sign out isn’t available"
            : "No active session"}
        </h1>
        <p>
          {status === "unavailable"
            ? "The account service could not verify your session. No sign-out was confirmed."
            : "The account service confirmed that no user is signed in."}
        </p>
        <Link className="placeholder-back-link" to="/">
          <Icon name="arrow" />
          Back to dashboard
        </Link>
      </section>
    );
  }

  async function handleSignOut() {
    setFeedback("");
    setSubmitting(true);
    const result = await signOut();
    setSubmitting(false);

    if (result.status === "failure") {
      setFeedback(
        result.code === "unavailable"
          ? "The account service is unavailable. Your sign-out could not be confirmed."
          : "We couldn't confirm sign out. Please try again.",
      );
      return;
    }
    setSignedOut(true);
  }

  return (
    <section aria-labelledby="logout-heading" className="account-state">
      <span className="account-state-icon">
        <Icon name="signout" />
      </span>
      <p className="eyebrow">ACCOUNT</p>
      <h1 id="logout-heading">Sign out?</h1>
      <p>
        This will ask the connected account service to end your current session.
      </p>
      {feedback && (
        <p className="auth-feedback" role="alert">
          {feedback}
        </p>
      )}
      <div className="account-state-actions">
        <button
          className="auth-submit"
          disabled={submitting}
          onClick={handleSignOut}
          type="button"
        >
          {submitting ? "Signing out…" : "Sign out"}
        </button>
        <Link className="account-cancel-link" to="/profile">
          Cancel
        </Link>
      </div>
    </section>
  );
}