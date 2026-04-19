import { deleteStreetDeliveryAdminSessionPhotoLink } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));

  return {
    session: await deleteStreetDeliveryAdminSessionPhotoLink(event, id),
  };
});
