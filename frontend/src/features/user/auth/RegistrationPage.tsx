import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./authContext";
import { AuthPageLayout } from "./AuthPageLayout";
import {
  AuthFeedback,
  AuthServiceNotice,
  PasswordField,
  TextField,
} from "./AuthFormFields";
import type { AuthErrorCode, RegistrationOutcome } from "../../../types/auth";

function describeAuthError(code: AuthErrorCode) {
  if (code === "unavailable") {
    return "The account service is unavailable. Sentinel could not confirm whether registration completed or establish an account session.";
  }
  if (code === "email-in-use") {
    return "This email address may already be in use. Try signing in or use another address.";
  }
  return "We couldn't complete registration. Please try again later.";
}

function registrationMessage(outcome: RegistrationOutcome) {
  if (outcome.status === "account-created") {
    return "The account service confirmed registration. You can now sign in.";
  }
  if (outcome.status === "verification-required") {
    return "The registration service accepted the request. Complete its required verification step before signing in.";
  }
  return "Your account session was confirmed. You can continue to your profile.";
}

export function RegistrationPage() {
  const { register, status } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [registrationAuthenticated, setRegistrationAuthenticated] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate replace to="/profile" />;
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      nextErrors.fullName = "Enter your full name.";
    }
    if (!email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Create a password.";
    }
    if (!confirmation) {
      nextErrors.confirmation = "Confirm your password.";
    } else if (confirmation !== password) {
      nextErrors.confirmation = "The passwords do not match.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setSuccessMessage("");
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    const result = await register({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (result.status === "failure") {
      setFeedback(describeAuthError(result.code));
      return;
    }

    setRegistrationAuthenticated(result.value.status === "authenticated");
    setSuccessMessage(registrationMessage(result.value));
  }

  return (
    <AuthPageLayout
      description="Create an account to get started with Sentinel."
      eyebrow="GET STARTED"
      title="Create your account"
    >
      {status === "checking" && (
        <p className="auth-service-notice" role="status">
          Checking whether an account session is available…
        </p>
      )}
      {status === "unavailable" && <AuthServiceNotice />}
      {successMessage ? (
        <div className="auth-success" role="status">
          <span className="auth-success-icon">
            <span aria-hidden="true">✓</span>
          </span>
          <p>{successMessage}</p>
          {registrationAuthenticated ? (
            <Link className="auth-submit auth-submit--link" to="/profile">
              Go to your profile
            </Link>
          ) : (
            <Link className="auth-submit auth-submit--link" to="/login">
              Continue to sign in
            </Link>
          )}
        </div>
      ) : (
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <TextField
            autoComplete="name"
            error={errors.fullName}
            id="register-name"
            label="Full name"
            name="name"
            onChange={(event) => {
              setFullName(event.target.value);
              setErrors((current) => ({ ...current, fullName: "" }));
              setFeedback("");
            }}
            placeholder="Your name"
            type="text"
            value={fullName}
          />
          <TextField
            autoComplete="email"
            error={errors.email}
            id="register-email"
            label="Email address"
            name="email"
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: "" }));
              setFeedback("");
            }}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
          <PasswordField
            autoComplete="new-password"
            error={errors.password}
            id="register-password"
            label="Password"
            name="password"
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: "" }));
              setFeedback("");
            }}
            value={password}
          />
          <PasswordField
            autoComplete="new-password"
            error={errors.confirmation}
            id="register-confirmation"
            label="Confirm password"
            name="confirm-password"
            onChange={(event) => {
              setConfirmation(event.target.value);
              setErrors((current) => ({ ...current, confirmation: "" }));
              setFeedback("");
            }}
            value={confirmation}
          />
          {Object.values(errors).some(Boolean) && (
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
            {submitting || status === "checking"
              ? "Checking…"
              : "Create account"}
          </button>
        </form>
      )}
      {!successMessage && (
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      )}
    </AuthPageLayout>
  );
}