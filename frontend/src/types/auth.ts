export type AuthenticatedUser = {
  id: string;
  displayName: string;
  email: string;
};

export type SignInCredentials = {
  email: string;
  password: string;
};

export type RegistrationDetails = {
  fullName: string;
  email: string;
  password: string;
};

export type RegistrationOutcome =
  | { status: "account-created" }
  | { status: "verification-required" }
  | { status: "authenticated"; user: AuthenticatedUser };

export type AuthErrorCode =
  | "unavailable"
  | "timeout"
  | "invalid-credentials"
  | "email-in-use"
  | "error";

export type AuthResult<T> =
  | { status: "success"; value: T }
  | { status: "failure"; code: AuthErrorCode };