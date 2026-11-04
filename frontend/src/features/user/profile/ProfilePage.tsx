import { Link } from "react-router-dom";
import { Icon } from "../../../components/ui/Icon";
import { useAuth } from "../auth/authContext";

export function ProfilePage() {
  const { status, user } = useAuth();

  if (status === "checking") {
    return (
      <section aria-live="polite" className="account-state" role="status">
        Checking account session…
      </section>
    );
  }

  if (status === "unauthenticated" || status === "unavailable") {
    return (
      <section aria-labelledby="profile-heading" className="account-state">
        <span className="account-state-icon">
          <Icon name="profile" />
        </span>
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1 id="profile-heading">
          {status === "unavailable" ? "Profile unavailable" : "Sign in to view your profile"}
        </h1>
        <p>
          {status === "unavailable"
            ? "The account service is not connected, so Sentinel cannot verify or display profile information."
            : "No user session is active. Sign in to view the profile returned by the account service."}
        </p>
        <div className="account-state-actions">
          <Link className="auth-submit auth-submit--link" to="/login">
            Sign in
          </Link>
          <Link className="account-cancel-link" to="/">
            Back to dashboard
          </Link>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section aria-live="assertive" className="account-state" role="alert">
        The account service confirmed a session without profile information.
        Please contact support.
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-heading" className="profile-page">
      <div className="profile-page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1 id="profile-heading">Your profile</h1>
        <p>Profile details confirmed by the connected account service.</p>
      </div>
      <div className="profile-card">
        <span aria-hidden="true" className="profile-avatar">
          <Icon name="profile" />
        </span>
        <div>
          <p className="profile-name">{user.displayName}</p>
          <p className="profile-email">{user.email}</p>
        </div>
        <span className="verified-session">
          <Icon name="check" />
          SESSION CONFIRMED
        </span>
      </div>
      <p className="profile-readonly-note">
        Profile editing is unavailable until the account service and its update
        contract are connected.
      </p>
      <Link className="account-cancel-link" to="/logout">
        Sign out
      </Link>
    </section>
  );
}