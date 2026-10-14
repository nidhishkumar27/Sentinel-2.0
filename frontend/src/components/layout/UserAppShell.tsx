import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Icon, type IconName } from "../ui/Icon";
import { useAuth } from "../../features/user/auth/authContext";

const navigation: { label: string; to: string; icon: IconName }[] = [
  { label: "Dashboard", to: "/", icon: "dashboard" },
  { label: "SOS", to: "/sos", icon: "sos" },
  { label: "Safety map", to: "/safety-map", icon: "map" },
  { label: "Emergency contacts", to: "/emergency-contacts", icon: "contacts" },
  { label: "Digital ID", to: "/digital-id", icon: "id" },
  { label: "Alerts", to: "/alerts", icon: "alerts" },
  { label: "Safety assistant", to: "/safety-assistant", icon: "assistant" },
];

export function UserAppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { status } = useAuth();

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {menuOpen && (
        <button
          aria-label="Dismiss navigation backdrop"
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}
      <aside
        aria-label="Main navigation"
        className={`sidebar${menuOpen ? " sidebar--open" : ""}`}
      >
        <NavLink
          aria-label="Sentinel home"
          className="brand"
          onClick={() => setMenuOpen(false)}
          to="/"
        >
          <span className="brand-mark">
            <Icon name="compass" />
          </span>
          <span>
            <span className="brand-name">sentinel</span>
            <span className="brand-caption">TRAVEL WITH CONFIDENCE</span>
          </span>
        </NavLink>

        <p className="nav-label">YOUR SPACE</p>
        <nav aria-label="Your safety tools" className="primary-nav">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link--active" : ""}${item.to === "/sos" ? " nav-link--sos" : ""}`
              }
              end={item.to === "/"}
              onClick={() => setMenuOpen(false)}
              to={item.to}
            >
              <Icon className="nav-icon" name={item.icon} />
              <span>{item.label}</span>
              {item.to === "/sos" && <span className="nav-sos-dot" />}
            </NavLink>
          ))}
        </nav>

        <p className="nav-label account-nav-label">ACCOUNT</p>
        <nav aria-label="Account" className="primary-nav">
          {status === "authenticated" ? (
            <>
              <NavLink
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
                onClick={() => setMenuOpen(false)}
                to="/profile"
              >
                <Icon className="nav-icon" name="profile" />
                <span>My profile</span>
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
                onClick={() => setMenuOpen(false)}
                to="/logout"
              >
                <Icon className="nav-icon" name="signout" />
                <span>Sign out</span>
              </NavLink>
            </>
          ) : status === "checking" ? (
            <span aria-live="polite" className="nav-account-pending">
              Checking account…
            </span>
          ) : (
            <>
              <NavLink
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
                onClick={() => setMenuOpen(false)}
                to="/login"
              >
                <Icon className="nav-icon" name="profile" />
                <span>Sign in</span>
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
                onClick={() => setMenuOpen(false)}
                to="/register"
              >
                <Icon className="nav-icon" name="id" />
                <span>Create account</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-icon">
              <Icon name="shield" />
            </span>
            <p>
              A little preparation
              <br />
              goes a long way.
            </p>
          </div>
          <span className="sidebar-version">SENTINEL 2.0 · PREVIEW</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="icon-button mobile-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
          <div className="topbar-context">
            <span className="topbar-eyebrow">YOUR TRAVEL COMPANION</span>
            <span className="topbar-title">Safety, within reach</span>
          </div>
          <span className="preview-pill">
            <span className="preview-dot" />
            DEMO PREVIEW
          </span>
        </header>

        <main id="main-content" className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
