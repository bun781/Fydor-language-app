import type { ReactNode } from "react";

interface PageStateProps {
  eyebrow?: string;
  title: string;
  description: string;
  details?: string;
  tone?: "neutral" | "error";
  actions?: ReactNode;
}

export function PageState({
  eyebrow,
  title,
  description,
  details,
  tone = "neutral",
  actions
}: PageStateProps) {
  return (
    <section className={`card page-state page-state-${tone}`}>
      {eyebrow ? <span className="page-state-eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {details ? <pre className="page-state-details">{details}</pre> : null}
      {actions ? <div className="page-state-actions">{actions}</div> : null}
    </section>
  );
}
