import { readStreetDeliveryGalleryByToken } from "~/server/utils/street-delivery";

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  CRC_TABLE[index] = value >>> 0;
}

function sanitizeFilename(value: string | null | undefined) {
  const cleaned = String(value || "")
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "street-delivery-photo";
}

function uniqueFilename(filename: string, used: Set<string>) {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }

  const extensionIndex = filename.lastIndexOf(".");
  const basename = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : "";
  let counter = 2;

  while (used.has(`${basename}-${counter}${extension}`)) {
    counter += 1;
  }

  const nextFilename = `${basename}-${counter}${extension}`;
  used.add(nextFilename);
  return nextFilename;
}

function crc32(buffer: Buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosDate, dosTime };
}

function uint16(value: number) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function uint32(value: number) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function buildZip(files: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const { dosDate, dosTime } = dosDateTime();
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data);
    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(dosTime),
      uint16(dosDate),
      uint32(checksum),
      uint32(file.data.length),
      uint32(file.data.length),
      uint16(name.length),
      uint16(0),
      name,
    ]);

    localParts.push(localHeader, file.data);
    centralParts.push(Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(dosTime),
      uint16(dosDate),
      uint32(checksum),
      uint32(file.data.length),
      uint32(file.data.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name,
    ]));

    offset += localHeader.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  const config = useRuntimeConfig(event);
  const directusUrl = String(config.public.directusUrl || "").replace(/\/$/, "");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing gallery token.",
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

  const usedFilenames = new Set<string>();
  const downloadableEntries = gallery.photos
    .filter((entry) => entry.photo.image?.id)
    .map((entry) => ({
      assetId: entry.photo.image?.id as string,
      filename: uniqueFilename(
        sanitizeFilename(entry.photo.image?.downloadFilename || `${entry.photo.slug || entry.photo.id}.jpg`),
        usedFilenames
      ),
    }));

  const files = await Promise.all(
    downloadableEntries.map(async (entry) => {
      const upstream = await fetch(`${directusUrl}/assets/${encodeURIComponent(entry.assetId)}`, {
        headers: config.directusToken
          ? {
              Authorization: `Bearer ${config.directusToken}`,
            }
          : undefined,
      });

      if (!upstream.ok) {
        throw createError({
          statusCode: upstream.status || 502,
          statusMessage: "Could not download one of the original assets.",
        });
      }

      return {
        name: entry.filename,
        data: Buffer.from(await upstream.arrayBuffer()),
      };
    })
  );

  if (!files.length) {
    throw createError({
      statusCode: 404,
      statusMessage: "No downloadable photos found in this gallery.",
    });
  }

  const zip = buildZip(files);
  const filename = sanitizeFilename(`${gallery.session.code || "street-gallery"}-photos.zip`);

  setHeader(event, "content-type", "application/zip");
  setHeader(event, "content-length", String(zip.length));
  setHeader(event, "content-disposition", `attachment; filename="${filename}"`);
  setHeader(event, "cache-control", "private, max-age=0, must-revalidate");

  return zip;
});
