import { readStreetDeliverySessionByCode } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing session code.",
    });
  }

  const session = await readStreetDeliverySessionByCode(event, code);

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Session not found.",
    });
  }

  return {
    session,
  };
});
