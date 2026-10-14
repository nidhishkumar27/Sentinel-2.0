import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../../components/ui/Icon";

type AuthPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageLayout({
  eyebrow,
  title,
  description,
  children,
}: AuthPageLayoutProps) {
  return (
    <main className="auth-page">
      <div aria-hidden="true" className="auth-decoration auth-decoration--top" />
      <div aria-hidden="true" className="auth-decoration auth-decoration--bottom" />
      <header className="auth-header">
        <Link aria-label="Sentinel dashboard" className="auth-brand" to="/">
          <span className="brand-mark">
            <Icon name="compass" />
          </span>
          <span>
            <span className="brand-name">sentinel</span>
            <span className="brand-caption">TRAVEL WITH CONFIDENCE</span>
          </span>
        </Link>
        <Link className="auth-home-link" to="/">
          <Icon name="arrow" />
          Back to dashboard
        </Link>
      </header>

      <section aria-labelledby="auth-heading" className="auth-card">
        <div className="auth-card-heading">
          <span className="auth-card-icon">
            <Icon name="shield" />
          </span>
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-heading">{title}</h1>
          <p className="auth-description">{description}</p>
        </div>
        {children}
        <p className="auth-privacy-note">
          <Icon name="lock" />
          Your credentials are not stored by this preview.
        </p>
      </section>

      <footer className="auth-footer">
        Sentinel 2.0 · Account services are not connected in this preview
      </footer>
    </main>
  );
}