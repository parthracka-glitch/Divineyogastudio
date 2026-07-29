import { BellRing } from "../icons";

export default function PageHeader({ eyebrow, title, description, action }) {
  return <header className="page-header"><div><p className="eyebrow" data-testid="page-eyebrow">{eyebrow}</p><h1 data-testid="page-title">{title}</h1><p className="page-description" data-testid="page-description">{description}</p></div><div className="header-actions"><button className="icon-button" title="Notifications" aria-label="Notifications" data-testid="notifications-button"><BellRing size={19} /></button>{action}</div></header>;
}