import { readDirectusTimelines } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  const timelines = await readDirectusTimelines(event);
  return { timelines };
});
