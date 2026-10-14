import type { ReactNode } from "react";
import { AuthProvider } from "../features/user/auth/AuthProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
