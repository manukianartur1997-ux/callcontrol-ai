// Root component: auth boot -> membership context -> shell + routed screens.
//
// Order of gates (each renders and stops):
//   1. booting            -> centered spinner
//   2. no session         -> Login
//   3. /me loading        -> centered spinner
//   4. /me failed         -> error screen with retry + sign out
//   5. zero memberships   -> "no access" screen with sign out
//   6. otherwise          -> Shell with the active org's screens
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { fetchMe, normalizeMe } from "./api.js";
import { copy } from "./copy.js";
import { useHashRoute, navigate } from "./router.js";
import { CenterSpinner, ErrorBox } from "./ui.jsx";
import { Login } from "./Login.jsx";
import { Shell, BrandMark } from "./Shell.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { Calls } from "./Calls.jsx";
import { CallDetail } from "./CallDetail.jsx";
import { Settings } from "./Settings.jsx";
import { NewCallModal } from "./NewCallModal.jsx";

export function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);

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
  if (!session) return <Login />;
  return <Authed session={session} />;
}

// Loads /api/app/me once per signed-in user; the Worker is the source of
// truth for "which orgs does this user belong to".
function Authed({ session }) {
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
          user: { id: session.user.id, email: session.user.email },
          memberships: normalizeMe(raw)
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [session.user.id, tick]);

  const signOut = () => supabase.auth.signOut();

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <BrandMark />
            <span className="brand-name brand-name-dark">{copy.common.appName}</span>
          </div>
          <h1 className="auth-title">{copy.errorScreen.title}</h1>
          <ErrorBox error={error} onRetry={() => setTick((t) => t + 1)} />
          <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>
            {copy.common.signOut}
          </button>
        </div>
      </div>
    );
  }

  if (!me) return <CenterSpinner />;

  if (me.memberships.length === 0) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <BrandMark />
            <span className="brand-name brand-name-dark">{copy.common.appName}</span>
          </div>
          <h1 className="auth-title">{copy.noAccess.title}</h1>
          <p className="auth-subtitle">{copy.noAccess.text}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={signOut}>
            {copy.common.signOut}
          </button>
        </div>
      </div>
    );
  }

  return <Workspace me={me} session={session} onSignOut={signOut} />;
}

function Workspace({ me, session, onSignOut }) {
  const route = useHashRoute();
  const [orgId, setOrgId] = useState(me.memberships[0].org_id);
  const [newCallOpen, setNewCallOpen] = useState(false);

  const active = me.memberships.find((m) => m.org_id === orgId) || me.memberships[0];
  const canSettings = active.role === "owner" || active.role === "admin";

  // In-app 404 and forbidden pages redirect to the dashboard.
  const known =
    route.page === "dashboard" ||
    route.page === "calls" ||
    (route.page === "settings" && canSettings);
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
  } else if (route.page === "settings") {
    content = <Settings org={active} />;
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
