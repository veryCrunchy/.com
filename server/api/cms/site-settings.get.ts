import { readDirectusSiteSettings } from "~/server/utils/directus";

export default defineEventHandler(async (event) => {
  return {
    site: await readDirectusSiteSettings(event),
  };
});
