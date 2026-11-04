import { createContext, useContext } from "react";
import type {
  AuthenticatedUser,
  AuthResult,
  RegistrationDetails,
  RegistrationOutcome,
  SignInCredentials,
} from "../../../types/auth";

export type AuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  signIn: (credentials: SignInCredentials) => Promise<AuthResult<AuthenticatedUser>>;
  register: (
    details: RegistrationDetails,
  ) => Promise<AuthResult<RegistrationOutcome>>;
  signOut: () => Promise<AuthResult<null>>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
