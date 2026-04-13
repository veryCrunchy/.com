import { readDirectusTimelineBySlug } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const timeline = await readDirectusTimelineBySlug(event, slug);

  if (!timeline) {
    throw createError({ statusCode: 404, statusMessage: "Timeline not found" });
  }

  return { timeline };
});
