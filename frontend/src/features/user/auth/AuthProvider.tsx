import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { safetyIntegrations } from "../../../app/integrations";
import type {
  AuthenticatedUser,
  AuthResult,
  RegistrationDetails,
  RegistrationOutcome,
  SignInCredentials,
} from "../../../types/auth";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "./authContext";
import type { AuthGateway } from "./authGateway";

type AuthProviderProps = {
  children: ReactNode;
  gateway?: AuthGateway;
};

export function AuthProvider({
  children,
  gateway = safetyIntegrations.auth,
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("checking");
    setUser(null);

    gateway.getCurrentUser().then(
      (result) => {
        if (!active) {
          return;
        }

        if (result.status === "failure") {
          setStatus("unavailable");
          return;
        }

        setUser(result.value);
        setStatus(result.value ? "authenticated" : "unauthenticated");
      },
      () => {
        if (active) {
          setStatus("unavailable");
        }
      },
    );

    return () => {
      active = false;
    };
  }, [gateway]);

  const signIn = useCallback(
    async (credentials: SignInCredentials) => {
      try {
        const result = await gateway.signIn(credentials);
        if (result.status === "success") {
          setUser(result.value);
          setStatus("authenticated");
        }
        return result;
      } catch {
        return { status: "failure", code: "error" } as const;
      }
    },
    [gateway],
  );

  const register = useCallback(
    async (details: RegistrationDetails) => {
      try {
        const result = await gateway.register(details);
        if (
          result.status === "success" &&
          result.value.status === "authenticated"
        ) {
          setUser(result.value.user);
          setStatus("authenticated");
        }
        return result;
      } catch {
        return { status: "failure", code: "error" } as const;
      }
    },
    [gateway],
  );

  const signOut = useCallback(async () => {
    if (status !== "authenticated") {
      return { status: "failure", code: "unavailable" } as const;
    }

    try {
      const result = await gateway.signOut();
      if (result.status === "success") {
        setUser(null);
        setStatus("unauthenticated");
      }
      return result;
    } catch {
      return { status: "failure", code: "error" } as const;
    }
  }, [gateway, status]);

  const value = useMemo(
    () => ({ status, user, signIn, register, signOut }),
    [status, user, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}