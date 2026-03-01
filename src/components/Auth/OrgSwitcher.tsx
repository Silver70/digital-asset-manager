import { useState } from "react";
import { useClerk, useOrganizationList } from "@clerk/clerk-react";
import { extractTauriError, logout, switchOrg } from "../../api/auth";

interface OrgSwitcherProps {
  onOrgSelected: () => void;
  /** Guarantees AppState.auth is populated before switchOrg is called. */
  ensureSession: () => Promise<void>;
}

export function OrgSwitcher({
  onOrgSelected,
  ensureSession,
}: OrgSwitcherProps) {
  const { setActive, signOut } = useClerk();
  const { userMemberships, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [pending, setPending] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(orgId: string) {
    setPending(orgId);
    setError(null);
    try {
      // Guarantee AppState.auth is set before switch_org reads it.
      // Defends against the case where set_session failed during AuthGuard init.
      await ensureSession();

      // Tell Clerk which org is active
      await setActive({ organization: orgId });

      // Verify membership from AppState and open the org DB
      await switchOrg(orgId);

      onOrgSelected();
    } catch (err) {
      // extractTauriError handles Tauri's plain-string rejections correctly
      setError(extractTauriError(err));
      setPending(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout(); // clear keychain + reset Rust AppState
      await signOut(); // clear Clerk session
    } catch {
      setSigningOut(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-gray-400">Loading organizations…</p>
      </div>
    );
  }

  const memberships = userMemberships.data ?? [];

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-semibold text-white mb-2">
          Select Organization
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Choose a workspace to continue.
        </p>

        {memberships.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No organizations found. Create one at{" "}
            <span className="text-indigo-400">dashboard.clerk.com</span>.
          </p>
        ) : (
          <ul className="space-y-3">
            {memberships.map((mem) => (
              <li key={mem.organization.id}>
                <button
                  onClick={() => handleSelect(mem.organization.id)}
                  disabled={!!pending || signingOut}
                  className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">
                    {mem.organization.name}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {mem.role}
                    {pending === mem.organization.id && " — switching…"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2 break-words">
            {error}
          </p>
        )}

        {/* Sign out */}
        <div className="mt-6 pt-5 border-t border-gray-700">
          <button
            onClick={handleSignOut}
            disabled={!!pending || signingOut}
            className="w-full text-sm text-gray-400 hover:text-white disabled:opacity-50 transition-colors py-1"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
