import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/user/auth/authContext";

export function RequireUser({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return <p role="status">Checking account session…</p>;
  }
  if (status !== "authenticated") {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
