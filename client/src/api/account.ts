import { getClientId } from "@/lib/clientId";
import type { PantryData } from "./backend/types";
import type { Preferences } from "./types";

export interface AccountProfile {
  user: { id: string; email: string; preferences: Preferences };
  pantry: PantryData;
}

export class AccountApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AccountApiError";
  }
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Client-Id": getClientId() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AccountApiError(0, "Can't reach the server. Is the backend running?");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      message = (await response.json()).error ?? message;
    } catch {
      // Keep the status-based message for non-JSON responses.
    }
    throw new AccountApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export const getAccountProfile = () => request<AccountProfile>("/auth/me");
export const registerAccount = (body: { email: string; password: string; preferences: Preferences; pantry: PantryData }) =>
  request<AccountProfile>("/auth/register", "POST", body);
export const loginAccount = (body: { email: string; password: string }) => request<AccountProfile>("/auth/login", "POST", body);
export const logoutAccount = () => request<{ ok: boolean }>("/auth/logout", "POST", {});
export const saveAccountPreferences = (preferences: Preferences) =>
  request<{ preferences: Preferences }>("/account/preferences", "PUT", { preferences });
