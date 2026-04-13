import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";

import type { H3Event } from "h3";

const PHOTO_INGEST_SCRIPT = resolve(process.cwd(), "scripts/photo-ingest.mjs");

type StudioManifest = {
  version?: number;
  storyContext?: Record<string, string>;
  sets?: Array<Record<string, unknown>>;
  timelines?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
};

type MomentMatch = {
  token: string;
  baseStem: string;
};

function runPhotoIngest(args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [PHOTO_INGEST_SCRIPT, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error((stderr || stdout || `photo-ingest exited with code ${code}`).trim())
      );
    });
  });
}

function makeTempManifestPath(prefix: string) {
  return join(tmpdir(), `${prefix}-${Date.now()}.json`);
}

function stripWrappingQuotes(value: string) {
  const trimmed = String(value || "").trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normalizeStudioPath(value: string) {
  const trimmed = stripWrappingQuotes(value);

  if (!trimmed) {
    return "";
  }

  const windowsDriveMatch = trimmed.match(/^([a-zA-Z]):[\\/](.*)$/);

  if (windowsDriveMatch) {
    const drive = windowsDriveMatch[1].toLowerCase();
    const rest = windowsDriveMatch[2]
      .replace(/\\+/g, "/")
      .replace(/^\/+/, "");

    return `/mnt/${drive}/${rest}`;
  }

  if (trimmed.startsWith("\\\\")) {
    return trimmed.replace(/\\+/g, "/");
  }

  return trimmed.replace(/\\+/g, "/");
}

function normalizePathEntries(paths: string[]) {
  return [...new Set(paths.map((value) => normalizeStudioPath(value)).filter(Boolean))];
}

function stemFromPath(pathValue: string) {
  const extension = extname(pathValue);
  const filename = basename(pathValue);
  return extension ? filename.slice(0, -extension.length) : filename;
}

function parseMomentStem(value: string): MomentMatch | null {
  const match = String(value || "").match(/^(moment\d*)_(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    token: match[1].toLowerCase(),
    baseStem: match[2],
  };
}

function naturalCompare(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function detectMomentSequences(manifest: StudioManifest) {
  const photos = (manifest.photos || []).map((photo) => photo as Record<string, any>);

  if (!photos.length) {
    return manifest;
  }

  const byBaseStem = new Map<string, Record<string, any>>();

  for (const photo of photos) {
    const match = parseMomentStem(photo.filename || stemFromPath(photo.sourcePath || ""));

    if (!match) {
      byBaseStem.set(`${dirname(photo.sourcePath || "")}:${stemFromPath(photo.sourcePath || "")}`.toLowerCase(), photo);
    }
  }

  const groups = new Map<string, Array<Record<string, any>>>();

  for (const photo of photos) {
    const stem = String(photo.filename || stemFromPath(photo.sourcePath || ""));
    const match = parseMomentStem(stem);

    if (!match) {
      continue;
    }

    const key = `${dirname(photo.sourcePath || "")}:${match.token}`.toLowerCase();
    const current = groups.get(key) || [];
    photo.__momentBaseStem = match.baseStem;
    current.push(photo);
    groups.set(key, current);
  }

  if (!groups.size) {
    return manifest;
  }

  const consumedPaths = new Set<string>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const sorted = [...group].sort((left, right) => {
      const leftStem = String(left.__momentBaseStem || left.filename || stemFromPath(left.sourcePath || ""));
      const rightStem = String(right.__momentBaseStem || right.filename || stemFromPath(right.sourcePath || ""));
      return naturalCompare(leftStem, rightStem);
    });

    const middle = sorted[Math.floor(sorted.length / 2)];
    const matchingBaseKey = `${dirname(middle.sourcePath || "")}:${String(middle.__momentBaseStem || "")}`.toLowerCase();
    const basePhoto = byBaseStem.get(matchingBaseKey);
    const heroPhoto = basePhoto || middle;

    const motionFrameSourcePaths = sorted
      .map((photo) => String(photo.sourcePath || "").trim())
      .filter((pathValue) => pathValue && pathValue !== heroPhoto.sourcePath);

    heroPhoto.motionFrameSourcePaths = [
      ...new Set([
        ...motionFrameSourcePaths,
        ...((heroPhoto.motionFrameSourcePaths || []) as string[]).map((value) => String(value || "").trim()).filter(Boolean),
      ]),
    ];

    for (const photo of sorted) {
      consumedPaths.add(String(photo.sourcePath || ""));
    }

    consumedPaths.delete(String(heroPhoto.sourcePath || ""));
  }

  const nextPhotos = photos.filter((photo) => !consumedPaths.has(String(photo.sourcePath || "")));

  return {
    ...manifest,
    photos: nextPhotos,
  } satisfies StudioManifest;
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferLocationTitle(photo: Record<string, any>) {
  const meta = photo.locationMeta;
  if (meta?.city && meta?.country) {
    return `${meta.city}, ${meta.country}`;
  }

  return meta?.title || photo.location || "the archive";
}

function buildHeuristicSuggestions(manifest: StudioManifest) {
  const nextManifest = structuredClone(manifest) as StudioManifest;

  nextManifest.photos = (nextManifest.photos || []).map((rawPhoto, index) => {
    const photo = rawPhoto as Record<string, any>;
    const tags = new Set(Array.isArray(photo.tags) ? photo.tags : []);
    const locationTitle = inferLocationTitle(photo);
    const isMotion = Array.isArray(photo.motionFrameSourcePaths) && photo.motionFrameSourcePaths.length > 0;
    const isPortrait = Number(photo.sourceMetadata?.height || 0) > Number(photo.sourceMetadata?.width || 0);
    const locationSlug = slugify(locationTitle.split(",")[0] || "");

    tags.add("street-photography");
    tags.add("candid");

    if (isPortrait) tags.add("portrait");
    if (isMotion) tags.add("motion");
    if (locationSlug) tags.add(locationSlug);

    const suggestedTitle = photo.title || (
      isMotion
        ? `Street Moment in ${locationTitle.split(",")[0] || "Zwolle"}`
        : isPortrait
          ? `Portrait Frame in ${locationTitle.split(",")[0] || "Zwolle"}`
          : `Street Frame ${index + 1}`
    );

    const suggestedDescription = photo.description || (
      isMotion
        ? `A motion sequence captured in ${locationTitle}, preserved as a short run of frames so the passing movement stays part of the picture.`
        : `A street photograph captured in ${locationTitle}, prepared for the archive with location and camera metadata intact.`
    );

    return {
      ...photo,
      title: suggestedTitle,
      slug: photo.slug || slugify(suggestedTitle) || `photo-${index + 1}`,
      description: suggestedDescription,
      tags: [...tags],
    };
  });

  return nextManifest;
}

async function buildAiSuggestions(event: H3Event, manifest: StudioManifest) {
  const config = useRuntimeConfig(event);
  const apiKey = config.photoIngestAiApiKey as string | undefined;
  const baseUrl = config.photoIngestAiBaseUrl as string | undefined;
  const model = config.photoIngestAiModel as string | undefined;

  if (!apiKey || !baseUrl || !model) {
    return null;
  }

  const photos = (manifest.photos || []).map((rawPhoto) => {
    const photo = rawPhoto as Record<string, any>;
    return {
      sourcePath: photo.sourcePath,
      filename: photo.filename,
      location: inferLocationTitle(photo),
      camera: photo.camera || null,
      lens: photo.lens || null,
      takenAt: photo.takenAt || null,
      hasMotion: Array.isArray(photo.motionFrameSourcePaths) && photo.motionFrameSourcePaths.length > 0,
      motionFrameCount: Array.isArray(photo.motionFrameSourcePaths) ? photo.motionFrameSourcePaths.length : 0,
      dimensions: {
        width: photo.sourceMetadata?.width || null,
        height: photo.sourceMetadata?.height || null,
      },
      tags: Array.isArray(photo.tags) ? photo.tags : [],
    };
  });

  const response = await fetch(`${String(baseUrl).replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are helping prepare a photography ingest manifest. Return only JSON with a top-level photos array. Each item must include sourcePath, title, description, and tags. Keep titles clear, literal, and non-quirky. Keep descriptions grounded and concise.",
        },
        {
          role: "user",
          content: JSON.stringify({ photos }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI suggestion request failed (${response.status})`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI suggestion response was empty.");
  }

  const parsed = JSON.parse(content) as {
    photos?: Array<{ sourcePath?: string; title?: string; description?: string; tags?: string[] }>;
  };

  return parsed.photos || [];
}

export async function prepareStudioManifest(paths: string[]) {
  const normalizedPaths = normalizePathEntries(paths);

  if (!normalizedPaths.length) {
    throw new Error("Add at least one absolute file path.");
  }

  for (const pathValue of normalizedPaths) {
    if (!existsSync(pathValue)) {
      throw new Error(`File not found: ${pathValue}`);
    }
  }

  const manifestPath = makeTempManifestPath("photo-ingest-studio");
  const result = await runPhotoIngest(["prepare", "--manifest", manifestPath, ...normalizedPaths]);
  const manifest = detectMomentSequences(JSON.parse(readFileSync(manifestPath, "utf8")) as StudioManifest);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const studioPhotoCount = Array.isArray(manifest.photos) ? manifest.photos.length : 0;
  const studioMotionCount = Array.isArray(manifest.photos)
    ? manifest.photos.filter((photo) => {
        const motionFrameSourcePaths = (photo as Record<string, unknown>).motionFrameSourcePaths;
        return Array.isArray(motionFrameSourcePaths) && motionFrameSourcePaths.length > 0;
      }).length
    : 0;

  return {
    manifestPath,
    manifest,
    output: [
      result.stdout.trim(),
      `Studio summary: ${studioPhotoCount} photo card${studioPhotoCount !== 1 ? "s" : ""}, ${studioMotionCount} motion sequence${studioMotionCount !== 1 ? "s" : ""}.`,
    ].filter(Boolean).join("\n\n"),
  };
}

export async function suggestStudioManifest(event: H3Event, manifest: StudioManifest) {
  const heuristicManifest = buildHeuristicSuggestions(manifest);

  try {
    const aiSuggestions = await buildAiSuggestions(event, heuristicManifest);

    if (!aiSuggestions?.length) {
      return { manifest: heuristicManifest, source: "heuristic" as const };
    }

    const suggestionByPath = new Map(
      aiSuggestions
        .filter((item) => item.sourcePath)
        .map((item) => [item.sourcePath as string, item])
    );

    heuristicManifest.photos = (heuristicManifest.photos || []).map((rawPhoto, index) => {
      const photo = rawPhoto as Record<string, any>;
      const suggestion = suggestionByPath.get(photo.sourcePath);

      if (!suggestion) {
        return photo;
      }

      const title = suggestion.title || photo.title || `Photo ${index + 1}`;
      return {
        ...photo,
        title,
        slug: slugify(title) || photo.slug || `photo-${index + 1}`,
        description: suggestion.description || photo.description,
        tags: Array.isArray(suggestion.tags) && suggestion.tags.length ? suggestion.tags : photo.tags,
      };
    });

    return { manifest: heuristicManifest, source: "ai" as const };
  } catch {
    return { manifest: heuristicManifest, source: "heuristic" as const };
  }
}

export async function uploadStudioManifest(manifest: StudioManifest) {
  const manifestPath = makeTempManifestPath("photo-ingest-upload");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const validation = await runPhotoIngest(["validate", "--manifest", manifestPath]);
  const upload = await runPhotoIngest(["upload", "--manifest", manifestPath]);

  return {
    manifestPath,
    validation: validation.stdout.trim(),
    output: upload.stdout.trim(),
  };
}

export function applyManifestFormEdits(manifest: StudioManifest) {
  const nextManifest = structuredClone(manifest) as StudioManifest;
  nextManifest.storyContext = Object.fromEntries(
    Object.entries((nextManifest.storyContext || {}) as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value || "").trim(),
    ])
  );
  nextManifest.photos = (nextManifest.photos || []).map((rawPhoto, index) => {
    const photo = rawPhoto as Record<string, any>;
    const title = String(photo.title || "").trim();
    const slug = slugify(String(photo.slug || title));

    return {
      ...photo,
      sourcePath: normalizeStudioPath(String(photo.sourcePath || "")),
      targetPhotoSlug: photo.targetPhotoSlug ? slugify(String(photo.targetPhotoSlug || "")) : undefined,
      title,
      slug: slug || `photo-${index + 1}`,
      description: String(photo.description || "").trim(),
      tags: Array.isArray(photo.tags)
        ? photo.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
      setSlugs: Array.isArray(photo.setSlugs)
        ? photo.setSlugs.map((tag) => slugify(String(tag))).filter(Boolean)
        : [],
      motionFrameSourcePaths: Array.isArray(photo.motionFrameSourcePaths)
        ? [...new Set(photo.motionFrameSourcePaths.map((pathValue) => normalizeStudioPath(String(pathValue || ""))).filter(Boolean))]
        : [],
    };
  });

  nextManifest.sets = (nextManifest.sets || []).map((rawSet) => {
    const setDefinition = rawSet as Record<string, any>;
    return {
      ...setDefinition,
      slug: slugify(String(setDefinition.slug || setDefinition.title || "")) || slugify(toTitleCase(String(setDefinition.title || "set"))),
      tags: Array.isArray(setDefinition.tags)
        ? setDefinition.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
    };
  });

  return nextManifest;
}
