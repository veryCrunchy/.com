import { readDirectusPhotosetBySlug } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const photoset = await readDirectusPhotosetBySlug(event, slug);

  if (!photoset) {
    throw createError({ statusCode: 404, statusMessage: "Photoset not found" });
  }

  return { photoset };
});
