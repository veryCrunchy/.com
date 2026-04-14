import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";

import type { H3Event } from "h3";
import { readItems, updateItem } from "@directus/sdk";

import { getDirectusClient } from "~/server/utils/directus";

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

type AiSuggestion = {
  sourcePath?: string;
  title?: string;
  description?: string;
  tags?: string[];
};

type StoryAwarePhotoPayload = {
  sourcePath: string;
  filename?: string;
  location?: string | null;
  camera?: string | null;
  lens?: string | null;
  takenAt?: string | null;
  hasMotion: boolean;
  motionFrameCount: number;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  existingTags: string[];
};

const VOICE_RULES = [
  "Write like the photographer who made the frame, not like a curator or gallery wall text.",
  "Keep the voice direct, lived-in, and specific.",
  "If the journey notes are personal, it is okay to use first-person language in the description.",
  "Prefer plain, alive sentences over polished art-writing.",
  "Name what changed, what caught attention, what interrupted the flow, or why the frame mattered in the walk or ride.",
  "Avoid filler like 'it feels like', 'it reads like', 'ordinary moment', 'briefly theatrical', 'quietly falls back', or other vague mood-writing that could fit any photo.",
  "Avoid sounding impressed with your own writing. Keep it grounded and human.",
].join("\n");

const VOICE_EXAMPLES = [
  "Good voice examples:",
  "- 'First frame where this goose stopped being background and started being a character. It just stood there and stared me down.'",
  "- 'Same goose a few seconds later, now walking straight at me. Neck out, one foot up, no hesitation.'",
  "- 'A goldendoodle puppy clocked the camera for half a second and kept moving. The crushed dandelions on the pavement made the frame.'",
  "- 'A bright scarf cuts through the softer tones of the street as the subject moves past the bridge. Images like this were part of the challenge and fun of the day: noticing a fleeting detail, reacting quickly, and still keeping the frame clean.'",
  "Bad voice examples:",
  "- 'A bright scarf drifts through the muted street like a quick change in weather, turning an ordinary moment by the bridge into something briefly theatrical.'",
  "- 'It feels like the kind of fleeting street moment this session was chasing.'",
  "- 'It reads like the quiet beat just before the mood of the set turns more confrontational.'",
].join("\n");

type SuggestionSource = "copilot-cli" | "ai-api" | "heuristic";

function runCommand(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: env || process.env,
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
        new Error((stderr || stdout || `${command} exited with code ${code}`).trim())
      );
    });
  });
}

function runPhotoIngest(args: string[]) {
  return runCommand(process.execPath, [PHOTO_INGEST_SCRIPT, ...args], process.env);
}

function makeTempManifestPath(prefix: string) {
  return join(tmpdir(), `${prefix}-${Date.now()}.json`);
}

function makeTempPreviewPath(prefix: string) {
  return join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
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
    const [, driveLetter = "", remainder = ""] = windowsDriveMatch;
    const drive = driveLetter.toLowerCase();
    const rest = remainder
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

function collectAccessibleDirs(manifest: StudioManifest) {
  const directories = new Set<string>();

  for (const rawPhoto of manifest.photos || []) {
    const photo = rawPhoto as Record<string, any>;
    const sourcePath = normalizeStudioPath(String(photo.sourcePath || ""));

    if (sourcePath) {
      directories.add(dirname(sourcePath));
    }

    if (Array.isArray(photo.motionFrameSourcePaths)) {
      for (const rawPath of photo.motionFrameSourcePaths) {
        const motionPath = normalizeStudioPath(String(rawPath || ""));
        if (motionPath) {
          directories.add(dirname(motionPath));
        }
      }
    }
  }

  return [...directories];
}

function collectAccessibleDirsForPhoto(photo: Record<string, any>) {
  const manifestLike: StudioManifest = { photos: [photo] };
  return collectAccessibleDirs(manifestLike);
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

  const [, token = "", baseStem = ""] = match;

  return {
    token: token.toLowerCase(),
    baseStem,
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
    if (!middle) {
      continue;
    }

    const matchingBaseKey = `${dirname(middle.sourcePath || "")}:${String(middle.__momentBaseStem || "")}`.toLowerCase();
    const basePhoto = byBaseStem.get(matchingBaseKey);
    const heroPhoto = basePhoto || middle;

    if (!heroPhoto) {
      continue;
    }

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

function normalizeSuggestedTags(tags: unknown, fallbackTags: unknown) {
  const values = Array.isArray(tags) && tags.length ? tags : Array.isArray(fallbackTags) ? fallbackTags : [];
  return [...new Set(values.map((tag) => slugify(String(tag || ""))).filter(Boolean))];
}

function buildStoryAwarePayload(photo: Record<string, any>, sourcePath: string): StoryAwarePhotoPayload {
  return {
    sourcePath,
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
    existingTags: Array.isArray(photo.tags) ? photo.tags : [],
  };
}

function ensureUniqueSuggestionTitles(suggestions: AiSuggestion[]) {
  const seen = new Map<string, number>();

  return suggestions.map((suggestion) => {
    const normalized = slugify(String(suggestion.title || ""));

    if (!normalized) {
      return suggestion;
    }

    const count = seen.get(normalized) || 0;
    seen.set(normalized, count + 1);

    if (count === 0) {
      return suggestion;
    }

    return {
      ...suggestion,
      title: `${suggestion.title} ${count + 1}`,
    } satisfies AiSuggestion;
  });
}

function buildStoryBrief(storyContext: Record<string, string>) {
  const journeySummary = String(storyContext.journeySummary || "").trim();
  const setNotes = String(storyContext.setNotes || "").trim();
  const captionTone = String(storyContext.captionTone || "").trim();
  const privacyNotes = String(storyContext.privacyNotes || "").trim();

  return [
    journeySummary ? `Journey summary: ${journeySummary}` : "Journey summary: none provided.",
    setNotes ? `Additional notes: ${setNotes}` : "Additional notes: none provided.",
    captionTone ? `Caption tone: ${captionTone}` : "Caption tone: direct, personal, sequence-aware, and specific.",
    privacyNotes ? `Privacy constraints: ${privacyNotes}` : "Privacy constraints: do not infer identity, motives, relationships, or sensitive personal details.",
  ].join("\n");
}

async function createImagePreview(sourcePath: string) {
  const previewPath = makeTempPreviewPath("photo-ingest-preview");
  const pythonScript = [
    "from PIL import Image, ImageOps",
    "import sys",
    "source_path = sys.argv[1]",
    "preview_path = sys.argv[2]",
    "max_dimension = int(sys.argv[3])",
    "with Image.open(source_path) as image:",
    "    image = ImageOps.exif_transpose(image)",
    "    if image.mode not in ('RGB', 'L'):",
    "        image = image.convert('RGB')",
    "    elif image.mode == 'L':",
    "        image = image.convert('RGB')",
    "    image.thumbnail((max_dimension, max_dimension))",
    "    image.save(preview_path, format='JPEG', quality=82, optimize=True)",
  ].join("\n");

  await runCommand("python3", ["-c", pythonScript, sourcePath, previewPath, "1600"]);
  return previewPath;
}

function extractJsonObject(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Copilot returned an empty response.");
  }

  try {
    return JSON.parse(trimmed) as { photos?: AiSuggestion[] };
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`Copilot did not return JSON: ${trimmed.slice(0, 240)}`);
    }

    return JSON.parse(trimmed.slice(start, end + 1)) as { photos?: AiSuggestion[] };
  }
}

function parseCopilotJsonOutput(stdout: string) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let finalContent = "";

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        data?: { content?: string; deltaContent?: string };
      };

      if (entry.type === "assistant.message" && entry.data?.content) {
        finalContent = entry.data.content;
      }
    } catch {
      continue;
    }
  }

  if (!finalContent) {
    throw new Error(`Copilot JSON output did not include a final assistant message.`);
  }

  return extractJsonObject(finalContent);
}

function buildCopilotPhotoPrompt(photo: Record<string, any>, storyContext: Record<string, string>, previewPath: string) {
  const sourcePath = normalizeStudioPath(String(photo.sourcePath || ""));
  const storyBrief = buildStoryBrief(storyContext);
  const payload = {
    ...buildStoryAwarePayload(photo, sourcePath),
    previewPath,
  };

  return [
    `Inspect the JPEG preview image file at ${previewPath}.`,
    `The original file path is ${sourcePath}. Return that original sourcePath in the JSON response, not the preview path.`,
    "Use the visible contents of the image as the primary source of truth.",
    "Use the narrative brief below as the creative brief for what the image is really about.",
    "The brief should control emphasis, mood, and wording whenever it fits the visible image.",
    "Match the writing voice guide below.",
    "Treat privacy constraints as hard rules.",
    "Only use metadata and story notes as supporting context.",
    "Return only valid JSON with this exact shape:",
    '{"photos":[{"sourcePath":"string","title":"string","description":"string","tags":["tag"]}]}',
    "Do not include markdown fences, prose, or extra keys.",
    "Rules:",
    "- The title must be story-led, not an object inventory.",
    "- Do NOT write titles like 'Sunglasses Between Station Gates', 'Sunglasses and canned drink between transit gates', 'Black coat and sunglasses at the ticket gates', or any other noun list based on visible objects.",
    "- A good title should feel like something I would actually call the frame later: simple, alive, and shaped by the journey.",
    "- Use one visual anchor at most, and only if it helps the story. Do not stack multiple visible objects into the title.",
    "- The description should be 1-3 sentences and should connect what is visible to why this frame matters inside the story brief.",
    "- When the journey notes support it, describe where this frame sits in the sequence: an arrival, pause, glance, interruption, approach, wait, crossing, or afterthought.",
    "- Prefer direct, natural wording over polished or literary phrasing.",
    "- If first person fits the journey notes, use it naturally instead of writing from a detached narrator voice.",
    "- Never invent names, emotions, motives, or story facts that are not visible or explicitly provided.",
    "- Let the journey summary and additional notes actively shape the interpretation and emphasis.",
    "- Let caption tone shape the phrasing of both title and description.",
    "- Obey privacy constraints even if the image seems to imply more.",
    "- Tags must be short, lower-case, and hyphenated when needed.",
    "- Avoid generic tags that just restate the medium unless they are actually useful.",
    "- Preserve sourcePath exactly.",
    "- If you cannot visually inspect the file, return {\"photos\":[]} instead of guessing.",
    "Bad title examples:",
    "- Sunglasses Between Station Gates",
    "- Black coat and sunglasses at the ticket gates",
    "- Cyclist with headphones",
    "Better title examples:",
    "- Waiting at the Gates",
    "- Between Departures",
    "- Riding Through Her Own Soundtrack",
    "Writing voice guide:",
    VOICE_RULES,
    VOICE_EXAMPLES,
    "Narrative brief:",
    storyBrief,
    `Photo: ${JSON.stringify(payload)}`,
  ].join("\n");
}

function buildCopilotBatchPrompt(
  storyContext: Record<string, string>,
  photos: StoryAwarePhotoPayload[],
  suggestions: AiSuggestion[]
) {
  const storyBrief = buildStoryBrief(storyContext);

  return [
    "You are refining photo metadata for a single batch so the journey notes actually shape the final result.",
    "Match the writing voice guide below. The final copy should sound like the photographer's own notes after the walk, not polished gallery text.",
    "Return only valid JSON with this exact shape:",
    '{"photos":[{"sourcePath":"string","title":"string","description":"string","tags":["tag"]}]}',
    "Do not include markdown fences, prose, or extra keys.",
    "Rules:",
    "- Treat the narrative brief as the primary editorial direction for the whole batch.",
    "- Rewrite the suggestions so the batch reads like a coherent sequence of related moments, not isolated object labels.",
    "- Every title must be unique across the batch.",
    "- If several images belong to the same scene, each title should represent a distinct beat, gesture, interruption, or shift in attention.",
    "- Do not repeat the same phrase across multiple titles or descriptions.",
    "- Avoid literal inventory titles and generic captions.",
    "- Keep titles story-led and grounded in the image, using the brief to decide what matters.",
    "- Descriptions should connect the visible image to its role in the journey or sequence.",
    "- Make the sequence feel lived, observed, and personal rather than polished or literary.",
    "- If the draft sounds like generic art-writing, rewrite it into plainer, sharper language.",
    "- Use first person naturally when the journey notes make that the right voice.",
    "Writing voice guide:",
    VOICE_RULES,
    VOICE_EXAMPLES,
    "Narrative brief:",
    storyBrief,
    `Photos: ${JSON.stringify(photos)}`,
    `Draft suggestions to refine: ${JSON.stringify(suggestions)}`,
  ].join("\n");
}

async function refineCopilotBatchSuggestions(manifest: StudioManifest, suggestions: AiSuggestion[]) {
  const storyContext = manifest.storyContext || {};
  const photos = (manifest.photos || []).map((rawPhoto) => {
    const photo = rawPhoto as Record<string, any>;
    const sourcePath = normalizeStudioPath(String(photo.sourcePath || ""));
    return buildStoryAwarePayload(photo, sourcePath);
  });

  const cliResult = await runCommand("copilot", [
    "-p",
    buildCopilotBatchPrompt(storyContext, photos, suggestions),
    "--allow-all-tools",
    "--allow-all-paths",
    "--no-ask-user",
    "--output-format",
    "json",
    "--silent",
  ]);

  const parsed = parseCopilotJsonOutput(cliResult.stdout);
  return ensureUniqueSuggestionTitles(parsed.photos || suggestions);
}

async function buildCopilotCliSuggestions(manifest: StudioManifest) {
  const storyContext = manifest.storyContext || {};
  const suggestions: AiSuggestion[] = [];

  for (const rawPhoto of manifest.photos || []) {
    const photo = rawPhoto as Record<string, any>;
    const sourcePath = normalizeStudioPath(String(photo.sourcePath || ""));
    const previewPath = await createImagePreview(sourcePath);
    const accessibleDirs = [...new Set([dirname(previewPath), ...collectAccessibleDirsForPhoto(photo)])];
    const cliResult = await runCommand("copilot", [
      "-p",
      buildCopilotPhotoPrompt(photo, storyContext, previewPath),
      ...accessibleDirs.flatMap((directory) => ["--add-dir", directory]),
      "--allow-all-tools",
      "--allow-all-paths",
      "--no-ask-user",
      "--output-format",
      "json",
      "--silent",
    ]);
    const parsed = parseCopilotJsonOutput(cliResult.stdout);
    const suggestion = parsed.photos?.find((item) => item.sourcePath === photo.sourcePath);

    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return await refineCopilotBatchSuggestions(manifest, suggestions);
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
  const storyContext = manifest.storyContext || {};

  try {
    const parsed = await buildCopilotCliSuggestions(manifest);
    return {
      suggestions: parsed,
      source: "copilot-cli" as const,
    };
  } catch (cliError) {
    const config = useRuntimeConfig(event);
    const apiKey = config.photoIngestAiApiKey as string | undefined;
    const baseUrl = config.photoIngestAiBaseUrl as string | undefined;
    const model = config.photoIngestAiModel as string | undefined;

    if (!apiKey || !baseUrl || !model) {
      throw new Error(
        cliError instanceof Error
          ? `Copilot CLI failed: ${cliError.message}`
          : "Copilot CLI failed."
      );
    }

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
            content: "You are helping prepare a photography ingest manifest. Return only JSON with a top-level photos array. Each item must include sourcePath, title, description, and tags. Make the writing sound like the photographer's own notes after the walk: direct, specific, lived-in, and grounded. Avoid gallery-speak, filler phrases, or generic art-writing. Let the journey notes shape the sequence and wording whenever they fit the visible image.",
          },
          {
            role: "user",
            content: JSON.stringify({
              storyContext,
              photos: (manifest.photos || []).map((rawPhoto) => {
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
              }),
            }),
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

    const parsed = JSON.parse(content) as { photos?: AiSuggestion[] };
    return {
      suggestions: parsed.photos || [],
      source: "ai-api" as const,
    };
  }
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
  let fallbackDetail = "";

  try {
    const aiResult = await buildAiSuggestions(event, heuristicManifest);
    const aiSuggestions = aiResult.suggestions;

    if (!aiSuggestions?.length) {
      return {
        manifest: heuristicManifest,
        source: "heuristic" as const,
        detail: "AI returned no suggestions, so heuristic metadata was kept.",
      };
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
      const previousSlugs = Array.isArray(photo.previousSlugs) ? photo.previousSlugs.map((value) => String(value || "")).filter(Boolean) : [];
      const nextSlug = slugify(title) || photo.slug || `photo-${index + 1}`;
      return {
        ...photo,
        title,
        slug: nextSlug,
        previousSlugs: [...new Set([
          ...previousSlugs,
          photo.slug && photo.slug !== nextSlug ? String(photo.slug) : "",
        ].filter(Boolean))],
        description: suggestion.description || photo.description,
        tags: normalizeSuggestedTags(suggestion.tags, photo.tags),
      };
    });

    return { manifest: heuristicManifest, source: aiResult.source };
  } catch (error) {
    fallbackDetail = error instanceof Error ? error.message : "AI suggestion failed.";
    return { manifest: heuristicManifest, source: "heuristic" as const, detail: fallbackDetail };
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

export async function updateStudioManifestMetadata(event: H3Event, manifest: StudioManifest) {
  const client = getDirectusClient(event);

  if (!client) {
    throw new Error("Directus is not configured.");
  }

  const updates: Array<{ slug: string; title: string }> = [];

  for (const rawPhoto of manifest.photos || []) {
    const photo = rawPhoto as Record<string, any>;
    const targetPhotoSlug = String(photo.targetPhotoSlug || "").trim();

    if (targetPhotoSlug) {
      continue;
    }

    const slug = String(photo.slug || "").trim();
    const previousSlugs = Array.isArray(photo.previousSlugs)
      ? photo.previousSlugs.map((value) => slugify(String(value || ""))).filter(Boolean)
      : [];

    if (!slug) {
      continue;
    }

    const existing = await client.request(
      readItems("photos", {
        fields: ["id", "slug"] as never,
        filter: previousSlugs.length
          ? {
              _or: [
                { slug: { _eq: slug } },
                ...previousSlugs.map((previousSlug) => ({ slug: { _eq: previousSlug } })),
              ],
            }
          : {
              slug: {
                _eq: slug,
              },
            },
        limit: 1,
      })
    ) as Array<{ id: string | number; slug: string }>;

    if (!existing[0]?.id) {
      continue;
    }

    await client.request(
      updateItem("photos", existing[0].id, {
        title: String(photo.title || "").trim(),
        slug,
        description: String(photo.description || "").trim(),
        tags: Array.isArray(photo.tags) ? photo.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        published_at: photo.publishedAt || photo.takenAt || null,
        taken_at: photo.takenAt || null,
        location: photo.location || null,
        camera: photo.camera || null,
        lens: photo.lens || null,
        featured: Boolean(photo.featured),
      } as never)
    );

    updates.push({
      slug,
      title: String(photo.title || "").trim(),
    });
  }

  return {
    updatedCount: updates.length,
    updates,
    output: updates.length
      ? updates.map((item) => `Updated photo metadata: ${item.slug} -> ${item.title}`).join("\n")
      : "No uploaded photo records matched the current manifest slugs.",
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
      previousSlugs: Array.isArray(photo.previousSlugs)
        ? [...new Set(photo.previousSlugs.map((value) => slugify(String(value || ""))).filter(Boolean))]
        : [],
      title,
      slug: slug || `photo-${index + 1}`,
      description: String(photo.description || "").trim(),
      tags: Array.isArray(photo.tags)
        ? photo.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
      setSlugs: Array.isArray(photo.setSlugs)
        ? photo.setSlugs.map((tag) => slugify(String(tag))).filter(Boolean)
        : [],
      shots: Array.isArray(photo.shots)
        ? photo.shots.map((rawShot) => {
            const shot = rawShot as Record<string, any>;

            return {
              sourcePath: normalizeStudioPath(String(shot.sourcePath || "")),
              role: slugify(String(shot.role || "alternate")) || "alternate",
              title: String(shot.title || "").trim(),
              description: String(shot.description || "").trim(),
            };
          }).filter((shot) => shot.sourcePath)
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
