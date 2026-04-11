import {
  readDirectusPhotos,
  readDirectusPosts,
  readDirectusSiteSettings,
} from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const [site, recentPosts, recentPhotos] = await Promise.all([
    readDirectusSiteSettings(event),
    readDirectusPosts(event, { limit: 3 }),
    readDirectusPhotos(event, { limit: 6 }),
  ]);

  return {
    site,
    recentPosts,
    recentPhotos,
  };
});
