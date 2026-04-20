import { readDirectusPhotosets } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  const photosets = await readDirectusPhotosets(event);
  return { photosets };
});
