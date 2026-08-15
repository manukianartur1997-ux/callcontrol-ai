// Application chrome: dark sidebar (top bar on narrow screens) + content
// area. Navigation is plain <a href="#/..."> — the hash router picks it up.
import { copy } from "./copy.js";

// Gradient logo square, reused by Login. Pure CSS, no image assets.
export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">C</span>;
}

export function Shell({ me, active, route, onSwitchOrg, onSignOut, children }) {
  const canSettings = active.role === "owner" || active.role === "admin";
  const navItems = [
    { page: "dashboard", href: "#/", label: copy.nav.dashboard },
    { page: "calls", href: "#/calls", label: copy.nav.calls }
  ];
  if (canSettings) navItems.push({ page: "settings", href: "#/settings", label: copy.nav.settings });

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <BrandMark />
          <span className="brand-name">{copy.common.appName}</span>
        </div>

        {me.memberships.length > 1 ? (
          <label className="side-org">
            <span className="side-org-label">{copy.shell.orgLabel}</span>
            <select
              className="input input-dark"
              value={active.org_id}
              onChange={(e) => onSwitchOrg(e.target.value)}
            >
              {me.memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {m.org_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="side-org side-org-single">{active.org_name}</div>
        )}

        <nav className="side-nav">
          {navItems.map((item) => (
            <a
              key={item.page}
              href={item.href}
              className={route.page === item.page ? "nav-link active" : "nav-link"}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="side-user">
          <div className="user-name">{active.full_name || me.user.email}</div>
          <div className="user-meta">
            {copy.roles[active.role] || active.role}
            {active.full_name ? ` · ${me.user.email}` : ""}
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-signout" onClick={onSignOut}>
            {copy.common.signOut}
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
