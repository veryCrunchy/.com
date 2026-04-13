import { prepareStudioManifest } from "~/server/utils/photo-ingest-studio";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ paths?: string[]; pathsText?: string }>(event);
  const paths = Array.isArray(body?.paths)
    ? body.paths
    : String(body?.pathsText || "")
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);

  return await prepareStudioManifest(paths);
});
