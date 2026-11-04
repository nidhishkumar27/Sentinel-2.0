import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestApi } from "../../../services/apiClient";
import { TextField } from "../auth/AuthFormFields";

type EmergencyContact = { _id: string; name: string; phone: string; relationship?: string; isPrimary?: boolean };
type ContactDraft = { name: string; phone: string; relationship: string };
const emptyDraft: ContactDraft = { name: "", phone: "", relationship: "" };

export function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setContacts(await requestApi<EmergencyContact[]>("/emergency-contacts"));
    } catch {
      setError("Emergency contacts could not be loaded. Please sign in again or try later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const contact = await requestApi<EmergencyContact>("/emergency-contacts", {
        method: "POST",
        body: { name: draft.name.trim(), phone: draft.phone.trim(), ...(draft.relationship.trim() ? { relationship: draft.relationship.trim() } : {}), isPrimary: contacts.length === 0 },
      });
      setContacts((current) => [...current, contact].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))));
      setDraft(emptyDraft);
      setNotice("Emergency contact saved.");
    } catch {
      setError("This contact could not be saved. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(contact: EmergencyContact) {
    setError("");
    setNotice("");
    try {
      await requestApi(`/emergency-contacts/${contact._id}`, { method: "DELETE" });
      setContacts((current) => current.filter((item) => item._id !== contact._id));
      setNotice("Emergency contact removed.");
    } catch {
      setError("This contact could not be removed. Please try again.");
    }
  }

  async function makePrimary(contact: EmergencyContact) {
    setError("");
    try {
      const updated = await requestApi<EmergencyContact>(`/emergency-contacts/${contact._id}`, { method: "PUT", body: { isPrimary: true } });
      setContacts((current) => current.map((item) => ({ ...item, isPrimary: item._id === updated._id })));
      setNotice(`${contact.name} is now your primary emergency contact.`);
    } catch {
      setError("The primary contact could not be updated. Please try again.");
    }
  }

  return <section className="profile-page emergency-contacts-page" aria-labelledby="emergency-contacts-heading">
    <div className="profile-page-heading">
      <p className="eyebrow">YOUR SAFETY NETWORK</p>
      <h1 id="emergency-contacts-heading">Emergency contacts</h1>
      <p>Contacts you added during signup are saved to your account and shown here. You can manage up to five contacts.</p>
    </div>
    {error && <p className="form-error-summary" role="alert">{error}</p>}
    {notice && <p className="emergency-contacts-notice" role="status">{notice}</p>}
    {error && <button type="button" className="account-cancel-link" onClick={() => void loadContacts()}>Try loading contacts again</button>}
    {loading ? <p className="emergency-contacts-loading" role="status">Loading your emergency contacts…</p> : contacts.length ? <div className="emergency-contacts-list">
      {contacts.map((contact) => <article className="emergency-contact-card" key={contact._id}>
        <div className="emergency-contact-copy"><strong>{contact.name}</strong>{contact.isPrimary && <span className="verified-session">PRIMARY</span>}<p>{contact.phone}{contact.relationship ? ` · ${contact.relationship}` : ""}</p></div>
        <div className="emergency-contact-actions">
          {!contact.isPrimary && <button type="button" className="integration-secondary-button" onClick={() => void makePrimary(contact)}>Set as primary</button>}
          <button type="button" className="integration-secondary-button" onClick={() => void removeContact(contact)}>Remove</button>
        </div>
      </article>)}
    </div> : !error && <p className="profile-readonly-note">No emergency contacts are saved yet. Add someone you trust below.</p>}
    {contacts.length < 5 && <form className="profile-card emergency-contact-form" onSubmit={(event) => void addContact(event)}>
      <div className="emergency-contact-form-heading"><h2>Add emergency contact</h2><p>Keep someone you trust one tap away.</p></div>
      <TextField id="emergency-contact-name" label="Name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Contact’s full name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      <TextField id="emergency-contact-phone" label="Mobile number" autoComplete="tel" required type="tel" minLength={7} maxLength={20} placeholder="Include country code, e.g. +91 98765 43210" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
      <TextField id="emergency-contact-relationship" label="Relationship (optional)" maxLength={40} placeholder="For example, family or friend" value={draft.relationship} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} />
      <button className="auth-submit emergency-contact-submit" disabled={saving} type="submit">{saving ? "Saving…" : "Save contact"}</button>
    </form>}
    {contacts.length >= 5 && <p className="profile-readonly-note">You have reached the five-contact limit. Remove a contact before adding another.</p>}
    <Link className="account-cancel-link" to="/user">Back to dashboard</Link>
  </section>;
}
