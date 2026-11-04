import type {
  AuthenticatedUser,
  AuthResult,
  RegistrationDetails,
  RegistrationOutcome,
  SignInCredentials,
} from "../../../types/auth";

export interface AuthGateway {
  getCurrentUser(): Promise<AuthResult<AuthenticatedUser | null>>;
  signIn(credentials: SignInCredentials): Promise<AuthResult<AuthenticatedUser>>;
  register(details: RegistrationDetails): Promise<AuthResult<RegistrationOutcome>>;
  signOut(): Promise<AuthResult<null>>;
}