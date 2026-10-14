import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "../../../components/ui/Icon";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

export function TextField({
  id,
  label,
  error,
  ...inputProps
}: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="form-input-wrap">
        {inputProps.type === "email" && (
          <Icon className="form-input-icon" name="mail" />
        )}
        <input
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          className="form-input"
          id={id}
          {...inputProps}
        />
      </div>
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

type PasswordFieldProps = Omit<TextFieldProps, "type">;

export function PasswordField({
  id,
  label,
  error,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="form-input-wrap">
        <Icon className="form-input-icon" name="lock" />
        <input
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          className="form-input form-input--password"
          id={id}
          type={visible ? "text" : "password"}
          {...inputProps}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="password-visibility"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

export function AuthFeedback({ message }: { message: string }) {
  return (
    <p className="auth-feedback" role="alert">
      {message}
    </p>
  );
}

export function AuthServiceNotice() {
  return (
    <p className="auth-service-notice" role="status">
      <Icon name="clock" />
      Account service is unavailable. This preview could not verify an account
      session.
    </p>
  );
}
