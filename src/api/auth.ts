import { invoke } from "@tauri-apps/api/core";
import type { OrgMembership, AuthState } from "../types/auth";

// Tauri v2 maps camelCase JS keys → snake_case Rust params automatically.

export const setSession = (jwt: string, email: string, orgs: OrgMembership[]) =>
  invoke<AuthState>("set_session", { jwt, email, orgs });

export const switchOrg = (orgId: string) =>
  invoke<void>("switch_org", { orgId });

export const getAuthState = () => invoke<AuthState | null>("get_auth_state");

export const getCachedSession = () =>
  invoke<string | null>("get_cached_session");

export const logout = () => invoke<void>("logout");

/**
 * Extracts a human-readable string from a Tauri invoke() rejection.
 *
 * AppError is serialized as a plain string in Rust (see error.rs).
 * Tauri therefore rejects the Promise with a string, not an Error object,
 * so `instanceof Error` checks always fail. This helper covers all shapes.
 */
export function extractTauriError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return "An unexpected error occurred";
}
