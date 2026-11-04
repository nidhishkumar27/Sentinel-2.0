import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";
import { useAuth } from "../user/auth/authContext";
import "./home.css";

const steps = [
  {
    number: "01",
    title: "Plan with a live safety map",
    copy: "Check advisories, hazard zones and nearby help before you set out, so every route starts with the full picture.",
    linkTo: "/safety-map",
    linkLabel: "Open the safety map",
  },
  {
    number: "02",
    title: "Get help with one-tap SOS",
    copy: "In an emergency, send an SOS with your live location to responders and your emergency contacts in seconds.",
    linkTo: "/sos",
    linkLabel: "See emergency options",
  },
  {
    number: "03",
    title: "Keep contacts in the loop",
    copy: "Save the people who matter. They are notified automatically when you raise an alert or go off-plan.",
    linkTo: "/emergency-contacts",
    linkLabel: "Manage contacts",
  },
  {
    number: "04",
    title: "Stay ahead with live alerts",
    copy: "Weather hazards, incidents and advisories for your area, delivered as they are confirmed by connected sources.",
    linkTo: "/alerts",
    linkLabel: "Browse alerts",
  },
];

export function HomePage() {
  const { status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div className="home">
      <a className="skip-link" href="#home-main">
        Skip to main content
      </a>

      <header className="home-header">
        <div className="home-header-inner">
          <Link aria-label="Sentinel home" className="home-brand" to="/">
            <span className="brand-mark home-brand-mark">
              <Icon name="compass" />
            </span>
            <span>
              <span className="brand-name">sentinel</span>
              <span className="brand-caption">TRAVEL WITH CONFIDENCE</span>
            </span>
          </Link>

          <nav aria-label="Product" className="home-nav">
            <a href="#travellers">Travellers</a>
            <a href="#authorities">Authorities</a>
            <a href="#how-it-works">How it works</a>
          </nav>

          <div className="home-header-actions">
            {status === "authenticated" ? (
              <Link className="home-btn home-btn--primary" to="/user">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link className="home-btn home-btn--ghost" to="/login">
                  Sign in
                </Link>
                <Link className="home-btn home-btn--primary" to="/register">
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="home-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>

        {menuOpen && (
          <nav aria-label="Mobile" className="home-mobile-nav">
            <a href="#travellers" onClick={() => setMenuOpen(false)}>
              Travellers
            </a>
            <a href="#authorities" onClick={() => setMenuOpen(false)}>
              Authorities
            </a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <span className="home-mobile-divider" />
            {status === "authenticated" ? (
              <Link to="/user" onClick={() => setMenuOpen(false)}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)}>
                  Get started
                </Link>
              </>
            )}
            <Link to="/authority/login" onClick={() => setMenuOpen(false)}>
              Authority sign in
            </Link>
          </nav>
        )}
      </header>

      <main id="home-main">
        <section aria-labelledby="home-heading" className="home-hero">
          <span aria-hidden="true" className="home-moon" />
          <div aria-hidden="true" className="home-fireflies">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="home-hero-inner">
          <div className="home-hero-copy">
            <p className="home-badge">
              <Icon name="sparkle" />
              Built for travellers &amp; adventurers
            </p>
            <h1 id="home-heading">Sentinel keeps every journey safe.</h1>
            <p className="home-lede">
              Sentinel is your travel safety companion: one-tap SOS, live
              safety maps, instant alerts and emergency contacts that travel
              with you &mdash; from daily commutes to remote expeditions.
            </p>
            <div className="home-cta-row">
              <Link className="home-btn home-btn--primary home-btn--large" to="/register">
                Create free account
                <Icon name="arrow" />
              </Link>
              <Link className="home-btn home-btn--outline home-btn--large" to="/authority/login">
                Authority access
              </Link>
            </div>
            <p className="home-reassurance">
              Free for travellers
              <span aria-hidden="true"> · </span>
              No card required
              <span aria-hidden="true"> · </span>
              SOS ready in seconds
            </p>
          </div>

          </div>
        </section>

        <section aria-label="Sentinel at a glance" className="home-strip">
          <div className="home-strip-inner">
            <span>
              <Icon name="sos" />
              One-tap SOS with live location
            </span>
            <span>
              <Icon name="map" />
              Live safety maps &amp; advisories
            </span>
            <span>
              <Icon name="shield" />
              Verified response authorities
            </span>
            <span>
              <Icon name="contacts" />
              Emergency contacts on standby
            </span>
          </div>
        </section>

        <section aria-labelledby="how-it-works-heading" className="home-section" id="how-it-works">
          <div className="home-section-heading">
            <h2 id="how-it-works-heading">How Sentinel travels with you</h2>
            <p>
              Four safety nets that work quietly in the background &mdash; until
              the moment you need them.
            </p>
          </div>
          <ol className="home-steps">
            {steps.map((step) => (
              <li key={step.number} className="home-step">
                <span aria-hidden="true" className="home-step-number">
                  {step.number}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  <Link className="home-step-link" to={step.linkTo}>
                    {step.linkLabel}
                    <Icon name="arrow" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Who Sentinel is for" className="home-section home-split-section">
          <div className="home-split home-split--navy" id="travellers">
            <Icon name="compass" />
            <h2>For travellers &amp; adventurers</h2>
            <p>
              Trekking, road-tripping or exploring a new city &mdash; carry a
              safety net built for the unpredictable.
            </p>
            <ul>
              <li>Send an SOS with your exact location, even under pressure</li>
              <li>See hazards and advisories along your route in real time</li>
              <li>Keep family and friends informed automatically</li>
            </ul>
            <Link className="home-btn home-btn--light" to="/register">
              Join as a traveller
              <Icon name="arrow" />
            </Link>
          </div>

          <div className="home-split home-split--plain" id="authorities">
            <Icon name="shield" />
            <h2>For response authorities</h2>
            <p>
              Police, medical, fire and disaster teams coordinate faster with a
              shared live picture of every incident.
            </p>
            <ul>
              <li>Receive SOS incidents with live locations instantly</li>
              <li>Assign responders and track progress on a live map</li>
              <li>Review analytics to strengthen coverage over time</li>
            </ul>
            <p className="home-split-actions">
              <Link className="home-btn home-btn--primary" to="/authority/register">
                Register your unit
                <Icon name="arrow" />
              </Link>
            </p>
          </div>
        </section>

        <section aria-labelledby="home-cta-heading" className="home-cta-band">
          <h2 id="home-cta-heading">Ready for your next adventure?</h2>
          <p>
            Set up your safety profile in minutes. Sentinel handles the rest.
          </p>
          <div className="home-cta-row">
            <Link className="home-btn home-btn--light home-btn--large" to="/register">
              Get started free
              <Icon name="arrow" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <span className="brand-mark home-brand-mark">
              <Icon name="compass" />
            </span>
            <div>
              <p className="brand-name">sentinel</p>
              <p className="home-footer-tagline">Travel with confidence.</p>
            </div>
          </div>
          <nav aria-label="Footer" className="home-footer-nav">
            <div>
              <p>Product</p>
              <a href="#how-it-works">How it works</a>
              <a href="#travellers">For travellers</a>
              <a href="#authorities">For authorities</a>
            </div>
            <div>
              <p>Travellers</p>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
              <Link to="/user">Dashboard</Link>
            </div>
            <div>
              <p>Authorities</p>
              <Link to="/authority/login">Sign in</Link>
              <Link to="/authority/register">Register unit</Link>
              <Link to="/authority">Dashboard</Link>
            </div>
          </nav>
        </div>
        <p className="home-footer-bottom">Sentinel · Travel with confidence</p>
      </footer>
    </div>
  );
}
