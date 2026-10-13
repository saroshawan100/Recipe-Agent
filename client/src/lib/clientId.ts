const KEY = "pantry-chef-client-id";

let cached: string | null = null;

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getClientId(): string {
  if (cached) return cached;
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = makeId();
    localStorage.setItem(KEY, id);
  }
  cached = id;
  return id;
}
