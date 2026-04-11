import { readDirectusPhotosets } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const photosets = await readDirectusPhotosets(event);
  return { photosets };
});
