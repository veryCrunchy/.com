/**
 * Block the photo ingest studio API and page in non-development environments.
 * These routes exist only for local admin use and must never be reachable in production.
 */
export default defineEventHandler((event) => {
  if (process.env.NODE_ENV === "development") return;

  const path = event.path || "";
  if (path.startsWith("/api/cms/photo-ingest")) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }
});
