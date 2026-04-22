export const DEVICE_ID_KEY = "phalga_device_id";
export const TABLET_ID_KEY = "phalga_tablet_id";

function uuidv4Fallback() {
  // Prefer randomUUID if available.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: RFC4122-ish v4 using getRandomValues (available in modern browsers, incl. older Android Chrome).
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (10)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20
    )}-${hex.slice(20)}`;
  }

  // Last resort (not cryptographically strong, but enables pairing flow):
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {
    // localStorage may be blocked; proceed with ephemeral id
  }

  const id = uuidv4Fallback();
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // ignore; ephemeral session will still be able to pair once
  }
  return id;
}

export function setBoundTabletId(tabletId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TABLET_ID_KEY, String(tabletId));
}

export function getBoundTabletId() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TABLET_ID_KEY);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function clearBoundTabletId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TABLET_ID_KEY);
}

