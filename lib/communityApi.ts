import { fydorWebUrl } from "@/lib/webOrigin";

export interface CommunitySession { email: string; accessToken: string }
interface ClientConfig { supabaseUrl: string; supabaseAnonKey: string }

let configPromise: Promise<ClientConfig> | undefined;

async function config(): Promise<ClientConfig> {
  configPromise ??= request<ClientConfig>(fydorWebUrl("/api/client-config"));
  return configPromise;
}

export async function signInCommunity(email: string, password: string): Promise<CommunitySession> {
  const client = await config();
  const response = await fetch(`${client.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: client.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => null) as { access_token?: string; user?: { email?: string }; msg?: string; error_description?: string } | null;
  if (!response.ok || !data?.access_token) throw new Error(data?.error_description || data?.msg || "Unable to sign in.");
  return { accessToken: data.access_token, email: data.user?.email || email };
}

export async function signUpCommunity(email: string, password: string): Promise<void> {
  const client = await config();
  const response = await fetch(`${client.supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: client.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error("Unable to create the account.");
}

export async function communityApi<T>(session: CommunitySession, path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(fydorWebUrl(path), {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, ...(init.headers ?? {}) }
  });
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => null) as T | { error?: { message?: string }; msg?: string } | null;
  if (!response.ok) throw new Error((data as { error?: { message?: string }; msg?: string } | null)?.error?.message || (data as { msg?: string } | null)?.msg || `Request failed (${response.status}).`);
  return data as T;
}

export function communityActionId(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }
