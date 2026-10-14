import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../../components/ui/Icon";

type PlaceholderPageProps = {
  title: string;
  description: string;
  icon: IconName;
};

export function PlaceholderPage({
  title,
  description,
  icon,
}: PlaceholderPageProps) {
  return (
    <section aria-labelledby="placeholder-heading" className="placeholder-page">
      <div className="placeholder-icon">
        <Icon name={icon} />
      </div>
      <p className="eyebrow">SENTINEL 2.0 · PHASE 1 PREVIEW</p>
      <h1 id="placeholder-heading">{title}</h1>
      <p className="placeholder-description">{description}</p>
      <Link className="placeholder-back-link" to="/">
        <Icon name="arrow" />
        Back to dashboard
      </Link>
    </section>
  );
}
