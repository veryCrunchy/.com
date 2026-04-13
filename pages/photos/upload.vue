<script setup lang="ts">
  import type { CmsPhotoSummary } from "~/types/directus";

  definePageMeta({
    middleware: [
      () => {
        // This page is dev-only. Redirect to home in any other environment.
        if (import.meta.env.MODE !== "development") {
          return navigateTo("/", { replace: true });
        }
      },
    ],
  });

  type IngestPhoto = {
    sourcePath: string;
    filename?: string;
    previousSlugs?: string[];
    targetPhotoSlug?: string;
    uiAttachToExisting?: boolean;
    title: string;
    slug: string;
    description: string;
    tags: string[];
    setSlugs: string[];
    motionFrameSourcePaths?: string[];
    location?: string | null;
    camera?: string | null;
    lens?: string | null;
    takenAt?: string | null;
  };

  type IngestSet = {
    slug: string;
    title: string;
    description?: string | null;
    tags: string[];
  };

  type IngestManifest = {
    storyContext?: {
      journeySummary?: string;
      setNotes?: string;
      captionTone?: string;
      privacyNotes?: string;
    };
    sets?: IngestSet[];
    photos?: IngestPhoto[];
  };

  type PersistedStudioState = {
    pathsText: string;
    manifest: IngestManifest | null;
    manifestPath: string | null;
    outputLog: string;
    suggestionSource: "heuristic" | "copilot-cli" | "ai-api" | null;
    suggestionDetail: string;
    completedAction: "prepare" | "suggest" | "upload" | "update" | "repair" | null;
  };

  const STUDIO_STORAGE_KEY = "photo-ingest-studio-state-v1";

  const pathsText = ref("");
  const manifest = ref<IngestManifest | null>(null);
  const manifestPath = ref<string | null>(null);
  const busyAction = ref<"prepare" | "suggest" | "upload" | "update" | "repair" | null>(null);
  const outputLog = ref("");
  const suggestionSource = ref<"heuristic" | "copilot-cli" | "ai-api" | null>(null);
  const suggestionDetail = ref("");
  const errorMessage = ref("");
  const completedAction = ref<"prepare" | "suggest" | "upload" | "update" | "repair" | null>(null);
  const livePhotos = ref<CmsPhotoSummary[]>([]);
  const livePhotosLoaded = ref(false);
  const livePhotosLoading = ref(false);
  const livePhotosError = ref("");
  const hasRestoredState = ref(false);

  const photoCount = computed(() => manifest.value?.photos?.length || 0);
  const setCount = computed(() => manifest.value?.sets?.length || 0);
  const motionPhotoCount = computed(
    () => manifest.value?.photos?.filter((photo) => (photo.motionFrameSourcePaths || []).length > 0).length || 0
  );
  const statusMessage = computed(() => {
    if (busyAction.value === "prepare") {
      return "Preparing manifest and inspecting source files...";
    }

    if (busyAction.value === "suggest") {
      return "Generating metadata suggestions for the current manifest...";
    }

    if (busyAction.value === "upload") {
      return "Uploading files and updating Directus records...";
    }

    if (busyAction.value === "update") {
      return "Updating uploaded Directus photo metadata from the current manifest...";
    }

    if (busyAction.value === "repair") {
      return "Re-suggesting metadata from the current brief and patching uploaded Directus records...";
    }

    if (errorMessage.value) {
      return errorMessage.value;
    }

    if (completedAction.value === "prepare") {
      return "Manifest prepared. Review the cards, then suggest metadata or upload.";
    }

    if (completedAction.value === "suggest") {
      if (suggestionSource.value === "copilot-cli") {
        return "Copilot CLI suggestions applied. Review the copy before upload.";
      }

      if (suggestionSource.value === "ai-api") {
        return "AI API suggestions applied. Review the copy before upload.";
      }

      return suggestionDetail.value
        ? `Heuristic suggestions applied. ${suggestionDetail.value}`
        : "Heuristic suggestions applied. Review the copy before upload.";
    }

    if (completedAction.value === "upload") {
      return "Upload finished. Check the log below for validation and Directus results.";
    }

    if (completedAction.value === "update") {
      return "Uploaded photo metadata updated from the current manifest.";
    }

    if (completedAction.value === "repair") {
      return "Metadata was re-suggested and uploaded Directus photo records were patched.";
    }

    return "";
  });
  const statusTone = computed(() => {
    if (busyAction.value) {
      return "working";
    }

    if (errorMessage.value) {
      return "error";
    }

    if (completedAction.value) {
      return "success";
    }

    return "idle";
  });

  useSeoMeta({
    title: "Photo Ingest Studio | veryCrunchy",
    description: "Prepare, enrich, and upload photo manifests without leaving the browser.",
  });

  function createEmptyStoryContext() {
    return {
      journeySummary: "",
      setNotes: "",
      captionTone: "",
      privacyNotes: "",
    };
  }

  function clearPersistedStudioState() {
    if (!import.meta.client) {
      return;
    }

    localStorage.removeItem(STUDIO_STORAGE_KEY);
  }

  function persistStudioState() {
    if (!import.meta.client || !hasRestoredState.value) {
      return;
    }

    const payload: PersistedStudioState = {
      pathsText: pathsText.value,
      manifest: manifest.value,
      manifestPath: manifestPath.value,
      outputLog: outputLog.value,
      suggestionSource: suggestionSource.value,
      suggestionDetail: suggestionDetail.value,
      completedAction: completedAction.value,
    };

    localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(payload));
  }

  function restoreStudioState() {
    if (!import.meta.client) {
      return;
    }

    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    hasRestoredState.value = true;

    if (!raw) {
      return;
    }

    try {
      const payload = JSON.parse(raw) as Partial<PersistedStudioState>;
      pathsText.value = String(payload.pathsText || "");
      manifest.value = payload.manifest ? normalizeManifestShape(payload.manifest) : null;
      manifestPath.value = payload.manifestPath ? String(payload.manifestPath) : null;
      outputLog.value = String(payload.outputLog || "");
      suggestionSource.value = payload.suggestionSource || null;
      suggestionDetail.value = String(payload.suggestionDetail || "");
      completedAction.value = payload.completedAction || null;
    } catch {
      clearPersistedStudioState();
    }
  }

  function normalizeManifestShape(nextManifest: IngestManifest) {
    return {
      ...nextManifest,
      storyContext: {
        ...createEmptyStoryContext(),
        ...(nextManifest.storyContext || {}),
      },
      sets: Array.isArray(nextManifest.sets) ? nextManifest.sets : [],
      photos: Array.isArray(nextManifest.photos)
        ? nextManifest.photos.map((photo) => ({
            ...photo,
            previousSlugs: Array.isArray(photo.previousSlugs) ? photo.previousSlugs : [],
            tags: Array.isArray(photo.tags) ? photo.tags : [],
            setSlugs: Array.isArray(photo.setSlugs) ? photo.setSlugs : [],
            targetPhotoSlug: typeof photo.targetPhotoSlug === "string" ? photo.targetPhotoSlug : "",
            uiAttachToExisting: Boolean(photo.targetPhotoSlug),
            motionFrameSourcePaths: Array.isArray(photo.motionFrameSourcePaths)
              ? photo.motionFrameSourcePaths
              : [],
          }))
        : [],
    } satisfies IngestManifest;
  }

  onMounted(() => {
    restoreStudioState();
  });

  watch(
    [pathsText, manifest, manifestPath, outputLog, suggestionSource, suggestionDetail, completedAction],
    () => {
      persistStudioState();
    },
    { deep: true }
  );

  function splitCsv(value: string) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function tagsValue(photo: IngestPhoto) {
    return (photo.tags || []).join(", ");
  }

  function setSlugsValue(photo: IngestPhoto) {
    return (photo.setSlugs || []).join(", ");
  }

  function setTagsValue(setDefinition: IngestSet) {
    return (setDefinition.tags || []).join(", ");
  }

  function motionFramesValue(photo: IngestPhoto) {
    return (photo.motionFrameSourcePaths || []).join("\n");
  }

  function isAttachToExisting(photo: IngestPhoto) {
    return Boolean(photo.uiAttachToExisting);
  }

  function setAttachMode(photo: IngestPhoto, enabled: boolean) {
    photo.uiAttachToExisting = enabled;

    if (!enabled) {
      photo.targetPhotoSlug = "";
    }
  }

  function findLivePhoto(slug: string | undefined) {
    const normalized = String(slug || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return livePhotos.value.find((photo) => photo.slug.toLowerCase() === normalized) || null;
  }

  function formatLivePhotoLabel(photo: CmsPhotoSummary) {
    const bits = [photo.title, photo.slug];

    if (photo.takenAt || photo.publishedAt) {
      bits.push(new Date(photo.takenAt || photo.publishedAt || "").toLocaleDateString("en", { dateStyle: "medium" }));
    }

    if (photo.location) {
      bits.push(photo.location);
    }

    return bits.filter(Boolean).join(" · ");
  }

  async function loadLivePhotos() {
    if (livePhotosLoading.value) {
      return;
    }

    livePhotosLoading.value = true;
    livePhotosError.value = "";

    try {
      const response = await $fetch<{ photos: CmsPhotoSummary[] }>("/api/cms/photos");
      livePhotos.value = response.photos || [];
      livePhotosLoaded.value = true;
    } catch (error) {
      livePhotosError.value = error instanceof Error ? error.message : "Failed to load live photos.";
    } finally {
      livePhotosLoading.value = false;
    }
  }

  function setMotionFramesValue(photo: IngestPhoto, value: string) {
    photo.motionFrameSourcePaths = value
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function sourceLabel(photo: IngestPhoto) {
    return photo.filename || photo.sourcePath.split("/").pop() || photo.sourcePath;
  }

  function availableMotionCandidates(currentPhoto: IngestPhoto) {
    return (manifest.value?.photos || []).filter((photo) => photo.sourcePath !== currentPhoto.sourcePath);
  }

  function addPreparedPhotoAsMotionFrame(targetPhoto: IngestPhoto, sourcePath: string) {
    const current = new Set(targetPhoto.motionFrameSourcePaths || []);
    current.add(sourcePath);
    targetPhoto.motionFrameSourcePaths = [...current];
  }

  function clearMotionFrames(photo: IngestPhoto) {
    photo.motionFrameSourcePaths = [];
  }

  function removePhoto(index: number) {
    if (!manifest.value?.photos) {
      return;
    }

    manifest.value.photos.splice(index, 1);
  }

  async function prepareManifest() {
    busyAction.value = "prepare";
    errorMessage.value = "";
    suggestionSource.value = null;
    suggestionDetail.value = "";
    completedAction.value = null;

    try {
      const response = await $fetch<{ manifestPath: string; manifest: IngestManifest; output: string }>("/api/cms/photo-ingest/prepare", {
        method: "POST",
        body: { pathsText: pathsText.value },
      });

      manifestPath.value = response.manifestPath;
      manifest.value = normalizeManifestShape(response.manifest);
      outputLog.value = response.output;
      completedAction.value = "prepare";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Failed to prepare manifest.";
    } finally {
      busyAction.value = null;
    }
  }

  async function suggestManifest() {
    if (!manifest.value) return;

    busyAction.value = "suggest";
    errorMessage.value = "";
    completedAction.value = null;
    suggestionDetail.value = "";

    try {
      const response = await $fetch<{
        manifest: IngestManifest;
        source: "heuristic" | "copilot-cli" | "ai-api";
        detail?: string;
      }>("/api/cms/photo-ingest/suggest", {
        method: "POST",
        body: { manifest: manifest.value },
      });

      manifest.value = normalizeManifestShape(response.manifest);
      suggestionSource.value = response.source;
      suggestionDetail.value = response.detail || "";
      outputLog.value = response.source === "copilot-cli"
        ? "Applied metadata suggestions via Copilot CLI."
        : response.source === "ai-api"
          ? "Applied metadata suggestions via AI API."
          : response.detail
            ? `Applied heuristic metadata suggestions. ${response.detail}`
            : "Applied heuristic metadata suggestions.";
      completedAction.value = "suggest";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Failed to suggest metadata.";
    } finally {
      busyAction.value = null;
    }
  }

  async function uploadManifest() {
    if (!manifest.value) return;

    busyAction.value = "upload";
    errorMessage.value = "";
    suggestionDetail.value = "";
    completedAction.value = null;

    try {
      const response = await $fetch<{ manifestPath: string; validation: string; output: string }>("/api/cms/photo-ingest/upload", {
        method: "POST",
        body: { manifest: manifest.value },
      });

      manifestPath.value = response.manifestPath;
      outputLog.value = [response.validation, response.output].filter(Boolean).join("\n\n");
      completedAction.value = "upload";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Upload failed.";
    } finally {
      busyAction.value = null;
    }
  }

  async function updateUploadedMetadata() {
    if (!manifest.value) return;

    busyAction.value = "update";
    errorMessage.value = "";
    completedAction.value = null;

    try {
      const response = await $fetch<{ updatedCount: number; output: string }>("/api/cms/photo-ingest/update", {
        method: "POST",
        body: { manifest: manifest.value },
      });

      outputLog.value = response.output;
      completedAction.value = "update";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Metadata update failed.";
    } finally {
      busyAction.value = null;
    }
  }

  async function repairUploadedMetadata() {
    if (!manifest.value) return;

    busyAction.value = "repair";
    errorMessage.value = "";
    completedAction.value = null;
    suggestionDetail.value = "";

    try {
      const suggestResponse = await $fetch<{
        manifest: IngestManifest;
        source: "heuristic" | "copilot-cli" | "ai-api";
        detail?: string;
      }>("/api/cms/photo-ingest/suggest", {
        method: "POST",
        body: { manifest: manifest.value },
      });

      manifest.value = normalizeManifestShape(suggestResponse.manifest);
      suggestionSource.value = suggestResponse.source;
      suggestionDetail.value = suggestResponse.detail || "";

      const updateResponse = await $fetch<{ updatedCount: number; output: string }>("/api/cms/photo-ingest/update", {
        method: "POST",
        body: { manifest: manifest.value },
      });

      outputLog.value = [
        suggestResponse.source === "copilot-cli"
          ? "Applied metadata suggestions via Copilot CLI."
          : suggestResponse.source === "ai-api"
            ? "Applied metadata suggestions via AI API."
            : suggestResponse.detail
              ? `Applied heuristic metadata suggestions. ${suggestResponse.detail}`
              : "Applied heuristic metadata suggestions.",
        updateResponse.output,
      ].filter(Boolean).join("\n\n");
      completedAction.value = "repair";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Repair failed.";
    } finally {
      busyAction.value = null;
    }
  }
</script>

<template>
  <main class="ingest-page">
    <section class="ingest-shell">
      <header class="ingest-hero">
        <span class="ingest-kicker">Studio</span>
        <h1>Photo Ingest Studio</h1>
        <p>Path-based ingest over the existing manifest workflow. Prepare a batch, add metadata suggestions, make edits, then upload without dropping back to the terminal.</p>
        <div class="ingest-hero-notes">
          <div class="ingest-hero-note">
            <strong>Stills</strong>
            <span>Prepare paths, tune copy, assign sets, then upload.</span>
          </div>
          <div class="ingest-hero-note">
            <strong>Motion</strong>
            <span>Files named like <strong>moment_*</strong>, <strong>moment2_*</strong>, <strong>moment3_*</strong>, or <strong>moment4_*</strong> are auto-grouped during prepare. You can still adjust the motion frame list afterward.</span>
          </div>
        </div>
      </header>

      <section class="ingest-panel">
        <label class="ingest-label" for="paths">Absolute file paths</label>
        <textarea
          id="paths"
          v-model="pathsText"
          class="ingest-textarea"
          placeholder="C:\Users\yarod\Pictures\Untitled Session\Output\moment2_DSCF5701.tif&#10;/mnt/f/Cam/Edited/moment1_DSCF6432.tif"
        />
        <div class="ingest-actions">
          <button type="button" class="ingest-button ingest-button--primary" :disabled="busyAction !== null" @click="prepareManifest">
            {{ busyAction === "prepare" ? "Preparing…" : "Prepare manifest" }}
          </button>
          <button type="button" class="ingest-button" :disabled="!manifest || busyAction !== null" @click="suggestManifest">
            {{ busyAction === "suggest" ? "Suggesting…" : "Suggest metadata" }}
          </button>
          <button type="button" class="ingest-button" :disabled="!manifest || busyAction !== null" @click="uploadManifest">
            {{ busyAction === "upload" ? "Uploading…" : "Upload batch" }}
          </button>
          <button type="button" class="ingest-button ingest-button--ghost" :disabled="!manifest || busyAction !== null" @click="updateUploadedMetadata">
            {{ busyAction === "update" ? "Updating metadata…" : "Update uploaded metadata" }}
          </button>
          <button type="button" class="ingest-button ingest-button--ghost" :disabled="!manifest || busyAction !== null" @click="repairUploadedMetadata">
            {{ busyAction === "repair" ? "Repairing uploaded metadata…" : "Re-suggest and patch uploaded" }}
          </button>
        </div>
        <div v-if="statusMessage" class="ingest-status" :class="`ingest-status--${statusTone}`" aria-live="polite">
          <span v-if="busyAction" class="ingest-status-spinner" aria-hidden="true" />
          <span class="ingest-status-copy">{{ statusMessage }}</span>
        </div>
        <p class="ingest-note">This is intentionally local-first. It uses the same server environment and Directus token as the existing ingest scripts.</p>
        <p class="ingest-note">Studio state is saved locally in this browser, so the current manifest and AI brief come back after refresh.</p>
        <p class="ingest-note">Windows drive paths like <strong>C:\Users\...</strong> are converted to WSL mount paths automatically during prepare and upload.</p>
        <p class="ingest-note">For motion images, the main photo stays in <code>sourcePath</code>. Extra sequence frames go in the motion frame list on that photo card.</p>
        <p class="ingest-note">If the still image already exists in Directus, set an existing photo slug on the card and the upload will attach or replace motion frames on that record without replacing the main image.</p>
        <div class="ingest-live-tools">
          <button type="button" class="ingest-button ingest-button--ghost" :disabled="livePhotosLoading" @click="loadLivePhotos">
            {{ livePhotosLoading ? "Loading live photos…" : livePhotosLoaded ? `Reload live photos (${livePhotos.length})` : "Load live photos" }}
          </button>
          <p class="ingest-note">Load the live archive once, then use attach mode on a card to pick an existing photo by slug or from browser autocomplete.</p>
        </div>
        <p v-if="livePhotosError" class="ingest-error">{{ livePhotosError }}</p>
        <p v-if="suggestionSource" class="ingest-note">
          Suggestion source:
          <strong>{{ suggestionSource }}</strong>
          <template v-if="suggestionDetail"> · {{ suggestionDetail }}</template>
        </p>
        <p v-if="manifestPath" class="ingest-note">Manifest path: {{ manifestPath }}</p>
        <p v-if="errorMessage" class="ingest-error">{{ errorMessage }}</p>
        <pre v-if="outputLog" class="ingest-log">{{ outputLog }}</pre>
      </section>

      <template v-if="manifest">
        <section class="ingest-panel ingest-panel--compact">
          <div class="ingest-stats">
            <div>
              <span class="ingest-stat-label">Photos</span>
              <strong>{{ photoCount }}</strong>
            </div>
            <div>
              <span class="ingest-stat-label">Sets</span>
              <strong>{{ setCount }}</strong>
            </div>
            <div>
              <span class="ingest-stat-label">Motion Sequences</span>
              <strong>{{ motionPhotoCount }}</strong>
            </div>
          </div>

          <div class="ingest-brief-head">
            <div>
              <span class="ingest-label">AI Brief</span>
              <p class="ingest-section-note">
                Before suggesting metadata, give the model the story you want it to preserve. The AI now inspects each image individually, then combines what it sees with the brief below.
              </p>
            </div>
          </div>

          <div class="ingest-brief-prompts">
            <p class="ingest-note">What is happening here, or why does this frame matter?</p>
            <p class="ingest-note">What should the caption emphasize: atmosphere, motion, isolation, humor, tension, place, or something else?</p>
            <p class="ingest-note">Anything it should avoid saying or inferring?</p>
          </div>

          <div class="ingest-story-grid">
            <label>
              <span class="ingest-label">Journey summary</span>
              <textarea
                v-model="manifest.storyContext!.journeySummary"
                class="ingest-textarea ingest-textarea--small"
                placeholder="What is happening in this batch? What drew you to these frames?"
              />
            </label>
            <label>
              <span class="ingest-label">Set notes</span>
              <textarea
                v-model="manifest.storyContext!.setNotes"
                class="ingest-textarea ingest-textarea--small"
                placeholder="Shared motifs, recurring subjects, pacing, neighborhoods, or visual patterns"
              />
            </label>
            <label>
              <span class="ingest-label">Caption tone</span>
              <input
                v-model="manifest.storyContext!.captionTone"
                class="ingest-input"
                placeholder="Documentary, restrained, lyrical, clinical, deadpan, intimate"
              />
            </label>
            <label>
              <span class="ingest-label">Privacy notes</span>
              <textarea
                v-model="manifest.storyContext!.privacyNotes"
                class="ingest-textarea ingest-textarea--small"
                placeholder="Do not infer identity, age, relationship, intent, or any sensitive context"
              />
            </label>
          </div>
        </section>

        <section v-if="manifest.sets?.length" class="ingest-grid">
          <article v-for="setDefinition in manifest.sets" :key="setDefinition.slug" class="ingest-card">
            <span class="ingest-card-kicker">Set</span>
            <label>
              <span class="ingest-label">Title</span>
              <input v-model="setDefinition.title" class="ingest-input" />
            </label>
            <label>
              <span class="ingest-label">Slug</span>
              <input v-model="setDefinition.slug" class="ingest-input" />
            </label>
            <label>
              <span class="ingest-label">Description</span>
              <textarea v-model="setDefinition.description" class="ingest-textarea ingest-textarea--small" />
            </label>
            <label>
              <span class="ingest-label">Tags</span>
              <input :value="setTagsValue(setDefinition)" class="ingest-input" @input="setDefinition.tags = splitCsv(($event.target as HTMLInputElement).value)" />
            </label>
          </article>
        </section>

        <section class="ingest-grid">
          <article v-for="(photo, index) in manifest.photos" :key="photo.sourcePath" class="ingest-card">
            <div class="ingest-card-head">
              <div>
                <span class="ingest-card-kicker">Photo</span>
                <h2>{{ photo.title || photo.slug }}</h2>
              </div>
              <div class="ingest-card-actions">
                <button
                  type="button"
                  class="ingest-chip ingest-chip-button"
                  :class="{ 'ingest-chip--active': !isAttachToExisting(photo) }"
                  @click="setAttachMode(photo, false)"
                >
                  New photo
                </button>
                <button
                  type="button"
                  class="ingest-chip ingest-chip-button"
                  :class="{ 'ingest-chip--active': isAttachToExisting(photo) }"
                  @click="setAttachMode(photo, true)"
                >
                  Attach to live photo
                </button>
                <span v-if="photo.motionFrameSourcePaths?.length" class="ingest-chip">
                  {{ photo.motionFrameSourcePaths.length }} motion frame{{ photo.motionFrameSourcePaths.length !== 1 ? "s" : "" }}
                </span>
                <button type="button" class="ingest-chip ingest-chip-button ingest-chip-button--danger" @click="removePhoto(index)">
                  Remove card
                </button>
              </div>
            </div>
            <p class="ingest-source">{{ sourceLabel(photo) }}</p>
            <p class="ingest-source ingest-source-path">{{ photo.sourcePath }}</p>
            <div class="ingest-inline-meta">
              <span v-if="photo.location">{{ photo.location }}</span>
              <span v-if="photo.camera">{{ photo.camera }}</span>
              <span v-if="photo.lens">{{ photo.lens }}</span>
              <span v-if="photo.takenAt">{{ new Date(photo.takenAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) }}</span>
            </div>
            <section v-if="isAttachToExisting(photo)" class="ingest-attach-panel">
              <div class="ingest-section-head">
                <div>
                  <span class="ingest-label">Attach Motion To Existing Photo</span>
                  <p class="ingest-section-note">This mode leaves the existing photo’s title, slug, description, tags, and sets untouched. Only the motion frames are replaced.</p>
                </div>
                <button
                  v-if="!livePhotosLoaded"
                  type="button"
                  class="ingest-button ingest-button--ghost"
                  :disabled="livePhotosLoading"
                  @click="loadLivePhotos"
                >
                  {{ livePhotosLoading ? "Loading…" : "Load live photo list" }}
                </button>
              </div>
              <label>
                <span class="ingest-label">Existing photo slug</span>
                <input
                  v-model="photo.targetPhotoSlug"
                  list="ingest-live-photo-options"
                  class="ingest-input"
                  placeholder="existing-photo-slug"
                />
              </label>
              <datalist id="ingest-live-photo-options">
                <option v-for="livePhoto in livePhotos" :key="livePhoto.id" :value="livePhoto.slug">
                  {{ formatLivePhotoLabel(livePhoto) }}
                </option>
              </datalist>
              <div v-if="findLivePhoto(photo.targetPhotoSlug)" class="ingest-attach-match">
                <span class="ingest-helper-label">Matched live photo</span>
                <strong>{{ findLivePhoto(photo.targetPhotoSlug)?.title }}</strong>
                <span>{{ findLivePhoto(photo.targetPhotoSlug)?.slug }}</span>
                <span v-if="findLivePhoto(photo.targetPhotoSlug)?.takenAt || findLivePhoto(photo.targetPhotoSlug)?.publishedAt">
                  {{ new Date(findLivePhoto(photo.targetPhotoSlug)?.takenAt || findLivePhoto(photo.targetPhotoSlug)?.publishedAt || "").toLocaleDateString("en", { dateStyle: "medium" }) }}
                </span>
                <span v-if="findLivePhoto(photo.targetPhotoSlug)?.location">{{ findLivePhoto(photo.targetPhotoSlug)?.location }}</span>
              </div>
              <p v-else-if="photo.targetPhotoSlug && livePhotosLoaded" class="ingest-section-note ingest-section-note--warning">
                No loaded live photo matches that slug yet.
              </p>
            </section>
            <template v-else>
              <label>
                <span class="ingest-label">Title</span>
                <input v-model="photo.title" class="ingest-input" />
              </label>
              <label>
                <span class="ingest-label">Slug</span>
                <input v-model="photo.slug" class="ingest-input" />
              </label>
              <label>
                <span class="ingest-label">Description</span>
                <textarea v-model="photo.description" class="ingest-textarea ingest-textarea--small" />
              </label>
              <label>
                <span class="ingest-label">Tags</span>
                <input :value="tagsValue(photo)" class="ingest-input" @input="photo.tags = splitCsv(($event.target as HTMLInputElement).value)" />
              </label>
              <label>
                <span class="ingest-label">Set slugs</span>
                <input :value="setSlugsValue(photo)" class="ingest-input" @input="photo.setSlugs = splitCsv(($event.target as HTMLInputElement).value)" />
              </label>
            </template>
            <section class="ingest-motion-block">
              <div class="ingest-section-head">
                <div>
                  <span class="ingest-label">Motion frames</span>
                  <p class="ingest-section-note">Add one path per line. These files upload as sequence frames for this photo. When an existing photo slug is set, the motion sequence attaches to that existing photo record.</p>
                </div>
                <button type="button" class="ingest-button ingest-button--ghost" @click="clearMotionFrames(photo)">
                  Clear motion
                </button>
              </div>
              <textarea
                :value="motionFramesValue(photo)"
                class="ingest-textarea ingest-textarea--small ingest-textarea--code"
                placeholder="/mnt/f/Cam/Edited/moment1_DSCF6432.tif&#10;/mnt/f/Cam/Edited/moment1_DSCF6433.tif"
                @input="setMotionFramesValue(photo, ($event.target as HTMLTextAreaElement).value)"
              />
              <div v-if="availableMotionCandidates(photo).length" class="ingest-motion-helper">
                <span class="ingest-helper-label">Attach from prepared cards</span>
                <div class="ingest-motion-chips">
                  <button
                    v-for="candidate in availableMotionCandidates(photo)"
                    :key="`${photo.sourcePath}-${candidate.sourcePath}`"
                    type="button"
                    class="ingest-chip ingest-chip-button"
                    @click="addPreparedPhotoAsMotionFrame(photo, candidate.sourcePath)"
                  >
                    + {{ sourceLabel(candidate) }}
                  </button>
                </div>
                <p class="ingest-section-note">After attaching a prepared photo as a motion frame, remove that photo card if you do not want it uploaded as its own photo.</p>
              </div>
            </section>
          </article>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
  .ingest-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent 36%),
      linear-gradient(180deg, #040607 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .ingest-shell {
    width: min(100%, 76rem);
    margin: 0 auto;
  }

  .ingest-kicker,
  .ingest-card-kicker,
  .ingest-label,
  .ingest-stat-label {
    display: inline-flex;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #86efac;
  }

  .ingest-hero h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .ingest-hero p {
    max-width: 48rem;
    margin-top: 1rem;
    line-height: 1.8;
    color: #94a3b8;
  }

  .ingest-hero-notes {
    display: grid;
    gap: 0.9rem;
    margin-top: 1.2rem;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }

  .ingest-hero-note {
    display: grid;
    gap: 0.35rem;
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 222, 128, 0.16);
    background: rgba(8, 15, 10, 0.72);
  }

  .ingest-hero-note strong {
    color: #f0fdf4;
    font-size: 0.95rem;
  }

  .ingest-hero-note span {
    color: #94a3b8;
    line-height: 1.65;
  }

  .ingest-panel,
  .ingest-card {
    margin-top: 1.5rem;
    padding: 1.15rem;
    border-radius: 1.3rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.28);
  }

  .ingest-panel--compact {
    display: grid;
    gap: 1rem;
  }

  .ingest-textarea,
  .ingest-input {
    width: 100%;
    margin-top: 0.45rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(4, 6, 7, 0.7);
    color: #f8fafc;
    padding: 0.9rem 1rem;
  }

  .ingest-textarea {
    min-height: 10rem;
    resize: vertical;
  }

  .ingest-textarea--small {
    min-height: 7rem;
  }

  .ingest-textarea--code {
    font-family: "IBM Plex Mono", monospace;
    font-size: 0.84rem;
    line-height: 1.55;
  }

  .ingest-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .ingest-button {
    min-height: 2.8rem;
    padding: 0.72rem 1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.72);
    color: #e2e8f0;
    font-weight: 600;
    cursor: pointer;
  }

  .ingest-button--primary {
    border-color: rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.14);
    color: #dcfce7;
  }

  .ingest-button--ghost {
    min-height: 2.35rem;
    padding: 0.55rem 0.85rem;
    background: rgba(4, 6, 7, 0.58);
    font-size: 0.76rem;
  }

  .ingest-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ingest-note {
    margin-top: 0.85rem;
    color: #94a3b8;
    line-height: 1.7;
  }

  .ingest-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(4, 6, 7, 0.7);
  }

  .ingest-status--working {
    border-color: rgba(96, 165, 250, 0.24);
    background: rgba(30, 41, 59, 0.82);
    color: #dbeafe;
  }

  .ingest-status--success {
    border-color: rgba(74, 222, 128, 0.24);
    background: rgba(20, 83, 45, 0.28);
    color: #dcfce7;
  }

  .ingest-status--error {
    border-color: rgba(248, 113, 113, 0.24);
    background: rgba(127, 29, 29, 0.26);
    color: #fecaca;
  }

  .ingest-status-spinner {
    width: 0.95rem;
    height: 0.95rem;
    flex: 0 0 auto;
    border-radius: 50%;
    border: 2px solid rgba(191, 219, 254, 0.24);
    border-top-color: currentColor;
    animation: ingest-spin 0.7s linear infinite;
  }

  .ingest-status-copy {
    line-height: 1.55;
  }

  .ingest-live-tools {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
    margin-top: 0.85rem;
  }

  .ingest-error {
    margin-top: 0.85rem;
    color: #fca5a5;
  }

  .ingest-log {
    margin-top: 1rem;
    padding: 0.9rem 1rem;
    border-radius: 1rem;
    background: rgba(4, 6, 7, 0.74);
    color: #d1fae5;
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .ingest-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
  }

  .ingest-stats div {
    min-width: 10rem;
    padding: 0.85rem 0.95rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 222, 128, 0.16);
    background: rgba(4, 6, 7, 0.7);
  }

  .ingest-story-grid,
  .ingest-grid {
    display: grid;
    gap: 1rem;
    margin-top: 1.25rem;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  }

  .ingest-card {
    display: grid;
    gap: 0.85rem;
    margin-top: 0;
  }

  .ingest-card-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: start;
  }

  .ingest-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    justify-content: flex-end;
  }

  .ingest-card h2 {
    margin-top: 0.4rem;
    color: #f8fafc;
    font-family: "Syne", sans-serif;
    font-size: 1.5rem;
    line-height: 1.05;
  }

  .ingest-chip {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.12);
    color: #d1fae5;
    padding: 0.35rem 0.65rem;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ingest-chip--active {
    border-color: rgba(134, 239, 172, 0.34);
    background: rgba(34, 197, 94, 0.24);
    color: #f0fdf4;
  }

  .ingest-source,
  .ingest-inline-meta {
    color: #94a3b8;
    line-height: 1.7;
  }

  .ingest-source-path {
    margin-top: -0.45rem;
    font-family: "IBM Plex Mono", monospace;
    font-size: 0.76rem;
    word-break: break-all;
    color: #64748b;
  }

  .ingest-inline-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem 0.9rem;
  }

  .ingest-motion-block {
    display: grid;
    gap: 0.75rem;
    padding-top: 0.25rem;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  .ingest-attach-panel {
    display: grid;
    gap: 0.75rem;
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 222, 128, 0.18);
    background: rgba(34, 197, 94, 0.06);
  }

  .ingest-attach-match {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.75rem;
    align-items: center;
    color: #d1fae5;
  }

  .ingest-attach-match strong {
    color: #f0fdf4;
  }

  .ingest-section-note--warning {
    color: #fcd34d;
  }

  .ingest-section-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .ingest-section-note {
    margin-top: 0.25rem;
    color: #94a3b8;
    line-height: 1.6;
    font-size: 0.84rem;
  }

  .ingest-motion-helper {
    display: grid;
    gap: 0.55rem;
  }

  .ingest-helper-label {
    color: #cbd5e1;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .ingest-motion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .ingest-chip-button {
    cursor: pointer;
  }

  .ingest-chip-button--danger {
    border-color: rgba(248, 113, 113, 0.24);
    background: rgba(127, 29, 29, 0.16);
    color: #fecaca;
  }

  .ingest-chip-button:hover,
  .ingest-button:hover:not(:disabled) {
    border-color: rgba(134, 239, 172, 0.36);
    background: rgba(34, 197, 94, 0.14);
  }

  .ingest-chip-button--danger:hover {
    border-color: rgba(252, 165, 165, 0.36);
    background: rgba(127, 29, 29, 0.26);
  }

  @media (max-width: 720px) {
    .ingest-section-head,
    .ingest-card-head {
      flex-direction: column;
    }

    .ingest-card-actions {
      justify-content: start;
    }
  }

  @keyframes ingest-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
