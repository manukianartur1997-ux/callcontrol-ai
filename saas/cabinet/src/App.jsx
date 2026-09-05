// Root component: auth boot -> membership context -> shell + routed screens.
//
// Order of gates (each renders and stops):
//   1. booting            -> centered spinner
//   2. no session         -> Login (invite mode + prefilled code on #/join/<t>)
//   3. #/join/<token>     -> auto invite acceptance screen (JoinToken)
//   4. /me failed         -> error screen with retry + sign out
//   5. /me loading        -> centered spinner
//   6. zero memberships   -> NoAccess (invite-code / create-company cards)
//   7. otherwise          -> Shell with the active org's screens
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { fetchMe, normalizeMe } from "./api.js";
import { copy } from "./copy.js";
import { useLocale } from "./hooks.js";
import { useHashRoute, navigate } from "./router.js";
import { CenterSpinner, ErrorBox } from "./ui.jsx";
import { Login } from "./Login.jsx";
import { Shell, BrandMark } from "./Shell.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { Calls } from "./Calls.jsx";
import { CallDetail } from "./CallDetail.jsx";
import { Settings } from "./Settings.jsx";
import { Profile } from "./Profile.jsx";
import { JoinToken } from "./Join.jsx";
import { NoAccess } from "./NoAccess.jsx";
import { NewCallModal } from "./NewCallModal.jsx";
import { Checklists } from "./Checklists.jsx";
import { Usage } from "./Usage.jsx";
import { Billing } from "./Billing.jsx";
import { Platform } from "./Platform.jsx";

export function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const route = useHashRoute();
  // Subscribes the whole tree to locale switches: any change re-renders App
  // and cascades through every mounted screen, so each render-time `copy`
  // read picks up the new language (see the note at the top of copy.js).
  useLocale();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      setBooting(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (booting) return <CenterSpinner />;
  if (!session) {
    // An invite link (#/join/<token>) without a session opens the login
    // screen straight in invite mode with the code prefilled. The key remounts
    // Login when the token appears/changes so the prefill actually lands.
    const inviteToken = route.page === "join" && route.id ? route.id : null;
    return (
      <Login
        key={inviteToken || "plain"}
        initialMode={inviteToken ? "invite" : "signin"}
        inviteToken={inviteToken}
      />
    );
  }
  return <Authed session={session} />;
}

// Loads /api/app/me once per signed-in user; the Worker is the source of
// truth for "which orgs does this user belong to".
function Authed({ session }) {
  const route = useHashRoute();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMe(null);
    setError(null);
    fetchMe()
      .then((raw) => {
        if (cancelled) return;
        setMe({
          memberships: normalizeMe(raw),
          // /me echoes the auth user with user_metadata {full_name?, avatar?}
          meta: (raw && raw.user && raw.user.user_metadata) || {},
          // Platform super-admin flag (PLATFORM_ADMIN_IDS on the Worker); absent
          // or false for everyone else. Gates the platform nav + routes.
          isPlatformAdmin: Boolean(raw && raw.is_platform_admin)
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [session.user.id, tick]);

  const reload = () => setTick((t) => t + 1);
  const signOut = () => supabase.auth.signOut();

  // Invite link while signed in: accept it regardless of current memberships
  // (an invited user may already belong to another org). Runs even while /me
  // is still loading — joining does not need it.
  if (route.page === "join" && route.id) {
    return (
      <JoinToken
        token={route.id}
        onJoined={() => {
          reload();
          navigate("/");
        }}
        onSignOut={signOut}
      />
    );
  }

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <BrandMark />
            <span className="brand-name brand-name-dark">{copy.common.appName}</span>
          </div>
          <h1 className="auth-title">{copy.errorScreen.title}</h1>
          <ErrorBox error={error} onRetry={reload} />
          <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>
            {copy.common.signOut}
          </button>
        </div>
      </div>
    );
  }

  if (!me) return <CenterSpinner />;

  if (me.memberships.length === 0) {
    return <NoAccess onReload={reload} onSignOut={signOut} />;
  }

  // The live session copy of user_metadata wins: it refreshes immediately on
  // updateUser (USER_UPDATED), while /me's copy is from fetch time.
  const user = {
    id: session.user.id,
    email: session.user.email,
    user_metadata: { ...me.meta, ...(session.user.user_metadata || {}) }
  };

  return (
    <Workspace
      me={{ user, memberships: me.memberships, isPlatformAdmin: me.isPlatformAdmin }}
      session={session}
      onSignOut={signOut}
    />
  );
}

function Workspace({ me, session, onSignOut }) {
  const route = useHashRoute();
  const [orgId, setOrgId] = useState(me.memberships[0].org_id);
  const [newCallOpen, setNewCallOpen] = useState(false);

  // user_id is folded in here (memberships don't carry it) so any screen that
  // needs "am I the author of this row" — e.g. the per-call feedback widget —
  // gets it from the same `org` prop it already receives, no extra plumbing.
  const active = { ...(me.memberships.find((m) => m.org_id === orgId) || me.memberships[0]), user_id: me.user.id };
  const canSettings = active.role === "owner" || active.role === "admin";
  const isPlatformAdmin = Boolean(me.isPlatformAdmin);

  // In-app 404 and forbidden pages redirect to the dashboard. Checklists and
  // usage share the owner/admin gate; platform is super-admin only.
  const known =
    route.page === "dashboard" ||
    route.page === "calls" ||
    route.page === "profile" ||
    (route.page === "checklists" && canSettings) ||
    (route.page === "usage" && canSettings) ||
    (route.page === "billing" && canSettings) ||
    (route.page === "settings" && canSettings) ||
    (route.page === "platform" && isPlatformAdmin);
  useEffect(() => {
    if (!known) navigate("/");
  }, [known]);

  // New screen = start reading from the top, like a normal page load.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.page, route.id]);

  const openNewCall = () => setNewCallOpen(true);

  let content = null;
  if (!known) {
    content = <CenterSpinner />;
  } else if (route.page === "calls" && route.id) {
    content = <CallDetail org={active} callId={route.id} />;
  } else if (route.page === "calls") {
    content = <Calls org={active} onNewCall={openNewCall} />;
  } else if (route.page === "checklists") {
    content = <Checklists org={active} />;
  } else if (route.page === "usage") {
    content = <Usage org={active} />;
  } else if (route.page === "billing") {
    content = <Billing org={active} />;
  } else if (route.page === "platform") {
    content = <Platform orgId={route.id} />;
  } else if (route.page === "settings") {
    content = <Settings org={active} />;
  } else if (route.page === "profile") {
    content = <Profile session={session} />;
  } else {
    content = <Dashboard org={active} onNewCall={openNewCall} />;
  }

  return (
    <>
      <Shell
        me={me}
        active={active}
        route={route}
        onSwitchOrg={(id) => {
          setOrgId(id);
          navigate("/"); // fresh org, fresh dashboard
        }}
        onSignOut={onSignOut}
      >
        {content}
      </Shell>

      {newCallOpen ? (
        <NewCallModal
          org={active}
          user={session.user}
          onClose={() => setNewCallOpen(false)}
          onDone={(callId) => {
            setNewCallOpen(false);
            navigate(`/calls/${callId}`);
          }}
        />
      ) : null}
    </>
  );
}
