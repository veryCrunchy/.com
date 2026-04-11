import { readDirectusPosts } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const posts = await readDirectusPosts(event);

  return {
    posts,
  };
});
