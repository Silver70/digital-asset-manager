import { useState } from "react";
import {
  useAuth,
  useClerk,
  useOrganization,
  useOrganizationList,
  useUser,
} from "@clerk/clerk-react";
import {
  extractTauriError,
  getAuthState,
  logout,
  setSession,
  switchOrg,
} from "../../api/auth";
import { getStoragePath } from "../../api/settings";
import type { OrgMembership } from "../../types/auth";
import { LoginPage } from "./LoginPage";
import { OrgSwitcher } from "./OrgSwitcher";
import { StorageSetupModal } from "../common/StorageSetupModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "loading"
  | "session-error"
  | "need-org"
  | "need-storage"
  | "ready";

interface AuthGuardProps {
  children: React.ReactNode;
}

// ─── AuthGuard ────────────────────────────────────────────────────────────────

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth(); // getToken used in syncRustSession
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, isLoaded: listLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { signOut } = useClerk();

  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Kick off the Rust session sync once all Clerk hooks are loaded
  useState(() => {
    // useEffect equivalent — runs once dependencies are stable
    // The actual subscription is in the conditional render below
  });

  // ── Core sync function ─────────────────────────────────────────────────────

  async function syncRustSession() {
    try {
      // Fast-path: already synced in this process lifetime
      const existing = await getAuthState();
      if (existing?.active_org_id) {
        await checkStoragePath();
        return;
      }

      const jwt = await getToken();
      if (!jwt || !user) {
        // Clerk hooks not ready yet — stay loading; caller must retry
        return;
      }

      const orgs: OrgMembership[] = (userMemberships.data ?? []).map((mem) => ({
        org_id: mem.organization.id,
        org_name: mem.organization.name,
        role: mem.role,
      }));

      await setSession(jwt, user.primaryEmailAddress?.emailAddress ?? "", orgs);

      // If Clerk already has an active org, activate it in Rust automatically
      if (organization) {
        await switchOrg(organization.id);
        await checkStoragePath();
        return;
      }

      setPhase("need-org");
    } catch (err) {
      // DO NOT fall through to "need-org" — AppState.auth is still None.
      // Surface the real error so the user can retry or sign out.
      console.error("[AuthGuard] session sync failed:", err);
      setSessionError(extractTauriError(err));
      setPhase("session-error");
    }
  }

  /** After an org is active, verify storage is configured for it. */
  async function checkStoragePath() {
    try {
      const path = await getStoragePath();
      setPhase(path ? "ready" : "need-storage");
    } catch {
      setPhase("need-storage");
    }
  }

  /**
   * Re-runs the full session sync from scratch.
   * Used by the Retry button on the session-error screen.
   */
  async function retrySession() {
    setPhase("loading");
    setSessionError(null);
    await syncRustSession();
  }

  /**
   * Guarantees AppState.auth is populated before the caller proceeds.
   * No-op if auth is already set (avoids redundant JWKS round-trips).
   * Passed to OrgSwitcher as a defensive guard before switchOrg.
   */
  async function ensureSession() {
    const existing = await getAuthState();
    if (existing) return;
    await syncRustSession();
  }

  async function handleOrgSelected() {
    await checkStoragePath();
  }

  async function handleSignOut() {
    try {
      await logout();
      await signOut();
    } catch {
      // Best-effort; Clerk sign-out will reset the UI regardless
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <LoginPage />;

  // Trigger sync once all hooks are ready
  if (
    phase === "loading" &&
    isLoaded &&
    userLoaded &&
    listLoaded &&
    orgLoaded
  ) {
    // Kick off sync without making the component async — fire and forget
    syncRustSession().catch((err) => {
      setSessionError(extractTauriError(err));
      setPhase("session-error");
    });
    return <LoadingScreen />;
  }

  if (phase === "loading") return <LoadingScreen />;

  if (phase === "session-error") {
    return (
      <SessionErrorScreen
        error={sessionError ?? "Authentication failed"}
        onRetry={retrySession}
        onSignOut={handleSignOut}
      />
    );
  }

  if (phase === "need-org") {
    return (
      <OrgSwitcher
        onOrgSelected={handleOrgSelected}
        ensureSession={ensureSession}
      />
    );
  }

  if (phase === "need-storage") {
    return <StorageSetupModal onComplete={() => setPhase("ready")} />;
  }

  return <>{children}</>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  );
}

function SessionErrorScreen({
  error,
  onRetry,
  onSignOut,
}: {
  error: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-3">
          Authentication Error
        </h2>
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2 mb-6 break-words">
          {error}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onSignOut}
            className="flex-1 py-2.5 border border-gray-600 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
