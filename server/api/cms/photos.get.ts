import { readDirectusPhotos } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const photos = await readDirectusPhotos(event);

  return {
    photos,
  };
});
