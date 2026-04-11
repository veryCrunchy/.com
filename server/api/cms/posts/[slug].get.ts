import { readDirectusPostBySlug } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing post slug.",
    });
  }

  const post = await readDirectusPostBySlug(event, slug);

  if (!post) {
    throw createError({
      statusCode: 404,
      statusMessage: "Post not found.",
    });
  }

  return {
    post,
  };
});
