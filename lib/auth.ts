const encoder = new TextEncoder();

export const AUTH_COOKIE_NAME = "pet-shop-auth";
export const AUTH_PASSWORD_ENV = "APP_ACCESS_PASSWORD";
export const AUTH_SECRET_ENV = "APP_ACCESS_SECRET";

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getConfiguredPassword() {
  return process.env[AUTH_PASSWORD_ENV]?.trim() || null;
}

export function getAuthSecret() {
  return process.env[AUTH_SECRET_ENV]?.trim() || "pet-shop-access-secret";
}

export function isAuthConfigured() {
  return Boolean(getConfiguredPassword());
}

export async function buildSessionToken() {
  const password = getConfiguredPassword();

  if (!password) {
    return null;
  }

  const payload = `${password}:${getAuthSecret()}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  return bytesToHex(new Uint8Array(digest));
}

export async function isAuthenticated(sessionCookie: string | undefined) {
  const expectedToken = await buildSessionToken();

  if (!expectedToken || !sessionCookie) {
    return false;
  }

  return sessionCookie === expectedToken;
}

export async function validatePassword(password: string) {
  const configuredPassword = getConfiguredPassword();

  if (!configuredPassword) {
    return false;
  }

  return password === configuredPassword;
}
