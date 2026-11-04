import { Link } from "react-router-dom";

export function RoleSelectPage() {
  return <section className="role-select-page">
    <p className="eyebrow">SENTINEL 2.0</p>
    <h1>How are you using Sentinel?</h1>
    <p>Choose the workspace that matches your role.</p>
    <div className="role-select-options">
      <Link to="/register" className="role-select-card"><strong>User registration</strong><span>Create a community account for safety tools, alerts, maps and emergency assistance</span></Link>
      <Link to="/authority/register" className="role-select-card"><strong>Authority registration</strong><span>Register an emergency services account for the authority dashboard</span></Link>
    </div>
  </section>;
}
