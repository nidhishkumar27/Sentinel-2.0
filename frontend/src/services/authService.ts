import type { AuthResult } from "../types/auth";
import type { AuthGateway } from "../features/user/auth/authGateway";

const unavailable: AuthResult<never> = {
  status: "failure",
  code: "unavailable",
};

export const authService: AuthGateway = {
  async getCurrentUser() {
    return unavailable;
  },
  async signIn(_credentials) {
    return unavailable;
  },
  async register(_details) {
    return unavailable;
  },
  async signOut() {
    return unavailable;
  },
};