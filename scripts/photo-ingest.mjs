#!/usr/bin/env node
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, extname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dir, "../.env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*?)["']?$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

loadEnv();

const BASE = process.env.NUXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, "") || "";
const TOKEN = process.env.DIRECTUS_TOKEN || "";
const ORIGINAL_METADATA_ROOTS = (
  process.env.PHOTO_INGEST_ORIGINAL_ROOTS || "/mnt/h/DCIM"
)
  .split(",")
  .map((value) => resolve(value.trim()))
  .filter((value, index, values) => value && values.indexOf(value) === index && existsSync(value));
const EXIFTOOL_METADATA_TAGS = [
  "-DateTimeOriginal",
  "-CreateDate",
  "-OffsetTimeOriginal",
  "-Make",
  "-Model",
  "-LensModel",
  "-FocalLength",
  "-FNumber",
  "-ExposureTime",
  "-ISO",
  "-ImageWidth",
  "-ImageHeight",
  "-MIMEType",
  "-GPSLatitude",
  "-GPSLongitude",
  "-GPSLatitudeRef",
  "-GPSLongitudeRef",
  "-City",
  "-Sub-location",
  "-Country-PrimaryLocationName",
  "-State",
  "-Province-State",
  "-Location",
  "-Country",
  "-Keywords",
];
const LOCATION_METADATA_COPY_TAGS = [
  "-GPSLatitude",
  "-GPSLongitude",
  "-GPSLatitudeRef",
  "-GPSLongitudeRef",
  "-City",
  "-Sub-location",
  "-Country-PrimaryLocationName",
  "-State",
  "-Province-State",
  "-Location",
  "-Country",
  "-Keywords",
];
const REVERSE_GEOCODE_URL =
  process.env.PHOTO_INGEST_REVERSE_GEOCODE_URL ||
  "https://nominatim.openstreetmap.org/reverse";
const REVERSE_GEOCODE_CACHE_PATH = resolve(
  process.env.PHOTO_INGEST_REVERSE_GEOCODE_CACHE ||
    join(tmpdir(), "photo-ingest-reverse-geocode-cache.json")
);
const REVERSE_GEOCODE_USER_AGENT =
  process.env.PHOTO_INGEST_REVERSE_GEOCODE_USER_AGENT ||
  "veryCrunchy-photo-ingest/1.0 (+https://github.com/veryCrunchy/.com)";
const REVERSE_GEOCODE_ENABLED = process.env.PHOTO_INGEST_REVERSE_GEOCODE !== "0";
let reverseGeocodeLastRequestAt = 0;

function printHelp() {
  console.log(`
photo-ingest

Usage:
  node scripts/photo-ingest.mjs prepare --manifest ./photo-manifest.json <paths...>
  node scripts/photo-ingest.mjs prepare --manifest ./photo-manifest.json --paths-file ./photos.txt
  node scripts/photo-ingest.mjs validate --manifest ./photo-manifest.json
  node scripts/photo-ingest.mjs upload --manifest ./photo-manifest.json [--dry-run]

Commands:
  prepare   Inspect photo files, extract EXIF metadata, and create a manifest.
  validate  Check that the manifest is complete enough to upload.
  upload    Upload files to Directus, upsert photos/photosets, and link set membership.

Options:
  --manifest <path>          Path to the JSON manifest file.
  --paths-file <path>        Text file with one photo path per line.
  --set-gap-minutes <n>      Gap threshold for auto set candidates. Default: 90.
  --default-status <value>   Default item status. Default: published.
  --dry-run                  Validate and print actions without writing to Directus.
  --help                     Show this help text.
`);
}

function parseArgs(argv) {
  const command = argv[0];
  const options = {};
  const positionals = [];

  for (let index = 1; index < argv.length; index += 1) {
    const part = argv[index];

    if (!part.startsWith("--")) {
      positionals.push(part);
      continue;
    }

    const name = part.slice(2);

    if (name === "dry-run" || name === "help") {
      options[name] = true;
      continue;
    }

    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }

    options[name] = value;
    index += 1;
  }

  return { command, options, positionals };
}

function ensureCommand(command) {
  if (!command || command === "--help" || command === "help") {
    printHelp();
    process.exit(0);
  }

  if (!["prepare", "validate", "upload"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
}

function ensureManifestPath(pathValue) {
  if (!pathValue) {
    throw new Error("Missing --manifest <path>");
  }

  return resolve(pathValue);
}

function readPathsFile(pathValue) {
  const absolutePath = resolve(pathValue);

  if (!existsSync(absolutePath)) {
    throw new Error(`Paths file not found: ${absolutePath}`);
  }

  return readFileSync(absolutePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function readJsonIfExists(pathValue, fallbackValue) {
  if (!existsSync(pathValue)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(readFileSync(pathValue, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function uniquePaths(paths) {
  return [...new Set(paths.map((value) => resolve(value)))];
}

function ensurePhotoPaths(paths) {
  if (!paths.length) {
    throw new Error("No photo paths were provided.");
  }

  return paths.map((pathValue) => {
    if (!existsSync(pathValue)) {
      throw new Error(`Photo not found: ${pathValue}`);
    }

    const stats = statSync(pathValue);

    if (!stats.isFile()) {
      throw new Error(`Not a file: ${pathValue}`);
    }

    return pathValue;
  });
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleCaseFromSlug(input) {
  return String(input || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stemFromPath(pathValue) {
  const extension = extname(pathValue);
  const filename = pathValue.split("/").pop() || pathValue;
  return extension ? filename.slice(0, -extension.length) : filename;
}

function hashFile(pathValue) {
  const buffer = readFileSync(pathValue);
  return createHash("sha1").update(buffer).digest("hex");
}

function isTiffPath(pathValue) {
  return [".tif", ".tiff"].includes(extname(pathValue).toLowerCase());
}

function pathBasename(pathValue) {
  return pathValue.split("/").pop() || pathValue;
}

function normalizeStemCandidate(value) {
  return String(value || "")
    .replace(/\.+$/, "")
    .replace(/[^A-Za-z0-9-]+$/g, "")
    .trim();
}

function buildMetadataStemCandidates(pathValue) {
  const rawStem = stemFromPath(pathValue);
  const normalizedStem = normalizeStemCandidate(rawStem);
  const baseStem = normalizedStem.replace(/-\d+$/, "");

  return [rawStem, normalizedStem, baseStem]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function metadataMatchScore(filePath, stemCandidates) {
  const basename = pathBasename(filePath);
  const lowerBasename = basename.toLowerCase();
  const stemIndex = stemCandidates.findIndex((stem) =>
    lowerBasename.startsWith(String(stem).toLowerCase())
  );
  const extensionPriority = lowerBasename.endsWith(".raf.xmp")
    ? 0
    : lowerBasename.endsWith(".xmp")
      ? 1
      : lowerBasename.endsWith(".raf")
        ? 2
        : lowerBasename.endsWith(".jpg") || lowerBasename.endsWith(".jpeg")
          ? 3
          : 4;

  return {
    stemIndex: stemIndex === -1 ? stemCandidates.length + 1 : stemIndex,
    extensionPriority,
    basename,
  };
}

function findOriginalMetadataFiles(pathValue) {
  const stemCandidates = buildMetadataStemCandidates(pathValue);
  const foundPaths = [];

  if (!stemCandidates.length || !ORIGINAL_METADATA_ROOTS.length) {
    return foundPaths;
  }

  for (const rootPath of ORIGINAL_METADATA_ROOTS) {
    const findArgs = [rootPath, "-type", "f", "("];

    stemCandidates.forEach((stem, index) => {
      if (index > 0) {
        findArgs.push("-o");
      }

      findArgs.push("-iname", `${stem}.raf`);
      findArgs.push("-o", "-iname", `${stem}.raf.xmp`);
      findArgs.push("-o", "-iname", `${stem}.xmp`);
      findArgs.push("-o", "-iname", `${stem}.jpg`);
      findArgs.push("-o", "-iname", `${stem}.jpeg`);
    });

    findArgs.push(")");

    const result = spawnSync("find", findArgs, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 2,
    });

    if (result.status !== 0) {
      continue;
    }

    for (const line of result.stdout.split("\n")) {
      const candidatePath = resolve(line.trim());

      if (!candidatePath || foundPaths.includes(candidatePath)) {
        continue;
      }

      foundPaths.push(candidatePath);
    }
  }

  return foundPaths.sort((left, right) => {
    const leftScore = metadataMatchScore(left, stemCandidates);
    const rightScore = metadataMatchScore(right, stemCandidates);

    return (
      leftScore.stemIndex - rightScore.stemIndex ||
      leftScore.extensionPriority - rightScore.extensionPriority ||
      leftScore.basename.localeCompare(rightScore.basename)
    );
  });
}

function runExiftool(paths) {
  const result = spawnSync(
    "exiftool",
    [
      "-json",
      "-n",
      ...EXIFTOOL_METADATA_TAGS,
      ...paths,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Exiftool failed");
  }

  const rows = JSON.parse(result.stdout);
  const map = new Map();

  for (const row of rows) {
    map.set(resolve(row.SourceFile), row);
  }

  return map;
}

function readMergedMetadata(sourcePath, exifMap) {
  const primaryMetadata = { ...(exifMap.get(sourcePath) || {}) };
  const fallbackPaths = findOriginalMetadataFiles(sourcePath);

  if (!fallbackPaths.length) {
    return primaryMetadata;
  }

  const fallbackMap = runExiftool(fallbackPaths);

  for (const fallbackPath of fallbackPaths) {
    const fallbackMetadata = fallbackMap.get(fallbackPath) || {};

    for (const [key, value] of Object.entries(fallbackMetadata)) {
      if (primaryMetadata[key] === undefined || primaryMetadata[key] === null || primaryMetadata[key] === "") {
        primaryMetadata[key] = value;
      }
    }
  }

  return primaryMetadata;
}

function normalizeExifTimestamp(value, offset) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }

  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, fraction] = match;
  const decimals = fraction ? `.${fraction.slice(0, 3)}` : "";
  const suffix = offset || "";

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${decimals}${suffix}`;
}

function buildCameraLabel(metadata) {
  const make = String(metadata.Make || "").trim();
  const model = String(metadata.Model || "").trim();

  if (make && model) {
    if (model.toLowerCase().startsWith(make.toLowerCase())) {
      return model;
    }

    return `${make} ${model}`.trim();
  }

  return make || model || null;
}

function buildLocationHint(metadata) {
  const parts = [
    metadata.Location,
    metadata["Sub-location"],
    metadata.City,
    metadata["Province-State"],
    metadata.State,
    metadata.Country,
    metadata["Country-PrimaryLocationName"],
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function createLocationMeta(title, address = {}, gps = null) {
  if (!title) {
    return null;
  }

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.city_district ||
    null;
  const region = address.state || address.county || address.region || null;
  const country = address.country || null;

  return {
    slug: slugify(title),
    title,
    city,
    region,
    country,
    latitude: gps?.latitude ?? null,
    longitude: gps?.longitude ?? null,
    description: null,
  };
}

function buildReverseGeocodeLabel(address = {}) {
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    null;
  const region = address.state || address.county || null;
  const country = address.country || null;
  const parts = [locality, region, country].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function buildReverseGeocodeCacheKey(gps) {
  return `${Number(gps.latitude).toFixed(5)},${Number(gps.longitude).toFixed(5)}`;
}

async function waitForReverseGeocodeSlot() {
  const minDelayMs = 1100;
  const now = Date.now();
  const waitMs = Math.max(0, reverseGeocodeLastRequestAt + minDelayMs - now);

  if (waitMs > 0) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));
  }

  reverseGeocodeLastRequestAt = Date.now();
}

async function reverseGeocodeCoordinates(gps, cache) {
  if (!REVERSE_GEOCODE_ENABLED || !gps) {
    return null;
  }

  const cacheKey = buildReverseGeocodeCacheKey(gps);

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  await waitForReverseGeocodeSlot();

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(gps.latitude),
    lon: String(gps.longitude),
    zoom: "18",
    addressdetails: "1",
  });
  const response = await fetch(`${REVERSE_GEOCODE_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": REVERSE_GEOCODE_USER_AGENT,
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocode failed (${response.status})`);
  }

  const payload = await response.json();
  const address = payload?.address || {};
  const title = buildReverseGeocodeLabel(address);
  const result = title
    ? {
        location: title,
        locationMeta: createLocationMeta(title, address, gps),
      }
    : null;

  cache[cacheKey] = result;
  return result;
}

function sortTimestamp(photo) {
  return photo.takenAt || photo.sourceMetadata.fileModifiedAt;
}

function assignAutoSetCandidates(photos, gapMinutes) {
  const sorted = [...photos].sort((left, right) => {
    return String(sortTimestamp(left)).localeCompare(String(sortTimestamp(right)));
  });

  const groups = [];
  let currentGroup = null;
  let currentIndex = 0;
  let lastDateKey = null;
  const gapMs = Math.max(1, Number(gapMinutes || 90)) * 60 * 1000;

  for (const photo of sorted) {
    const timestamp = sortTimestamp(photo);
    const dateKey = String(timestamp || "").slice(0, 10) || "undated";
    const timeMs = timestamp ? Date.parse(timestamp) : Number.NaN;

    const shouldStartNewGroup =
      !currentGroup ||
      currentGroup.dateKey !== dateKey ||
      Number.isNaN(timeMs) ||
      Number.isNaN(currentGroup.lastTimeMs) ||
      timeMs - currentGroup.lastTimeMs > gapMs;

    if (shouldStartNewGroup) {
      if (lastDateKey !== dateKey) {
        currentIndex = 0;
        lastDateKey = dateKey;
      }

      currentIndex += 1;
      currentGroup = {
        key: `${dateKey}-${String(currentIndex).padStart(2, "0")}`,
        dateKey,
        photos: [],
        lastTimeMs: timeMs,
      };
      groups.push(currentGroup);
    }

    currentGroup.photos.push(photo);
    currentGroup.lastTimeMs = timeMs;
  }

  const candidates = groups.map((group) => {
    const first = group.photos[0];
    const last = group.photos[group.photos.length - 1];
    const reason =
      group.photos.length === 1
        ? "Single photo captured in its own time window."
        : `Captured close together on ${group.dateKey}.`;

    return {
      slug: slugify(group.key),
      reason,
      memberCount: group.photos.length,
      firstTakenAt: first?.takenAt || first?.sourceMetadata.fileModifiedAt || null,
      lastTakenAt: last?.takenAt || last?.sourceMetadata.fileModifiedAt || null,
      photoSourcePaths: group.photos.map((photo) => photo.sourcePath),
    };
  });

  const candidateByPath = new Map();

  for (const candidate of candidates) {
    for (const sourcePath of candidate.photoSourcePaths) {
      candidateByPath.set(sourcePath, {
        slug: candidate.slug,
        reason: candidate.reason,
        memberCount: candidate.memberCount,
      });
    }
  }

  for (const photo of photos) {
    photo.sourceMetadata.autoSetCandidate = candidateByPath.get(photo.sourcePath) || null;
  }

  return candidates;
}

async function prepareManifest(paths, options) {
  const exifMap = runExiftool(paths);
  const defaultStatus = options["default-status"] || "published";
  const reverseGeocodeCache = readJsonIfExists(REVERSE_GEOCODE_CACHE_PATH, {});
  const photos = await Promise.all(paths.map(async (sourcePath, index) => {
    const stats = statSync(sourcePath);
    const metadata = readMergedMetadata(sourcePath, exifMap);
    const timestamp =
      normalizeExifTimestamp(metadata.DateTimeOriginal, metadata.OffsetTimeOriginal) ||
      normalizeExifTimestamp(metadata.CreateDate, metadata.OffsetTimeOriginal) ||
      new Date(stats.mtimeMs).toISOString();
    const filename = sourcePath.split("/").pop() || sourcePath;
    const stem = stemFromPath(sourcePath);
    const fallbackSlug = slugify(stem) || `photo-${index + 1}`;
    const locationHint = buildLocationHint(metadata);
    const gps =
      metadata.GPSLatitude !== undefined && metadata.GPSLongitude !== undefined
        ? {
            latitude: metadata.GPSLatitude,
            longitude: metadata.GPSLongitude,
          }
        : null;
    const reverseGeocoded = !locationHint && gps
      ? await reverseGeocodeCoordinates(gps, reverseGeocodeCache)
      : null;
    const finalLocation = locationHint || reverseGeocoded?.location || "";

    return {
      sourcePath,
      filename,
      sequenceIndex: index + 1,
      title: "",
      slug: fallbackSlug,
      description: "",
      location: finalLocation,
      tags: [],
      featured: false,
      status: defaultStatus,
      setSlugs: [],
      motionFrameSourcePaths: [],
      timelineEntries: [],
      notes: "",
      publishedAt: timestamp,
      takenAt: timestamp,
      camera: buildCameraLabel(metadata) || "",
      lens: String(metadata.LensModel || "").trim(),
      locationMeta: finalLocation
        ? {
            ...(reverseGeocoded?.locationMeta || createLocationMeta(finalLocation, {
              city: String(metadata.City || "").trim() || null,
              state:
                String(metadata["Province-State"] || "").trim() ||
                String(metadata.State || "").trim() ||
                null,
              country:
                String(metadata.Country || "").trim() ||
                String(metadata["Country-PrimaryLocationName"] || "").trim() ||
                null,
            }, gps)),
          }
        : null,
      cameraMeta: buildCameraLabel(metadata)
        ? {
            slug: slugify(buildCameraLabel(metadata)),
            brand: String(metadata.Make || "").trim() || null,
            model: String(metadata.Model || "").trim() || buildCameraLabel(metadata),
            label: buildCameraLabel(metadata),
          }
        : null,
      lensMeta: String(metadata.LensModel || "").trim()
        ? {
            slug: slugify(String(metadata.LensModel || "").trim()),
            brand: String(metadata.Make || "").trim() || null,
            model: String(metadata.LensModel || "").trim(),
            label: String(metadata.LensModel || "").trim(),
            mount: null,
            focalRange: null,
            maxAperture: null,
          }
        : null,
      sourceMetadata: {
        checksumSha1: hashFile(sourcePath),
        mimeType: metadata.MIMEType || "application/octet-stream",
        width: metadata.ImageWidth || null,
        height: metadata.ImageHeight || null,
        fileSizeBytes: stats.size,
        fileModifiedAt: new Date(stats.mtimeMs).toISOString(),
        extension: extname(sourcePath).toLowerCase(),
        focalLength: metadata.FocalLength ?? null,
        aperture: metadata.FNumber ?? null,
        shutterSpeed: metadata.ExposureTime ?? null,
        iso: metadata.ISO ?? null,
        gps,
        autoSetCandidate: null,
      },
    };
  }));

  writeJson(REVERSE_GEOCODE_CACHE_PATH, reverseGeocodeCache);

  const autoSetCandidates = assignAutoSetCandidates(
    photos,
    Number(options["set-gap-minutes"] || 90)
  );

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    directusUrl: BASE || null,
    defaultStatus,
    storyContext: {
      journeySummary: "",
      setNotes: "",
      captionTone: "",
      privacyNotes: "",
    },
    agentChecklist: [
      "Inspect the images before asking questions.",
      "Ask the photographer 2-4 concise questions about the journey, themes, and grouping.",
      "Write a title and description for every photo before upload.",
      "Only use sets when the grouping is clear or confirmed.",
    ],
    autoSetCandidates,
    sets: [],
    timelines: [],
    photos,
  };
}

function readManifest(pathValue) {
  if (!existsSync(pathValue)) {
    throw new Error(`Manifest not found: ${pathValue}`);
  }

  return JSON.parse(readFileSync(pathValue, "utf8"));
}

function writeJson(pathValue, data) {
  writeFileSync(pathValue, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function validateManifestData(manifest) {
  const errors = [];
  const photos = Array.isArray(manifest.photos) ? manifest.photos : [];
  const sets = Array.isArray(manifest.sets) ? manifest.sets : [];
  const photoSlugMap = new Map();
  const setSlugMap = new Map();

  if (!photos.length) {
    errors.push("Manifest has no photos.");
  }

  for (const photo of photos) {
    const targetPhotoSlug = String(photo.targetPhotoSlug || "").trim();
    const requiresNewPhotoFields = !targetPhotoSlug;

    if (!photo.sourcePath) {
      errors.push("A photo is missing sourcePath.");
      continue;
    }

    if (!existsSync(photo.sourcePath)) {
      errors.push(`Photo file is missing: ${photo.sourcePath}`);
    }

    if (requiresNewPhotoFields && (!photo.title || !String(photo.title).trim())) {
      errors.push(`Photo is missing title: ${photo.sourcePath}`);
    }

    if (requiresNewPhotoFields && (!photo.slug || !String(photo.slug).trim())) {
      errors.push(`Photo is missing slug: ${photo.sourcePath}`);
    }

    if (requiresNewPhotoFields && (!photo.description || !String(photo.description).trim())) {
      errors.push(`Photo is missing description: ${photo.sourcePath}`);
    }

    const normalizedSlug = slugify(photo.slug);
    const normalizedTargetSlug = targetPhotoSlug ? slugify(targetPhotoSlug) : "";

    if (requiresNewPhotoFields && normalizedSlug !== photo.slug) {
      errors.push(`Photo slug must already be normalized: ${photo.sourcePath} -> ${photo.slug}`);
    }

    if (targetPhotoSlug && normalizedTargetSlug !== targetPhotoSlug) {
      errors.push(`Photo targetPhotoSlug must already be normalized: ${photo.sourcePath} -> ${targetPhotoSlug}`);
    }

    if (requiresNewPhotoFields) {
      if (photoSlugMap.has(photo.slug)) {
        errors.push(`Duplicate photo slug: ${photo.slug}`);
      } else {
        photoSlugMap.set(photo.slug, photo.sourcePath);
      }
    }

    if (!Array.isArray(photo.tags)) {
      errors.push(`Photo tags must be an array: ${photo.sourcePath}`);
    }

    if (!Array.isArray(photo.setSlugs)) {
      errors.push(`Photo setSlugs must be an array: ${photo.sourcePath}`);
    }

    if (!Array.isArray(photo.motionFrameSourcePaths)) {
      errors.push(`Photo motionFrameSourcePaths must be an array: ${photo.sourcePath}`);
    } else {
      for (const framePath of photo.motionFrameSourcePaths) {
        if (!existsSync(framePath)) {
          errors.push(`Motion frame file is missing: ${framePath}`);
        }
      }
    }

    if (!Array.isArray(photo.timelineEntries)) {
      errors.push(`Photo timelineEntries must be an array: ${photo.sourcePath}`);
    } else {
      for (const entry of photo.timelineEntries) {
        if (!entry?.slug || slugify(entry.slug) !== entry.slug) {
          errors.push(`Photo timeline entry must include a normalized slug: ${photo.sourcePath}`);
        }
      }
    }
  }

  for (const setDefinition of sets) {
    if (!setDefinition.slug || !String(setDefinition.slug).trim()) {
      errors.push("A set is missing slug.");
      continue;
    }

    const normalizedSlug = slugify(setDefinition.slug);

    if (normalizedSlug !== setDefinition.slug) {
      errors.push(`Set slug must already be normalized: ${setDefinition.slug}`);
    }

    if (setSlugMap.has(setDefinition.slug)) {
      errors.push(`Duplicate set slug: ${setDefinition.slug}`);
    } else {
      setSlugMap.set(setDefinition.slug, true);
    }
  }

  return errors;
}

function ensureUploadEnv() {
  if (!BASE || !TOKEN) {
    throw new Error(
      "Missing NUXT_PUBLIC_DIRECTUS_URL or DIRECTUS_TOKEN in .env for upload."
    );
  }
}

async function fetchText(method, pathValue, body, headers = {}) {
  const response = await fetch(`${BASE}${pathValue}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${method} ${pathValue} failed (${response.status}): ${text}`);
  }

  return text;
}

async function fetchJson(method, pathValue, body, headers = {}) {
  const text = await fetchText(
    method,
    pathValue,
    body ? JSON.stringify(body) : undefined,
    {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    }
  );

  return text ? JSON.parse(text) : {};
}

async function lookupItemBySlug(collection, slug) {
  const params = new URLSearchParams();
  params.set("filter[slug][_eq]", slug);
  params.set("fields", "id");
  params.set("limit", "1");

  const response = await fetchJson("GET", `/items/${collection}?${params.toString()}`);
  return response.data?.[0] || null;
}

async function lookupItemByAnySlug(collection, slugs = []) {
  const candidates = [...new Set((slugs || []).filter(Boolean))];

  for (const slug of candidates) {
    const item = await lookupItemBySlug(collection, slug);

    if (item) {
      return item;
    }
  }

  return null;
}

function ensureUploadAsset(photo) {
  if (!isTiffPath(photo.sourcePath)) {
    return {
      filePath: photo.sourcePath,
      mimeType: photo.sourceMetadata?.mimeType || "application/octet-stream",
      filename: photo.filename,
    };
  }

  const uploadDir = join(tmpdir(), "photo-ingest-uploads");
  mkdirSync(uploadDir, { recursive: true });

  const checksum = photo.sourceMetadata?.checksumSha1 || hashFile(photo.sourcePath);
  const outputPath = join(uploadDir, `${checksum}.jpg`);

  if (!existsSync(outputPath)) {
    const result = spawnSync(
      "python3",
      [
        "-c",
        `
from PIL import Image, ImageOps
import sys

source, target = sys.argv[1], sys.argv[2]
with Image.open(source) as im:
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    im.save(target, format="JPEG", quality=95, subsampling=0)
`,
        photo.sourcePath,
        outputPath,
      ],
      {
        encoding: "utf8",
      }
    );

    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || `Failed to convert TIFF: ${photo.sourcePath}`);
    }
  }

  const metadataSources = [photo.sourcePath, ...findOriginalMetadataFiles(photo.sourcePath)].filter(
    (value, index, values) => value && values.indexOf(value) === index
  );

  if (metadataSources.length) {
    const copyPrimaryMetadata = spawnSync(
      "exiftool",
      [
        "-overwrite_original",
        "-tagsFromFile",
        metadataSources[0],
        "-all:all",
        outputPath,
      ],
      {
        encoding: "utf8",
      }
    );

    if (copyPrimaryMetadata.status !== 0) {
      throw new Error(
        copyPrimaryMetadata.stderr.trim() ||
          `Failed to copy metadata from ${metadataSources[0]} to ${outputPath}`
      );
    }

    for (const metadataSource of metadataSources.slice(1)) {
      const copyLocationMetadata = spawnSync(
        "exiftool",
        [
          "-overwrite_original",
          "-tagsFromFile",
          metadataSource,
          ...LOCATION_METADATA_COPY_TAGS,
          outputPath,
        ],
        {
          encoding: "utf8",
        }
      );

      if (copyLocationMetadata.status !== 0) {
        throw new Error(
          copyLocationMetadata.stderr.trim() ||
            `Failed to merge metadata from ${metadataSource} into ${outputPath}`
        );
      }
    }
  }

  return {
    filePath: outputPath,
    mimeType: "image/jpeg",
    filename: `${stemFromPath(photo.filename)}.jpg`,
  };
}

async function uploadDirectusFile(photo) {
  const uploadAsset = ensureUploadAsset(photo);
  const bytes = readFileSync(uploadAsset.filePath);
  const blob = new Blob([bytes], {
    type: uploadAsset.mimeType,
  });
  const form = new FormData();

  form.append("title", photo.title);
  form.append("description", photo.description);
  form.append("file", blob, uploadAsset.filename);

  const text = await fetchText("POST", "/files", form);
  const response = JSON.parse(text);

  return response.data.id;
}

async function uploadDirectusPath(sourcePath, title, description) {
  const uploadAsset = ensureUploadAsset({
    sourcePath,
    filename: sourcePath.split("/").pop() || sourcePath,
    sourceMetadata: {
      mimeType: null,
      checksumSha1: null,
    },
  });
  const bytes = readFileSync(uploadAsset.filePath);
  const blob = new Blob([bytes], {
    type: uploadAsset.mimeType,
  });
  const form = new FormData();

  form.append("title", title);
  form.append("description", description);
  form.append("file", blob, uploadAsset.filename);

  const text = await fetchText("POST", "/files", form);
  const response = JSON.parse(text);

  return response.data.id;
}

function buildPhotoPayload(photo, fileId, metadataRefs = {}) {
  return {
    status: photo.status || "published",
    title: photo.title,
    slug: photo.slug,
    description: photo.description,
    image: fileId,
    published_at: photo.publishedAt || photo.takenAt || new Date().toISOString(),
    taken_at: photo.takenAt || null,
    location: photo.location || null,
    camera: photo.camera || null,
    lens: photo.lens || null,
    location_ref: metadataRefs.locationRefId || null,
    camera_ref: metadataRefs.cameraRefId || null,
    lens_ref: metadataRefs.lensRefId || null,
    featured: Boolean(photo.featured),
    tags: photo.tags || [],
  };
}

async function resolveExistingPhotoTarget(photo) {
  const targetPhotoSlug = String(photo.targetPhotoSlug || "").trim();

  if (!targetPhotoSlug) {
    return null;
  }

  const existing = await lookupItemByAnySlug("photos", [
    targetPhotoSlug,
    ...(photo.previousSlugs || []),
  ]);

  if (!existing?.id) {
    throw new Error(`Unable to find existing photo target: ${targetPhotoSlug}`);
  }

  return existing;
}

async function upsertItemBySlug(collection, slug, payload, options = {}) {
  const existing = await lookupItemByAnySlug(collection, [
    slug,
    ...(options.matchSlugs || []),
  ]);

  if (existing?.id) {
    await fetchJson(
      "PATCH",
      `/items/${collection}/${existing.id}`,
      payload,
      { Prefer: "return=minimal" }
    );

    return {
      id: existing.id,
      slug,
    };
  }

  await fetchJson(
    "POST",
    `/items/${collection}`,
    payload,
    { Prefer: "return=minimal" }
  );

  const created = await lookupItemBySlug(collection, slug);

  if (!created?.id) {
    throw new Error(`Unable to look up ${collection} item after create: ${slug}`);
  }

  return created;
}

function deriveLocationMeta(photo) {
  if (photo.locationMeta?.title) {
    return {
      slug: photo.locationMeta.slug || slugify(photo.locationMeta.title),
      title: photo.locationMeta.title,
      city: photo.locationMeta.city || null,
      region: photo.locationMeta.region || null,
      country: photo.locationMeta.country || null,
      latitude: photo.locationMeta.latitude ?? null,
      longitude: photo.locationMeta.longitude ?? null,
      description: photo.locationMeta.description || null,
    };
  }

  if (!photo.location) {
    return null;
  }

  return {
    slug: slugify(photo.location),
    title: photo.location,
    city: null,
    region: null,
    country: null,
    latitude: null,
    longitude: null,
    description: null,
  };
}

function deriveCameraMeta(photo) {
  if (photo.cameraMeta?.model || photo.cameraMeta?.label) {
    const label = photo.cameraMeta.label || photo.cameraMeta.model;
    return {
      slug: photo.cameraMeta.slug || slugify(label),
      brand: photo.cameraMeta.brand || null,
      model: photo.cameraMeta.model || label,
      label,
    };
  }

  if (!photo.camera) {
    return null;
  }

  return {
    slug: slugify(photo.camera),
    brand: null,
    model: photo.camera,
    label: photo.camera,
  };
}

function deriveLensMeta(photo) {
  if (photo.lensMeta?.model || photo.lensMeta?.label) {
    const label = photo.lensMeta.label || photo.lensMeta.model;
    return {
      slug: photo.lensMeta.slug || slugify(label),
      brand: photo.lensMeta.brand || null,
      model: photo.lensMeta.model || label,
      label,
      mount: photo.lensMeta.mount || null,
      focal_range: photo.lensMeta.focalRange || null,
      max_aperture: photo.lensMeta.maxAperture || null,
    };
  }

  if (!photo.lens) {
    return null;
  }

  return {
    slug: slugify(photo.lens),
    brand: null,
    model: photo.lens,
    label: photo.lens,
    mount: null,
    focal_range: null,
    max_aperture: null,
  };
}

function materializeSetDefinitions(manifest) {
  const definedSets = new Map(
    (Array.isArray(manifest.sets) ? manifest.sets : []).map((setDefinition) => [
      setDefinition.slug,
      { ...setDefinition },
    ])
  );

  for (const photo of manifest.photos || []) {
    for (const setSlug of photo.setSlugs || []) {
      if (!definedSets.has(setSlug)) {
        definedSets.set(setSlug, {
          slug: setSlug,
          title: titleCaseFromSlug(setSlug),
          description: "",
          tags: [],
          status: photo.status || manifest.defaultStatus || "published",
          coverSourcePath: photo.sourcePath,
        });
      }
    }
  }

  return [...definedSets.values()];
}

function buildSetMembership(manifest) {
  const membership = new Map();

  for (const photo of manifest.photos || []) {
    for (const setSlug of photo.setSlugs || []) {
      const list = membership.get(setSlug) || [];
      list.push(photo);
      membership.set(setSlug, list);
    }
  }

  for (const list of membership.values()) {
    list.sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  }

  return membership;
}

function materializeTimelineDefinitions(manifest) {
  const definedTimelines = new Map(
    (Array.isArray(manifest.timelines) ? manifest.timelines : []).map((timeline) => [
      timeline.slug,
      { ...timeline },
    ])
  );

  for (const photo of manifest.photos || []) {
    for (const entry of photo.timelineEntries || []) {
      if (!definedTimelines.has(entry.slug)) {
        definedTimelines.set(entry.slug, {
          slug: entry.slug,
          title: titleCaseFromSlug(entry.slug),
          description: "",
          story: "",
          tags: [],
          status: photo.status || manifest.defaultStatus || "published",
          coverSourcePath: photo.sourcePath,
        });
      }
    }
  }

  return [...definedTimelines.values()];
}

function buildTimelineMembership(manifest) {
  const membership = new Map();

  for (const photo of manifest.photos || []) {
    for (const entry of photo.timelineEntries || []) {
      const list = membership.get(entry.slug) || [];
      list.push({
        photo,
        chapterTitle: entry.chapterTitle || null,
        storyText: entry.storyText || null,
      });
      membership.set(entry.slug, list);
    }
  }

  for (const list of membership.values()) {
    list.sort((left, right) => left.photo.sequenceIndex - right.photo.sequenceIndex);
  }

  return membership;
}

function buildPhotosetPayload(setDefinition, coverFileId) {
  return {
    status: setDefinition.status || "published",
    slug: setDefinition.slug,
    title: setDefinition.title || titleCaseFromSlug(setDefinition.slug),
    description: setDefinition.description || null,
    cover_image: coverFileId || null,
    published_at: setDefinition.publishedAt || new Date().toISOString(),
    tags: setDefinition.tags || [],
  };
}

function buildTimelinePayload(timelineDefinition, coverFileId) {
  return {
    status: timelineDefinition.status || "published",
    slug: timelineDefinition.slug,
    title: timelineDefinition.title || titleCaseFromSlug(timelineDefinition.slug),
    description: timelineDefinition.description || null,
    story: timelineDefinition.story || null,
    cover_image: coverFileId || null,
    published_at: timelineDefinition.publishedAt || new Date().toISOString(),
    tags: timelineDefinition.tags || [],
  };
}

async function readExistingSetLinks(photosetId) {
  const params = new URLSearchParams();
  params.set("filter[photosets_id][_eq]", String(photosetId));
  params.set("fields", "id,photos_id,sort");
  params.set("limit", "-1");
  const response = await fetchJson("GET", `/items/photosets_photos?${params.toString()}`);
  return response.data || [];
}

async function syncSetLinks(photosetId, desiredPhotoIds) {
  const existingLinks = await readExistingSetLinks(photosetId);
  const existingByPhotoId = new Map(
    existingLinks.map((link) => [String(link.photos_id), link])
  );

  for (let index = 0; index < desiredPhotoIds.length; index += 1) {
    const photoId = String(desiredPhotoIds[index]);
    const sort = index + 1;
    const existing = existingByPhotoId.get(photoId);

    if (existing?.id) {
      if (existing.sort !== sort) {
        await fetchJson("PATCH", `/items/photosets_photos/${existing.id}`, { sort });
      }
      continue;
    }

    await fetchJson("POST", "/items/photosets_photos", {
      photosets_id: photosetId,
      photos_id: photoId,
      sort,
    });
  }
}

async function readExistingTimelineEntries(timelineId) {
  const params = new URLSearchParams();
  params.set("filter[timelines_id][_eq]", String(timelineId));
  params.set("fields", "id");
  params.set("limit", "-1");
  const response = await fetchJson("GET", `/items/timelines_photos?${params.toString()}`);
  return response.data || [];
}

async function replaceTimelineEntries(timelineId, entries) {
  const existing = await readExistingTimelineEntries(timelineId);

  for (const row of existing) {
    await fetchJson("DELETE", `/items/timelines_photos/${row.id}`);
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    await fetchJson("POST", "/items/timelines_photos", {
      timelines_id: timelineId,
      photos_id: entry.photoId,
      sort: index + 1,
      chapter_title: entry.chapterTitle || null,
      story_text: entry.storyText || null,
    });
  }
}

async function readExistingMotionFrames(photoId) {
  const params = new URLSearchParams();
  params.set("filter[photos_id][_eq]", String(photoId));
  params.set("fields", "id");
  params.set("limit", "-1");
  const response = await fetchJson("GET", `/items/photos_motion_frames?${params.toString()}`);
  return response.data || [];
}

async function replaceMotionFrames(photoId, frameFileIds) {
  const existing = await readExistingMotionFrames(photoId);

  for (const row of existing) {
    await fetchJson("DELETE", `/items/photos_motion_frames/${row.id}`);
  }

  for (let index = 0; index < frameFileIds.length; index += 1) {
    await fetchJson("POST", "/items/photos_motion_frames", {
      photos_id: photoId,
      frame_file: frameFileIds[index],
      sort: index + 1,
    });
  }
}

function printValidationResult(errors) {
  if (!errors.length) {
    console.log("Manifest looks ready.");
    return;
  }

  console.error("Manifest validation failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

async function runPrepare(options, positionals) {
  const manifestPath = ensureManifestPath(options.manifest);
  const inputPaths = uniquePaths([
    ...(options["paths-file"] ? readPathsFile(options["paths-file"]) : []),
    ...positionals,
  ]);
  const photoPaths = ensurePhotoPaths(inputPaths);
  const manifest = await prepareManifest(photoPaths, options);

  writeJson(manifestPath, manifest);

  console.log(`Prepared manifest: ${manifestPath}`);
  console.log(`Photos: ${manifest.photos.length}`);
  console.log(`Auto set candidates: ${manifest.autoSetCandidates.length}`);
  console.log("Next: inspect the images, ask the photographer a couple of questions, fill in titles/descriptions/setSlugs, then run validate/upload.");
}

async function runValidate(options) {
  const manifestPath = ensureManifestPath(options.manifest);
  const manifest = readManifest(manifestPath);
  const errors = validateManifestData(manifest);

  printValidationResult(errors);

  if (errors.length) {
    process.exitCode = 1;
  }
}

async function runUpload(options) {
  const manifestPath = ensureManifestPath(options.manifest);
  const manifest = readManifest(manifestPath);
  const errors = validateManifestData(manifest);

  if (errors.length) {
    printValidationResult(errors);
    process.exit(1);
  }

  ensureUploadEnv();

  const setDefinitions = materializeSetDefinitions(manifest);
  const membership = buildSetMembership(manifest);
  const timelineDefinitions = materializeTimelineDefinitions(manifest);
  const timelineMembership = buildTimelineMembership(manifest);

  if (options["dry-run"]) {
    console.log(`Dry run: ${manifest.photos.length} photos, ${setDefinitions.length} sets, ${timelineDefinitions.length} timelines`);
    for (const photo of manifest.photos) {
      const displaySlug = photo.targetPhotoSlug || photo.slug || photo.sourcePath;
      const targetSuffix = photo.targetPhotoSlug ? ` -> existing:${photo.targetPhotoSlug}` : "";
      console.log(`- photo ${displaySlug} <= ${photo.sourcePath}${photo.motionFrameSourcePaths?.length ? ` (+${photo.motionFrameSourcePaths.length} motion frame(s))` : ""}${targetSuffix}`);
    }
    for (const setDefinition of setDefinitions) {
      const memberCount = membership.get(setDefinition.slug)?.length || 0;
      console.log(`- set ${setDefinition.slug} (${memberCount} photos)`);
    }
    for (const timelineDefinition of timelineDefinitions) {
      const memberCount = timelineMembership.get(timelineDefinition.slug)?.length || 0;
      console.log(`- timeline ${timelineDefinition.slug} (${memberCount} entries)`);
    }
    return;
  }

  const uploadedPhotos = [];
  const uploadedPhotoBySourcePath = new Map();

  for (const photo of manifest.photos) {
    const existingTarget = await resolveExistingPhotoTarget(photo);
    let fileId = null;
    let item = null;

    if (existingTarget) {
      item = {
        id: existingTarget.id,
        slug: existingTarget.slug || photo.targetPhotoSlug,
      };
    } else {
      fileId = await uploadDirectusFile(photo);
      const locationMeta = deriveLocationMeta(photo);
      const cameraMeta = deriveCameraMeta(photo);
      const lensMeta = deriveLensMeta(photo);
      const locationRef = locationMeta ? await upsertItemBySlug("photo_locations", locationMeta.slug, locationMeta) : null;
      const cameraRef = cameraMeta ? await upsertItemBySlug("camera_bodies", cameraMeta.slug, cameraMeta) : null;
      const lensRef = lensMeta ? await upsertItemBySlug("lenses", lensMeta.slug, lensMeta) : null;
      const payload = buildPhotoPayload(photo, fileId, {
        locationRefId: locationRef?.id ?? null,
        cameraRefId: cameraRef?.id ?? null,
        lensRefId: lensRef?.id ?? null,
      });
      item = await upsertItemBySlug("photos", photo.slug, payload, {
        matchSlugs: photo.previousSlugs || [],
      });
    }
    const motionFrameIds = [];
    const motionLabelBase = String(photo.title || item.slug || photo.targetPhotoSlug || photo.slug || "Photo").trim();

    for (const [index, framePath] of (photo.motionFrameSourcePaths || []).entries()) {
      const frameId = await uploadDirectusPath(
        framePath,
        `${motionLabelBase} Motion ${index + 1}`,
        `Motion frame ${index + 1} for ${motionLabelBase}.`
      );
      motionFrameIds.push(frameId);
    }

    if (motionFrameIds.length) {
      await replaceMotionFrames(item.id, motionFrameIds);
    }

    uploadedPhotos.push({
      sourcePath: photo.sourcePath,
      slug: item.slug,
      fileId,
      itemId: item.id,
    });
    uploadedPhotoBySourcePath.set(photo.sourcePath, {
      fileId,
      itemId: item.id,
      slug: item.slug,
    });

    console.log(existingTarget ? `Attached motion to photo: ${item.slug}` : `Uploaded photo: ${item.slug}`);
  }

  for (const setDefinition of setDefinitions) {
    const setPhotos = membership.get(setDefinition.slug) || [];

    if (!setPhotos.length) {
      continue;
    }

    const coverSourcePath =
      setDefinition.coverSourcePath ||
      setPhotos[0]?.sourcePath ||
      null;
    const coverFileId = coverSourcePath
      ? uploadedPhotoBySourcePath.get(coverSourcePath)?.fileId || null
      : null;
    const payload = buildPhotosetPayload(setDefinition, coverFileId);
    const photoset = await upsertItemBySlug("photosets", setDefinition.slug, payload);
    const desiredPhotoIds = setPhotos
      .map((photo) => uploadedPhotoBySourcePath.get(photo.sourcePath)?.itemId)
      .filter(Boolean);

    await syncSetLinks(photoset.id, desiredPhotoIds);
    console.log(`Upserted photoset: ${setDefinition.slug}`);
  }

  for (const timelineDefinition of timelineDefinitions) {
    const timelineEntries = timelineMembership.get(timelineDefinition.slug) || [];

    if (!timelineEntries.length) {
      continue;
    }

    const coverSourcePath =
      timelineDefinition.coverSourcePath ||
      timelineEntries[0]?.photo?.sourcePath ||
      null;
    const coverFileId = coverSourcePath
      ? uploadedPhotoBySourcePath.get(coverSourcePath)?.fileId || null
      : null;
    const payload = buildTimelinePayload(timelineDefinition, coverFileId);
    const timeline = await upsertItemBySlug("timelines", timelineDefinition.slug, payload);

    await replaceTimelineEntries(
      timeline.id,
      timelineEntries
        .map((entry) => ({
          photoId: uploadedPhotoBySourcePath.get(entry.photo.sourcePath)?.itemId,
          chapterTitle: entry.chapterTitle,
          storyText: entry.storyText,
        }))
        .filter((entry) => entry.photoId)
    );

    console.log(`Upserted timeline: ${timelineDefinition.slug}`);
  }

  console.log("Upload complete.");
}

async function main() {
  const { command, options, positionals } = parseArgs(process.argv.slice(2));
  ensureCommand(command);

  if (options.help) {
    printHelp();
    return;
  }

  if (command === "prepare") {
    await runPrepare(options, positionals);
    return;
  }

  if (command === "validate") {
    await runValidate(options);
    return;
  }

  if (command === "upload") {
    await runUpload(options);
    return;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
