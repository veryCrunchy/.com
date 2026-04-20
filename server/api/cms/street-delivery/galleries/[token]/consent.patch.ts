import { updateStreetDeliveryGalleryPhotoConsent } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing gallery token.",
    });
  }

  const body = await readBody<{
    linkId?: number;
    consentPublish?: boolean;
  }>(event);

  return await updateStreetDeliveryGalleryPhotoConsent(event, token, {
    linkId: Number(body?.linkId),
    consentPublish: Boolean(body?.consentPublish),
  });
});
