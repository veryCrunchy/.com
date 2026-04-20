import { readStreetDeliveryGalleryByToken } from "~/server/utils/street-delivery";

function sanitizeFilename(value: string | null | undefined) {
  const cleaned = String(value || "")
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "street-delivery-photo";
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  const assetId = String(getRouterParam(event, "assetId") || "").trim();
  const config = useRuntimeConfig(event);
  const directusUrl = String(config.public.directusUrl || "").replace(/\/$/, "");

  if (!token || !assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing download parameters.",
    });
  }

  if (!directusUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Directus is not configured.",
    });
  }

  const gallery = await readStreetDeliveryGalleryByToken(event, token);

  if (!gallery) {
    throw createError({
      statusCode: 404,
      statusMessage: "Gallery not found.",
    });
  }

  const photo = gallery.photos.find((entry) => entry.image?.id === assetId);

  if (!photo?.image?.id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Photo asset not found in this gallery.",
    });
  }

  const upstream = await fetch(`${directusUrl}/assets/${encodeURIComponent(photo.image.id)}`, {
    headers: config.directusToken
      ? {
          Authorization: `Bearer ${config.directusToken}`,
        }
      : undefined,
  });

  if (!upstream.ok || !upstream.body) {
    throw createError({
      statusCode: upstream.status || 502,
      statusMessage: "Could not download the original asset.",
    });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  const filename = sanitizeFilename(photo.image.downloadFilename || `${photo.slug || photo.id}.jpg`);

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  headers.set("content-disposition", `attachment; filename="${filename}"`);
  headers.set("cache-control", "private, max-age=0, must-revalidate");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
});
