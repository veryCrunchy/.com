export default defineEventHandler(async (event) => {
  const body = await readBody<{
    refreshToken?: string;
  }>(event);

  const refreshToken = String(body?.refreshToken || "").trim();
  const directusUrl = useRuntimeConfig(event).public.directusUrl;

  if (!refreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: "Refresh token is required.",
    });
  }

  if (!directusUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Directus is not configured.",
    });
  }

  const response = await fetch(`${directusUrl.replace(/\/$/, "")}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      mode: "json",
    }),
  });
  const payload = await response.json().catch(() => null) as {
    data?: {
      access_token?: string;
      expires?: number;
      refresh_token?: string;
    };
    errors?: Array<{ message?: string }>;
  } | null;

  if (!response.ok || !payload?.data?.access_token) {
    throw createError({
      statusCode: response.status === 401 || response.status === 403 ? 401 : 500,
      statusMessage:
        payload?.errors?.[0]?.message || "Directus token refresh failed.",
    });
  }

  return {
    accessToken: payload.data.access_token,
    refreshToken: payload.data.refresh_token ?? refreshToken,
    expires: payload.data.expires ?? null,
  };
});
