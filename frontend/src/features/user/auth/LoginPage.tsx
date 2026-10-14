import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./authContext";
import { AuthPageLayout } from "./AuthPageLayout";
import {
  AuthFeedback,
  AuthServiceNotice,
  PasswordField,
  TextField,
} from "./AuthFormFields";
import type { AuthErrorCode } from "../../../types/auth";

function describeAuthError(code: AuthErrorCode) {
  if (code === "unavailable") {
    return "The account service is unavailable. Sentinel could not confirm sign in or establish an account session.";
  }
  if (code === "invalid-credentials") {
    return "The credentials could not be verified. Check them and try again.";
  }
  return "We couldn't complete sign in. Please try again later.";
}

export function LoginPage() {
  const { signIn, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate replace to="/profile" />;
  }

  function validate() {
    const cleanEmail = email.trim();
    const nextEmailError = !cleanEmail
      ? "Enter your email address."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ? "Enter a valid email address."
        : "";
    const nextPasswordError = password ? "" : "Enter your password.";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    return !nextEmailError && !nextPasswordError;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    const result = await signIn({ email: email.trim(), password });
    setSubmitting(false);

    if (result.status === "failure") {
      setFeedback(describeAuthError(result.code));
      return;
    }
    navigate("/profile", { replace: true });
  }

  return (
    <AuthPageLayout
      description="Sign in to access your Sentinel account."
      eyebrow="WELCOME BACK"
      title="Sign in"
    >
      {status === "checking" && (
        <p className="auth-service-notice" role="status">
          Checking whether an account session is available…
        </p>
      )}
      {status === "unavailable" && <AuthServiceNotice />}
      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <TextField
          autoComplete="email"
          error={emailError}
          id="login-email"
          label="Email address"
          name="email"
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError("");
            setFeedback("");
          }}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
        <PasswordField
          autoComplete="current-password"
          error={passwordError}
          id="login-password"
          label="Password"
          name="password"
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordError("");
            setFeedback("");
          }}
          value={password}
        />
        {(emailError || passwordError) && (
          <p className="form-error-summary" role="alert">
            Please correct the highlighted fields.
          </p>
        )}
        {feedback && <AuthFeedback message={feedback} />}
        <button
          className="auth-submit"
          disabled={submitting || status === "checking"}
          type="submit"
        >
          {submitting || status === "checking" ? "Checking…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        New to Sentinel? <Link to="/register">Create an account</Link>
      </p>
    </AuthPageLayout>
  );
}