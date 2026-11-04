import type { AuthenticatedUser, AuthResult, RegistrationDetails, RegistrationOutcome, SignInCredentials } from "../types/auth";
import type { AuthGateway } from "../features/user/auth/authGateway";
import { ApiClientError, requestApi, userSession } from "./apiClient";

type BackendUser = { _id: string; name: string; email: string; role: "user" | "authority"; isActive: boolean };
type AuthResponse = { user: BackendUser; accessToken: string; refreshToken: string; accessTokenExpiresIn: string };

function toFrontendUser(user: BackendUser): AuthenticatedUser {
  return { id: user._id, displayName: user.name, email: user.email };
}

function storeAuth(response: AuthResponse): AuthenticatedUser {
  userSession.set({ user: response.user, accessToken: response.accessToken, refreshToken: response.refreshToken });
  return toFrontendUser(response.user);
}

function failure(error: unknown): AuthResult<never> {
  if (error instanceof ApiClientError && error.code === "INVALID_CREDENTIALS") return { status: "failure", code: "invalid-credentials" };
  if (error instanceof ApiClientError && error.code === "EMAIL_TAKEN") return { status: "failure", code: "email-in-use" };
  if (error instanceof ApiClientError && error.status === 0) return { status: "failure", code: "unavailable" };
  return { status: "failure", code: "error" };
}

export const authService: AuthGateway = {
  async getCurrentUser() {
    if (!userSession.get()) return { status: "success", value: null };
    try {
      const user = await requestApi<BackendUser>("/auth/me");
      return user.isActive
        ? { status: "success", value: toFrontendUser(user) }
        : { status: "success", value: null };
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) return { status: "success", value: null };
      return failure(error);
    }
  },
  async signIn(credentials: SignInCredentials) {
    try {
      const result = await requestApi<AuthResponse>("/auth/login", { method: "POST", auth: false, body: credentials });
      if (result.user.role !== "user") return { status: "failure", code: "error" };
      return { status: "success", value: storeAuth(result) };
    } catch (error) {
      return failure(error);
    }
  },
  async register(details: RegistrationDetails) {
    try {
      const result = await requestApi<AuthResponse>("/auth/register", {
        method: "POST",
        auth: false,
        body: { name: details.fullName, email: details.email, phone: details.phone, password: details.password },
      });
      if (result.user.role !== "user") return { status: "failure", code: "error" };
      return { status: "success", value: { status: "authenticated", user: storeAuth(result) } satisfies RegistrationOutcome };
    } catch (error) {
      return failure(error);
    }
  },
  async signOut() {
    const current = userSession.get();
    if (!current) return { status: "success", value: null };
    try {
      await requestApi<unknown>("/auth/logout", { method: "POST", auth: false, body: { refreshToken: current.refreshToken } });
      userSession.clear();
      return { status: "success", value: null };
    } catch (error) {
      // Clear the local session even if the server is unreachable; the UI must not retain a signed-in state.
      userSession.clear();
      return failure(error);
    }
  },
};
