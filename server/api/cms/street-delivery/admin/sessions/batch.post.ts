import { createStreetDeliveryAdminBatch } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    count?: number;
    prefix?: string | null;
  }>(event);

  return {
    sessions: await createStreetDeliveryAdminBatch(event, body || {}),
  };
});
