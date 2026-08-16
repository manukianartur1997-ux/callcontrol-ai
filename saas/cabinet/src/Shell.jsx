// Application chrome: dark sidebar (top bar on narrow screens) + content
// area. Navigation is plain <a href="#/..."> — the hash router picks it up.
import { copy } from "./copy.js";
import { Avatar, LocaleSwitcher } from "./ui.jsx";

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
  if (canSettings) {
    navItems.push({ page: "checklists", href: "#/checklists", label: copy.nav.checklists });
    navItems.push({ page: "usage", href: "#/usage", label: copy.nav.usage });
    navItems.push({ page: "settings", href: "#/settings", label: copy.nav.settings });
  }
  // Platform super-admin surface — a visually distinct god-view entry, only
  // ever rendered when /me reported is_platform_admin.
  const platformItem = me.isPlatformAdmin
    ? { page: "platform", href: "#/platform", label: copy.nav.platform }
    : null;

  // The user's own name (auth user_metadata) wins over the owner-managed
  // membership name; the email is the last resort. Avatar preference mirrors
  // this: self-uploaded picture first, then whatever the OAuth provider gave.
  const meta = me.user.user_metadata || {};
  const displayName = meta.full_name || active.full_name || me.user.email;
  const avatarSrc = meta.avatar || meta.picture || meta.avatar_url || null;

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
          {platformItem ? (
            <a
              key={platformItem.page}
              href={platformItem.href}
              className={
                route.page === platformItem.page
                  ? "nav-link nav-link-god active"
                  : "nav-link nav-link-god"
              }
            >
              {platformItem.label}
            </a>
          ) : null}
        </nav>

        <div className="side-user">
          <a
            className={route.page === "profile" ? "side-user-link active" : "side-user-link"}
            href="#/profile"
            aria-label={copy.nav.profile}
            title={copy.nav.profile}
          >
            <Avatar name={displayName} src={avatarSrc} size={36} />
            <span className="side-user-text">
              <span className="user-name">{displayName}</span>
              <span className="user-meta">
                {copy.roles[active.role] || active.role}
                {displayName !== me.user.email ? ` · ${me.user.email}` : ""}
              </span>
            </span>
          </a>
          <div className="side-foot">
            <button type="button" className="btn btn-ghost btn-sm btn-signout" onClick={onSignOut}>
              {copy.common.signOut}
            </button>
            <LocaleSwitcher className="locale-switch-dark" />
          </div>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
