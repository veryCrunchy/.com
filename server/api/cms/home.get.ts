import {
  readDirectusPhotos,
  readDirectusPosts,
  readDirectusSiteSettings,
  readDirectusProjects,
  readDirectusChapters,
} from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const [site, recentPosts, recentPhotos, projects, chapters] = await Promise.all([
    readDirectusSiteSettings(event),
    readDirectusPosts(event, { limit: 3 }),
    readDirectusPhotos(event, { limit: 6 }),
    readDirectusProjects(event),
    readDirectusChapters(event),
  ]);

  return {
    site,
    recentPosts,
    recentPhotos,
    projects,
    chapters,
  };
});
