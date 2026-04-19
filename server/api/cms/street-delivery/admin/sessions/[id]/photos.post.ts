import { createError, readMultipartFormData } from "h3";

import { uploadStreetDeliveryAdminPhotos } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const parts = await readMultipartFormData(event);

  if (!parts) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing upload payload.",
    });
  }

  return {
    session: await uploadStreetDeliveryAdminPhotos(event, id, {
      files: parts
        .filter((entry) => entry.filename && entry.data?.length)
        .map((entry) => ({
          filename: entry.filename,
          type: entry.type,
          data: entry.data,
        })),
    }),
  };
});
