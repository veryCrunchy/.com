import { deleteStreetDeliveryAdminSession } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));

  return await deleteStreetDeliveryAdminSession(event, id);
});
