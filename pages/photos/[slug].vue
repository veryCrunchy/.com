<script setup lang="ts">
  import { computed } from "vue";

  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const emptyPhoto = {
    id: "",
    slug: "",
    title: "",
    description: "",
    publishedAt: null,
    takenAt: null,
    location: null,
    camera: null,
    lens: null,
    tags: [],
    image: null,
    hasMotion: false,
    motionFrameCount: 0,
    sets: [],
    motionFrames: [],
  };

  const { data, pending } = await useAsyncData(
    () => `cms-photo-${slug.value}`,
    () => $fetch(`/api/cms/photos/${slug.value}`),
    {
      lazy: true,
      default: () => ({ photo: emptyPhoto }),
    }
  );

  const photo = computed(() => data.value.photo || emptyPhoto);

  const fromSet = computed(() => String(route.query.from || ""));

  const { data: setCtxData, pending: setPending } = await useAsyncData(
    () => (fromSet.value ? `cms-photoset-${fromSet.value}` : "__no-set-ctx__"),
    async () => {
      if (!fromSet.value) return null;
      return $fetch(`/api/cms/photosets/${fromSet.value}`);
    },
    {
      lazy: true,
      default: () => null,
    }
  );

  const setContext = computed(() => setCtxData.value?.photoset ?? null);
  const isLoading = computed(() => pending.value && !photo.value.id);

  const photoIndexInSet = computed(() => {
    if (!setContext.value?.photos) return -1;
    return setContext.value.photos.findIndex((p: { slug: string }) => p.slug === slug.value);
  });

  const prevInSet = computed(() => {
    if (photoIndexInSet.value <= 0) return null;
    return setContext.value!.photos[photoIndexInSet.value - 1];
  });

  const nextInSet = computed(() => {
    const idx = photoIndexInSet.value;
    if (idx === -1 || !setContext.value || idx >= setContext.value.photos.length - 1) return null;
    return setContext.value.photos[idx + 1];
  });

  const dimensionsLabel = computed(() => {
    const width = photo.value.image?.width;
    const height = photo.value.image?.height;

    if (!width || !height) return "Resolution pending";
    return `${width.toLocaleString()} × ${height.toLocaleString()}`;
  });

  const orientationLabel = computed(() => {
    const width = photo.value.image?.width;
    const height = photo.value.image?.height;

    if (!width || !height) return "Unknown format";
    if (width === height) return "Square frame";
    return width > height ? "Landscape frame" : "Portrait frame";
  });

  const locationLabel = computed(() => {
    const locationMeta = photo.value.locationMeta;

    if (locationMeta?.city && locationMeta?.country) {
      return `${locationMeta.city}, ${locationMeta.country}`;
    }

    return locationMeta?.title || photo.value.location || null;
  });

  const sequenceLabel = computed(() => {
    if (!photo.value.hasMotion) {
      return "Single frame";
    }

    const count = photo.value.motionFrameCount || 0;
    return `Moment sequence · ${count} motion frame${count !== 1 ? "s" : ""}`;
  });

  useSeoMeta({
    title: computed(() => `${photo.value.title || "Photo"} | Photos | veryCrunchy`),
    description: computed(
      () => photo.value.description || "Photography archive from veryCrunchy."
    ),
    ogTitle: computed(() => photo.value.title || "Photo"),
    ogDescription: computed(
      () => photo.value.description || "Photography archive from veryCrunchy."
    ),
    ogImage: computed(() => photo.value.image?.url || ""),
  });

  function formatDate(value: string | null) {
    if (!value) return "Undated";

    return new Intl.DateTimeFormat("en", {
      dateStyle: "long",
    }).format(new Date(value));
  }
</script>

<template>
  <main class="photo-entry-page">
    <section class="photo-entry-shell">
      <div class="photo-entry-topbar">
        <NuxtLink to="/photos" class="photo-entry-back">← Photos</NuxtLink>
        <nav v-if="setContext" class="photo-entry-set-nav">
          <NuxtLink
            v-if="prevInSet"
            :to="`/photos/${prevInSet.slug}?from=${fromSet}`"
            :title="prevInSet.title"
            class="set-nav-arrow"
          >←</NuxtLink>
          <span v-else class="set-nav-gap" />
          <NuxtLink :to="`/photosets/${setContext.slug}`" class="set-nav-pill">
            {{ setContext.title }}<span class="set-nav-count"> · {{ photoIndexInSet + 1 }} / {{ setContext.photos.length }}</span>
          </NuxtLink>
          <NuxtLink
            v-if="nextInSet"
            :to="`/photos/${nextInSet.slug}?from=${fromSet}`"
            :title="nextInSet.title"
            class="set-nav-arrow"
          >→</NuxtLink>
          <span v-else class="set-nav-gap" />
        </nav>
      </div>

      <div v-if="isLoading" class="photo-entry-skeleton" aria-live="polite">
        <div class="photo-entry-head photo-entry-head-skeleton">
          <div class="photo-skeleton-block photo-skeleton-kicker" />
          <div class="photo-skeleton-block photo-skeleton-title" />
          <div class="photo-skeleton-block photo-skeleton-line" />
          <div class="photo-skeleton-block photo-skeleton-line photo-skeleton-line-short" />
        </div>
        <div class="photo-entry-frame">
          <div class="photo-skeleton-block photo-skeleton-frame" />
        </div>
      </div>

      <template v-else>
        <header
          class="photo-entry-head"
          data-directus-collection="photos"
          :data-directus-item="photo.id"
        >
          <div>
            <span class="photo-entry-kicker">{{ setPending ? "Loading context…" : setContext ? "Inside a photoset" : "Single frame" }}</span>
            <h1 data-directus-field="title">{{ photo.title }}</h1>
            <p v-if="photo.description" class="photo-entry-description" data-directus-field="description">{{ photo.description }}</p>
            <div class="photo-entry-summary-row">
              <span class="photo-entry-summary-pill">{{ formatDate(photo.takenAt || photo.publishedAt) }}</span>
              <span v-if="locationLabel" class="photo-entry-summary-pill">{{ locationLabel }}</span>
              <span class="photo-entry-summary-pill">{{ sequenceLabel }}</span>
            </div>
          </div>
          <div class="photo-entry-meta">
            <div>
              <span class="photo-entry-meta-label">Captured</span>
              <strong data-directus-field="taken_at">{{ formatDate(photo.takenAt || photo.publishedAt) }}</strong>
            </div>
            <div v-if="photo.location">
              <span class="photo-entry-meta-label">Location</span>
              <strong data-directus-field="location">{{ photo.location }}</strong>
            </div>
            <div v-if="photo.camera">
              <span class="photo-entry-meta-label">Camera</span>
              <strong data-directus-field="camera">{{ photo.camera }}</strong>
            </div>
            <div v-if="photo.lens">
              <span class="photo-entry-meta-label">Lens</span>
              <strong data-directus-field="lens">{{ photo.lens }}</strong>
            </div>
          </div>
        </header>

        <div class="photo-entry-stage">
          <div
            v-if="photo.image"
            class="photo-entry-frame"
            data-directus-collection="photos"
            :data-directus-item="photo.id"
            data-directus-field="image"
          >
            <MotionPhotoPlayer
              v-if="photo.hasMotion"
              :final-image="photo.image"
              :motion-frames="photo.motionFrames"
              :alt="photo.image.alt || photo.title"
            />
            <PhotoAsset
              v-else
              :src="photo.image.url"
              :alt="photo.image.alt || photo.title"
              :aspect-ratio="photo.image.width && photo.image.height ? `${photo.image.width} / ${photo.image.height}` : null"
              fit="contain"
              loading="eager"
            />
          </div>

          <aside class="photo-entry-insights">
            <div class="photo-entry-panel">
              <span class="photo-entry-panel-label">Frame Details</span>
              <ul class="photo-entry-facts">
                <li>
                  <span>Format</span>
                  <strong>{{ orientationLabel }}</strong>
                </li>
                <li>
                  <span>Resolution</span>
                  <strong>{{ dimensionsLabel }}</strong>
                </li>
                <li>
                  <span>Sets</span>
                  <strong>{{ photo.sets?.length || 0 }}</strong>
                </li>
                <li v-if="photo.hasMotion">
                  <span>Motion Frames</span>
                  <strong>{{ photo.motionFrameCount }}</strong>
                </li>
                <li>
                  <span>Tags</span>
                  <strong>{{ photo.tags.length }}</strong>
                </li>
              </ul>
            </div>

            <div class="photo-entry-panel">
              <span class="photo-entry-panel-label">Quick Actions</span>
              <div class="photo-entry-actions">
                <a
                  v-if="photo.image?.url"
                  :href="photo.image.url"
                  target="_blank"
                  rel="noreferrer"
                  class="photo-entry-action"
                >Open full image</a>
                <NuxtLink
                  v-if="setContext"
                  :to="`/photosets/${setContext.slug}`"
                  class="photo-entry-action photo-entry-action-secondary"
                >Back to set</NuxtLink>
              </div>
            </div>
          </aside>
        </div>

        <div v-if="photo.tags.length" class="photo-entry-tags">
          <span v-for="tag in photo.tags" :key="tag">{{ tag }}</span>
        </div>

        <div v-if="photo.sets?.length" class="photo-entry-in-sets">
          <span class="photo-entry-in-sets-label">Part of</span>
          <NuxtLink
            v-for="set in photo.sets"
            :key="set.slug"
            :to="`/photosets/${set.slug}`"
            class="photo-entry-set-chip"
          >{{ set.title }}</NuxtLink>
        </div>

        <div v-if="photo.timelines?.length" class="photo-entry-in-sets">
          <span class="photo-entry-in-sets-label">In timeline</span>
          <NuxtLink
            v-for="timeline in photo.timelines"
            :key="timeline.slug"
            :to="`/timelines/${timeline.slug}`"
            class="photo-entry-set-chip"
          >{{ timeline.title }}</NuxtLink>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped>
  .photo-entry-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent 36%),
      linear-gradient(180deg, #040607 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .photo-entry-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .photo-entry-back {
    display: inline-flex;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .photo-entry-back:hover {
    color: #e2e8f0;
  }

  .photo-entry-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .photo-entry-set-nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .set-nav-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(8, 15, 10, 0.6);
    color: #94a3b8;
    font-size: 0.82rem;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .set-nav-arrow:hover {
    border-color: rgba(134, 239, 172, 0.38);
    color: #86efac;
    background: rgba(34, 197, 94, 0.08);
  }

  .set-nav-gap {
    display: inline-block;
    width: 1.9rem;
  }

  .set-nav-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.72rem;
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.08);
    font-size: 0.78rem;
    color: #86efac;
    white-space: nowrap;
  }

  .set-nav-pill:hover {
    border-color: rgba(134, 239, 172, 0.38);
    background: rgba(34, 197, 94, 0.14);
  }

  .set-nav-count {
    color: #64748b;
  }

  .photo-entry-head {
    display: grid;
    gap: 1.2rem;
    margin-top: 1.4rem;
  }

  .photo-entry-kicker,
  .photo-entry-panel-label {
    display: inline-flex;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-entry-head h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.6rem, 5vw, 4.4rem);
    line-height: 0.96;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .photo-entry-description {
    max-width: 42rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #cbd5e1;
  }

  .photo-entry-summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1rem;
  }

  .photo-entry-summary-pill {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.12);
    color: #d1fae5;
    padding: 0.34rem 0.72rem;
    font-size: 0.76rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .photo-entry-meta {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }

  .photo-entry-meta div,
  .photo-entry-panel {
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 222, 128, 0.16);
    background: rgba(8, 15, 10, 0.9);
  }

  .photo-entry-meta-label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #86efac;
    margin-bottom: 0.35rem;
  }

  .photo-entry-meta strong {
    color: #f0fdf4;
    font-weight: 500;
  }

  .photo-entry-stage {
    display: grid;
    gap: 1rem;
    margin-top: 1.8rem;
  }

  .photo-entry-frame {
    overflow: hidden;
    border-radius: 1.8rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.92);
    box-shadow: 0 28px 44px rgba(0, 0, 0, 0.34);
  }

  .photo-entry-insights {
    display: grid;
    gap: 1rem;
  }

  .photo-entry-facts {
    display: grid;
    gap: 0.8rem;
    margin-top: 0.8rem;
  }

  .photo-entry-facts li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: #cbd5e1;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .photo-entry-facts li:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .photo-entry-facts li span {
    color: #94a3b8;
  }

  .photo-entry-facts li strong {
    color: #f8fafc;
    text-align: right;
  }

  .photo-entry-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.8rem;
  }

  .photo-entry-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.6rem;
    padding: 0.7rem 1rem;
    border-radius: 999px;
    background: #dcfce7;
    color: #052e16;
    font-weight: 600;
  }

  .photo-entry-action-secondary {
    background: rgba(34, 197, 94, 0.1);
    color: #d1fae5;
    border: 1px solid rgba(74, 222, 128, 0.22);
  }

  .photo-entry-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1.2rem;
  }

  .photo-entry-tags span {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.12);
    color: #d1fae5;
    padding: 0.3rem 0.68rem;
    font-size: 0.75rem;
  }

  .photo-entry-in-sets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    margin-top: 1.2rem;
  }

  .photo-entry-in-sets-label {
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
  }

  .photo-entry-set-chip {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.1);
    color: #86efac;
    padding: 0.28rem 0.68rem;
    font-size: 0.78rem;
  }

  .photo-entry-set-chip:hover {
    border-color: rgba(134, 239, 172, 0.38);
    background: rgba(34, 197, 94, 0.16);
    color: #d1fae5;
  }

  .photo-skeleton-block {
    border-radius: 0.95rem;
    background:
      linear-gradient(110deg, rgba(148, 163, 184, 0.08) 8%, rgba(148, 163, 184, 0.18) 18%, rgba(148, 163, 184, 0.08) 33%);
    background-size: 200% 100%;
    animation: photo-entry-shimmer 1.35s linear infinite;
  }

  .photo-skeleton-kicker {
    width: 10rem;
    height: 0.85rem;
  }

  .photo-skeleton-title {
    margin-top: 0.8rem;
    width: 60%;
    height: 3rem;
  }

  .photo-skeleton-line {
    margin-top: 0.9rem;
    width: 100%;
    height: 1rem;
  }

  .photo-skeleton-line-short {
    width: 74%;
  }

  .photo-skeleton-frame {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  @keyframes photo-entry-shimmer {
    from {
      background-position: 200% 0;
    }

    to {
      background-position: -200% 0;
    }
  }

  @media (min-width: 980px) {
    .photo-entry-page {
      padding-inline: 2rem;
    }

    .photo-entry-head {
      grid-template-columns: minmax(0, 1.3fr) minmax(16rem, 0.7fr);
      align-items: end;
    }

    .photo-entry-stage {
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);
      align-items: start;
    }
  }

  @media (max-width: 540px) {
    .photo-entry-page {
      padding: 5.5rem 1rem 3rem;
    }

    .photo-entry-frame {
      border-radius: 1rem;
    }

    .set-nav-pill {
      max-width: 9rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style>
