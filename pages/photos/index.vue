<script setup lang="ts">
  import { computed } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

  const { data: shell } = await useCmsShell();
  const { data, pending: photosPending } = await useAsyncData(
    "cms-photos",
    () => $fetch("/api/cms/photos"),
    {
      lazy: true,
      default: () => ({
        photos: [],
      }),
    }
  );
  const { data: setsData, pending: setsPending } = await useAsyncData(
    "cms-photosets",
    () => $fetch("/api/cms/photosets"),
    {
      lazy: true,
      default: () => ({ photosets: [] }),
    }
  );
  const { data: timelinesData, pending: timelinesPending } = await useAsyncData(
    "cms-timelines",
    () => $fetch("/api/cms/timelines"),
    {
      lazy: true,
      default: () => ({ timelines: [] }),
    }
  );

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const photos = computed(() => data.value.photos);
  const photosets = computed(() => setsData.value.photosets);
  const timelines = computed(() => timelinesData.value.timelines);
  const config = useRuntimeConfig();
  const showIngestStudio = computed(() => config.public.env === "development");
  const isArchiveLoading = computed(
    () => (photosPending.value || setsPending.value || timelinesPending.value) && !photos.value.length && !photosets.value.length && !timelines.value.length
  );
  const photoCount = computed(() => photos.value.length);
  const setCount = computed(() => photosets.value.length);
  const timelineCount = computed(() => timelines.value.length);
  const latestCapture = computed(() => {
    const values = photos.value
      .map((photo) => photo.takenAt || photo.publishedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(String(right)).getTime() - new Date(String(left)).getTime());

    return values[0] || null;
  });

  const photoSkeletons = Array.from({ length: 6 }, (_, index) => index);
  const setSkeletons = Array.from({ length: 3 }, (_, index) => index);

  useSeoMeta({
    title: computed(() => `${site.value.photosLabel} | ${site.value.siteName}`),
    description: computed(() => site.value.siteDescription),
  });

  function formatDate(value: string | null) {
    if (!value) return "Undated";

    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(new Date(value));
  }

  function formatDimensions(width: number | null | undefined, height: number | null | undefined) {
    if (!width || !height) return "Resolution pending";
    return `${width.toLocaleString()} × ${height.toLocaleString()}`;
  }

  function orientationLabel(width: number | null | undefined, height: number | null | undefined) {
    if (!width || !height) return "Unknown format";
    if (width === height) return "Square";
    return width > height ? "Landscape" : "Portrait";
  }

  function formatLocationLabel(photo: {
    location?: string | null;
    locationMeta?: { city?: string | null; country?: string | null; title?: string | null } | null;
  }) {
    if (photo.locationMeta?.city && photo.locationMeta?.country) {
      return `${photo.locationMeta.city}, ${photo.locationMeta.country}`;
    }

    return photo.locationMeta?.title || photo.location || "Location pending";
  }

  function formatMotionLabel(photo: { hasMotion?: boolean; motionFrameCount?: number | null }) {
    if (!photo.hasMotion) return null;

    const count = Number(photo.motionFrameCount || 0);
    return `Moment + ${count} frame${count !== 1 ? "s" : ""}`;
  }
</script>

<template>
  <main class="photo-page">
    <section class="photo-hero">
      <span class="photo-hero-kicker">Archive</span>
      <h1 data-directus-collection="site_settings" data-directus-item="1" data-directus-field="photos_label">{{ site.photosLabel }}</h1>
      <p>A living image archive for finished shots, experiments, travel frames, and whatever else deserves a permanent place.</p>

      <div class="photo-hero-actions">
        <NuxtLink to="/photos/timeline" class="photo-hero-action">
          Open timeline
        </NuxtLink>
        <NuxtLink v-if="showIngestStudio" to="/photos/upload" class="photo-hero-action photo-hero-action-secondary">
          Open ingest studio
        </NuxtLink>
      </div>

      <div class="photo-hero-stats">
        <div class="photo-hero-stat">
          <span class="photo-hero-stat-label">Photos</span>
          <strong>{{ photoCount }}</strong>
        </div>
        <div class="photo-hero-stat">
          <span class="photo-hero-stat-label">Sets</span>
          <strong>{{ setCount }}</strong>
        </div>
        <div class="photo-hero-stat">
          <span class="photo-hero-stat-label">Latest Capture</span>
          <strong>{{ formatDate(latestCapture) }}</strong>
        </div>
        <div class="photo-hero-stat">
          <span class="photo-hero-stat-label">Timelines</span>
          <strong>{{ timelineCount }}</strong>
        </div>
      </div>
    </section>

    <section v-if="timelinesPending || timelines.length" class="photo-sets-strip">
      <div class="photo-sets-head">
        <span class="photo-sets-label">Timelines</span>
        <span class="photo-sets-subtle">{{ timelinesPending && !timelines.length ? "Loading stories…" : "Story-led sequences that combine text and images." }}</span>
      </div>
      <div class="photo-sets-grid">
        <template v-if="timelines.length">
          <NuxtLink
            v-for="timeline in timelines"
            :key="timeline.id"
            :to="`/timelines/${timeline.slug}`"
            class="photo-set-thumb"
          >
            <div class="photo-set-thumb-image">
              <PhotoAsset
                v-if="timeline.coverImage"
                :src="timeline.coverImage.previewUrl || timeline.coverImage.url"
                :alt="timeline.coverImage.alt || timeline.title"
                aspect-ratio="4 / 3"
              />
              <div v-else class="photo-set-thumb-placeholder" />
            </div>
            <div class="photo-set-thumb-copy">
              <div class="photo-set-thumb-head">
                <span class="photo-set-thumb-title">{{ timeline.title }}</span>
                <span class="photo-set-thumb-count">{{ timeline.photoCount }} step{{ timeline.photoCount !== 1 ? 's' : '' }}</span>
              </div>
              <p>{{ timeline.description || timeline.story || "A curated timeline from the archive." }}</p>
            </div>
          </NuxtLink>
        </template>

        <template v-else>
          <div v-for="index in setSkeletons" :key="`timeline-${index}`" class="photo-set-thumb photo-set-thumb-skeleton" aria-hidden="true">
            <div class="photo-set-thumb-image">
              <div class="photo-skeleton-block photo-skeleton-image" />
            </div>
            <div class="photo-set-thumb-copy">
              <div class="photo-skeleton-block photo-skeleton-title" />
              <div class="photo-skeleton-block photo-skeleton-line" />
            </div>
          </div>
        </template>
      </div>
    </section>

    <section v-if="setsPending || photosets.length" class="photo-sets-strip">
      <div class="photo-sets-head">
        <span class="photo-sets-label">Sets</span>
        <span class="photo-sets-subtle">{{ setsPending && !photosets.length ? "Loading sequence…" : "Browse grouped stories and sessions." }}</span>
      </div>
      <div class="photo-sets-grid">
        <template v-if="photosets.length">
          <NuxtLink
            v-for="set in photosets"
            :key="set.id"
            :to="`/photosets/${set.slug}`"
            class="photo-set-thumb"
          >
            <div class="photo-set-thumb-image">
              <PhotoAsset
                v-if="set.coverImage"
                :src="set.coverImage.previewUrl || set.coverImage.url"
                :alt="set.coverImage.alt || set.title"
                aspect-ratio="4 / 3"
              />
              <div v-else class="photo-set-thumb-placeholder" />
            </div>
            <div class="photo-set-thumb-copy">
              <div class="photo-set-thumb-head">
                <span class="photo-set-thumb-title">{{ set.title }}</span>
                <span class="photo-set-thumb-count">{{ set.photoCount }} photo{{ set.photoCount !== 1 ? 's' : '' }}</span>
              </div>
              <p>{{ set.description || "A grouped run of photographs from the archive." }}</p>
            </div>
          </NuxtLink>
        </template>

        <template v-else>
          <div v-for="index in setSkeletons" :key="index" class="photo-set-thumb photo-set-thumb-skeleton" aria-hidden="true">
            <div class="photo-set-thumb-image">
              <div class="photo-skeleton-block photo-skeleton-image" />
            </div>
            <div class="photo-set-thumb-copy">
              <div class="photo-skeleton-block photo-skeleton-title" />
              <div class="photo-skeleton-block photo-skeleton-line" />
            </div>
          </div>
        </template>
      </div>
    </section>

    <section class="photo-grid-shell">
      <div class="photo-grid-head">
        <div>
          <span class="photo-grid-kicker">Browse</span>
          <h2>Single frames</h2>
        </div>
        <p>{{ isArchiveLoading ? "Loading the archive…" : "Open a frame for the full image, set context, and archive notes." }}</p>
      </div>

      <section v-if="photos.length" class="photo-grid">
        <article
          v-for="photo in photos"
          :key="photo.id"
          class="photo-card"
        >
          <div class="photo-card-image">
            <InteractivePhotoSurface
              :photo="photo"
              aspect-ratio="1 / 1"
              fit="cover"
              :detail-href="`/photos/${photo.slug}`"
            />
          </div>
          <div class="photo-card-copy">
            <div class="photo-card-eyebrow">
              <span class="photo-card-kind">{{ photo.hasMotion ? "Moment" : "Photo" }}</span>
              <span>{{ formatDate(photo.takenAt || photo.publishedAt) }}</span>
            </div>
            <div class="photo-card-head">
              <NuxtLink :to="`/photos/${photo.slug}`" class="photo-card-title-link">
                <h2>{{ photo.title }}</h2>
              </NuxtLink>
              <p class="photo-card-place">{{ formatLocationLabel(photo) }}</p>
            </div>
            <p class="photo-card-summary">{{ photo.description || "Open the photo page for the full frame and notes." }}</p>
            <div class="photo-card-meta">
              <span v-if="photo.hasMotion">{{ formatMotionLabel(photo) }}</span>
              <span>{{ orientationLabel(photo.image?.width, photo.image?.height) }}</span>
              <span>{{ formatDimensions(photo.image?.width, photo.image?.height) }}</span>
              <span v-if="photo.camera">{{ photo.camera }}</span>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="isArchiveLoading" class="photo-grid photo-grid-skeleton" aria-live="polite">
        <article v-for="index in photoSkeletons" :key="index" class="photo-card photo-card-skeleton" aria-hidden="true">
          <div class="photo-card-image">
            <div class="photo-skeleton-block photo-skeleton-image" />
          </div>
          <div class="photo-card-copy">
            <div class="photo-skeleton-block photo-skeleton-title" />
            <div class="photo-skeleton-block photo-skeleton-line" />
            <div class="photo-skeleton-block photo-skeleton-line photo-skeleton-line-short" />
          </div>
        </article>
      </section>

      <section v-else class="photo-empty">
        <h2>Nothing here yet</h2>
        <p>Check back soon.</p>
      </section>
    </section>
  </main>
</template>

<style scoped>
  .photo-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.11), transparent 34%),
      linear-gradient(180deg, #050608 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .photo-hero,
  .photo-sets-strip,
  .photo-grid-shell,
  .photo-empty {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .photo-hero-kicker,
  .photo-grid-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-hero h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .photo-hero p:last-child {
    max-width: 44rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #94a3b8;
  }

  .photo-hero-stats {
    display: grid;
    gap: 0.8rem;
    margin-top: 1.6rem;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .photo-hero-actions {
    margin-top: 1.25rem;
  }

  .photo-hero-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.6rem;
    padding: 0.7rem 1rem;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.08);
    color: #d1fae5;
    border: 1px solid rgba(74, 222, 128, 0.22);
    font-weight: 600;
  }

  .photo-hero-action-secondary {
    background: rgba(15, 23, 42, 0.58);
    color: #e2e8f0;
    border-color: rgba(148, 163, 184, 0.2);
  }

  .photo-hero-stat {
    padding: 1rem 1.05rem;
    border-radius: 1.15rem;
    border: 1px solid rgba(74, 222, 128, 0.16);
    background: rgba(8, 15, 10, 0.88);
    backdrop-filter: blur(14px);
  }

  .photo-hero-stat-label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-hero-stat strong {
    color: #f8fafc;
    font-family: "Syne", sans-serif;
    font-size: 1.25rem;
    line-height: 1.05;
  }

  .photo-sets-strip {
    margin-top: 2.5rem;
  }

  .photo-sets-head,
  .photo-grid-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
    flex-wrap: wrap;
  }

  .photo-sets-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-sets-subtle,
  .photo-grid-head p {
    color: #64748b;
    line-height: 1.7;
    max-width: 32rem;
  }

  .photo-sets-grid {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }

  .photo-set-thumb,
  .photo-card {
    overflow: hidden;
    border-radius: 1.3rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.3);
    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .photo-set-thumb:hover,
  .photo-card:hover {
    transform: translateY(-3px);
    border-color: rgba(134, 239, 172, 0.36);
    box-shadow: 0 30px 48px rgba(0, 0, 0, 0.34);
  }

  .photo-set-thumb-image,
  .photo-card-image {
    overflow: hidden;
    background: rgba(15, 23, 42, 0.5);
  }

  .photo-set-thumb-placeholder {
    aspect-ratio: 4 / 3;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(15, 23, 42, 0.8));
  }

  .photo-set-thumb-copy,
  .photo-card-copy {
    display: grid;
    gap: 0.75rem;
    padding: 1rem 1rem 1.1rem;
  }

  .photo-set-thumb-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.85rem;
    align-items: baseline;
    justify-content: space-between;
  }

  .photo-card-eyebrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-card-kind {
    display: inline-flex;
    align-items: center;
    padding: 0.24rem 0.5rem;
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.2);
    background: rgba(34, 197, 94, 0.12);
  }

  .photo-card-head {
    display: grid;
    gap: 0.3rem;
  }

  .photo-card-title-link:hover h2 {
    color: #86efac;
  }

  .photo-set-thumb-title,
  .photo-card-head h2,
  .photo-grid-head h2,
  .photo-empty h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.35rem;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: #f8fafc;
  }

  .photo-grid-head h2 {
    font-size: clamp(1.8rem, 3vw, 2.6rem);
  }

  .photo-set-thumb-count,
  .photo-card-head span {
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-set-thumb-copy p,
  .photo-empty p {
    line-height: 1.75;
    color: #cbd5e1;
  }

  .photo-card-place {
    font-size: 0.88rem;
    color: #94a3b8;
  }

  .photo-card-summary {
    line-height: 1.72;
    color: #cbd5e1;
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .photo-grid-shell {
    margin-top: 2.6rem;
  }

  .photo-grid {
    display: grid;
    gap: 1rem;
    margin-top: 1.2rem;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  }

  .photo-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .photo-card-meta span {
    font-size: 0.72rem;
    color: #d1fae5;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 999px;
    padding: 0.24rem 0.55rem;
  }

  .photo-empty {
    margin-top: 1.2rem;
    border-radius: 1.5rem;
    border: 1px dashed rgba(74, 222, 128, 0.24);
    background: rgba(8, 15, 10, 0.9);
    padding: 1.5rem;
  }

  .photo-skeleton-block {
    border-radius: 0.95rem;
    background:
      linear-gradient(110deg, rgba(148, 163, 184, 0.08) 8%, rgba(148, 163, 184, 0.18) 18%, rgba(148, 163, 184, 0.08) 33%);
    background-size: 200% 100%;
    animation: photo-page-shimmer 1.35s linear infinite;
  }

  .photo-skeleton-image {
    width: 100%;
    aspect-ratio: 1;
  }

  .photo-set-thumb-skeleton .photo-skeleton-image {
    aspect-ratio: 4 / 3;
  }

  .photo-skeleton-title {
    height: 1.25rem;
    width: 62%;
  }

  .photo-skeleton-line {
    height: 0.92rem;
    width: 100%;
  }

  .photo-skeleton-line-short {
    width: 74%;
  }

  @keyframes photo-page-shimmer {
    from {
      background-position: 200% 0;
    }

    to {
      background-position: -200% 0;
    }
  }

  @media (min-width: 980px) {
    .photo-page {
      padding-inline: 2rem;
    }
  }

  @media (max-width: 640px) {
    .photo-page {
      padding: 5.5rem 1rem 3rem;
    }

    .photo-hero-stats {
      grid-template-columns: 1fr;
    }
  }
</style>
