import {
  readDirectusPhotos,
  readDirectusPosts,
  readDirectusSiteSettings,
  readDirectusProjects,
} from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const [site, recentPosts, recentPhotos, projects] = await Promise.all([
    readDirectusSiteSettings(event),
    readDirectusPosts(event, { limit: 3 }),
    readDirectusPhotos(event, { limit: 6 }),
    readDirectusProjects(event),
  ]);

  return {
    site,
    recentPosts,
    recentPhotos,
    projects,
  };
});
