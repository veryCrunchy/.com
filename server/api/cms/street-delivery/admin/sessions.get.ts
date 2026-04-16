import { readStreetDeliveryAdminSessions } from "~/server/utils/street-delivery";

export default defineEventHandler(async (event) => {
  return {
    sessions: await readStreetDeliveryAdminSessions(event),
  };
});
