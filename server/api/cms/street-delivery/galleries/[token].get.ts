import { readStreetDeliveryGalleryByToken } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing gallery token.",
    });
  }

  const gallery = await readStreetDeliveryGalleryByToken(event, token);

  if (!gallery) {
    throw createError({
      statusCode: 404,
      statusMessage: "Gallery not found.",
    });
  }

  return gallery;
});
