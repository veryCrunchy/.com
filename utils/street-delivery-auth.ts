export const STREET_DELIVERY_AUTH_STORAGE_KEY = "street-delivery-directus-token";

export type StreetDeliveryStoredAuth = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

function normalizeExpiresAt(expires: number | null | undefined) {
  if (!Number.isFinite(expires) || !expires || expires <= 0) {
    return null;
  }

  return Date.now() + Number(expires);
}

export function createStreetDeliveryStoredAuth(input: {
  accessToken: string;
  refreshToken?: string | null;
  expires?: number | null;
}): StreetDeliveryStoredAuth {
  return {
    accessToken: String(input.accessToken || "").trim(),
    refreshToken: input.refreshToken ? String(input.refreshToken).trim() : null,
    expiresAt: normalizeExpiresAt(input.expires ?? null),
  };
}

export function parseStreetDeliveryStoredAuth(rawValue: string | null | undefined): StreetDeliveryStoredAuth | null {
  const raw = String(rawValue || "").trim();

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StreetDeliveryStoredAuth>;

    if (parsed && typeof parsed.accessToken === "string" && parsed.accessToken.trim()) {
      return {
        accessToken: parsed.accessToken.trim(),
        refreshToken: parsed.refreshToken ? String(parsed.refreshToken).trim() : null,
        expiresAt: Number.isFinite(parsed.expiresAt) ? Number(parsed.expiresAt) : null,
      };
    }
  } catch {
    // Older installs stored only the raw access token.
  }

  return {
    accessToken: raw,
    refreshToken: null,
    expiresAt: null,
  };
}

export function serializeStreetDeliveryStoredAuth(value: StreetDeliveryStoredAuth) {
  return JSON.stringify(value);
}

export function shouldRefreshStreetDeliveryAuth(value: StreetDeliveryStoredAuth | null, skewMs = 60_000) {
  if (!value?.accessToken || !value.refreshToken || !value.expiresAt) {
    return false;
  }

  return Date.now() >= value.expiresAt - skewMs;
}
