export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string;
    password?: string;
  }>(event);

  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  const directusUrl = useRuntimeConfig(event).public.directusUrl;

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email and password are required.",
    });
  }

  if (!directusUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Directus is not configured.",
    });
  }

  const response = await fetch(`${directusUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
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
        payload?.errors?.[0]?.message || "Directus login failed.",
    });
  }

  return {
    accessToken: payload.data.access_token,
    expires: payload.data.expires ?? null,
  };
});
