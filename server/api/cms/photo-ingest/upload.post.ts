import { applyManifestFormEdits, uploadStudioManifest } from "~/server/utils/photo-ingest-studio";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ manifest?: Record<string, unknown> }>(event);

  if (!body?.manifest) {
    throw createError({ statusCode: 400, statusMessage: "Missing manifest payload." });
  }

  const manifest = applyManifestFormEdits(body.manifest);
  return await uploadStudioManifest(manifest);
});
