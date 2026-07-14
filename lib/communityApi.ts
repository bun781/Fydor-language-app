import { fydorWebUrl } from "@/lib/webOrigin";

export interface CommunitySession { email: string; accessToken: string }
export interface CommunityPrivileges {
  roles: string[];
  canModerate: boolean;
  canAdmin: boolean;
}
interface ClientConfig { supabaseUrl: string; supabaseAnonKey: string }
type ApiErrorBody = {
  error?: string | { message?: string };
  error_description?: string;
  message?: string;
  msg?: string;
};

let configPromise: Promise<ClientConfig> | undefined;

async function config(): Promise<ClientConfig> {
  configPromise ??= request<ClientConfig>(fydorWebUrl("/api/client-config"));
  return configPromise;
}

export async function signInCommunity(email: string, password: string): Promise<CommunitySession> {
  const client = await config();
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${client.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: client.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, password })
  });
  const data = await response.json().catch(() => null) as ({ access_token?: string; user?: { email?: string } } & ApiErrorBody) | null;
  if (!response.ok || !data?.access_token) throw new Error(apiErrorMessage(data, "Unable to sign in."));
  return { accessToken: data.access_token, email: data.user?.email || normalizedEmail };
}

export async function signUpCommunity(email: string, password: string, username: string): Promise<CommunitySession> {
  const client = await config();
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const response = await fetch(`${client.supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: client.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, password, data: { username: normalizedUsername } })
  });
  const data = await response.json().catch(() => null) as ({ access_token?: string; user?: { email?: string } } & ApiErrorBody) | null;
  if (!response.ok) throw new Error(apiErrorMessage(data, "Unable to create the account."));
  if (!data?.access_token) throw new Error("Account created, but Supabase did not return a session. Disable email confirmation for this project, then sign in.");
  return { accessToken: data.access_token, email: data.user?.email || normalizedEmail };
}

export async function communityApi<T>(session: CommunitySession, path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(fydorWebUrl(path), {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, ...(init.headers ?? {}) }
  });
}

export async function getCommunityPrivileges(session: CommunitySession): Promise<CommunityPrivileges> {
  try {
    const result = await communityApi<{ roles?: string[] }>(session, "/api/admin?action=me");
    const roles = Array.isArray(result.roles) ? result.roles.filter((role): role is string => typeof role === "string") : [];
    return {
      roles,
      canModerate: roles.some((role) => role === "moderator" || role === "admin" || role === "super_admin"),
      canAdmin: roles.some((role) => role === "admin" || role === "super_admin")
    };
  } catch {
    try {
      await communityApi(session, "/api/moderation?action=queue&status=submitted&limit=1");
      return { roles: ["moderator"], canModerate: true, canAdmin: false };
    } catch {
      return { roles: [], canModerate: false, canAdmin: false };
    }
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch (error) {
    if (isFetchNetworkError(error)) {
      throw new Error("Unable to reach the Fydor community service. Check your connection and make sure the configured Fydor website allows desktop app requests.");
    }
    throw error;
  }
  const data = await response.json().catch(() => null) as T | ApiErrorBody | null;
  if (!response.ok) throw new Error(apiErrorMessage(data as ApiErrorBody | null, `Request failed (${response.status}).`));
  return data as T;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim();
  if (!normalized) throw new Error("Email is required.");
  return normalized;
}

function normalizeUsername(username: string): string {
  const normalized = username.trim();
  if (!normalized) throw new Error("Username is required to create an account.");
  return normalized;
}

function apiErrorMessage(data: ApiErrorBody | null, fallback: string): string {
  if (typeof data?.error === "string" && data.error) return data.error;
  const nestedMessage = typeof data?.error === "object" ? data.error.message : undefined;
  return data?.error_description || data?.message || nestedMessage || data?.msg || fallback;
}

export function communityActionId(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }

function isFetchNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|load failed|networkerror|network request failed/i.test(error.message);
}
