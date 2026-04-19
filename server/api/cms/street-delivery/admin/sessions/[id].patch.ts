import { updateStreetDeliveryAdminSession } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const body = await readBody<{
    status?: string | null;
    photographedAt?: string | null;
    location?: string | null;
    publicEnabled?: boolean;
    printedAt?: string | null;
    regenerateGalleryToken?: boolean;
  }>(event);

  return {
    session: await updateStreetDeliveryAdminSession(event, id, body || {}),
  };
});
