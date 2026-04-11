import { readDirectusPhotoBySlug } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing photo slug.",
    });
  }

  const photo = await readDirectusPhotoBySlug(event, slug);

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: "Photo not found.",
    });
  }

  return {
    photo,
  };
});
