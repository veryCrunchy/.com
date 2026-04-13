<script setup lang="ts">
  import { computed } from "vue";

  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const emptyPhotoset = {
    id: 0,
    slug: "",
    title: "",
    description: "",
    publishedAt: null,
    tags: [],
    coverImage: null,
    photoCount: 0,
    photos: [],
  };

  const { data, pending } = await useAsyncData(
    () => `cms-photoset-${slug.value}`,
    () => $fetch(`/api/cms/photosets/${slug.value}`),
    {
      lazy: true,
      default: () => ({ photoset: emptyPhotoset }),
    }
  );

  const photoset = computed(() => data.value.photoset || emptyPhotoset);
  const isLoading = computed(() => pending.value && !photoset.value.id);

  const earliestDate = computed(() => {
    const values = photoset.value.photos
      .map((photo: { takenAt: string | null; publishedAt: string | null }) => photo.takenAt || photo.publishedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

    return values[0] || photoset.value.publishedAt || null;
  });

  const portraitCount = computed(
    () =>
      photoset.value.photos.filter(
        (photo: { image: { width: number | null; height: number | null } | null }) =>
          photo.image?.width && photo.image?.height && photo.image.height > photo.image.width
      ).length
  );

  useSeoMeta({
    title: computed(() => `${photoset.value.title || "Photoset"} | Sets | veryCrunchy`),
    description: computed(
      () => photoset.value.description || "A photoset from veryCrunchy."
    ),
    ogTitle: computed(() => photoset.value.title || "Photoset"),
    ogDescription: computed(() => photoset.value.description || ""),
    ogImage: computed(() => photoset.value.coverImage?.url || photoset.value.photos?.[0]?.image?.url || ""),
  });

  function formatDate(value: string | null) {
    if (!value) return "Undated";
    return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
  }
</script>

<template>
  <main class="set-page">
    <section
      class="set-shell"
      data-directus-collection="photosets"
      :data-directus-item="photoset.id"
    >
      <NuxtLink to="/photos" class="set-back">← Photos</NuxtLink>

      <div v-if="isLoading" class="set-skeleton" aria-live="polite">
        <div class="set-head">
          <div>
            <div class="set-skeleton-block set-skeleton-kicker" />
            <div class="set-skeleton-block set-skeleton-title" />
            <div class="set-skeleton-block set-skeleton-line" />
            <div class="set-skeleton-block set-skeleton-line set-skeleton-line-short" />
          </div>
          <div class="set-meta">
            <div class="set-skeleton-card">
              <div class="set-skeleton-block set-skeleton-label" />
              <div class="set-skeleton-block set-skeleton-value" />
            </div>
            <div class="set-skeleton-card">
              <div class="set-skeleton-block set-skeleton-label" />
              <div class="set-skeleton-block set-skeleton-value" />
            </div>
          </div>
        </div>
        <div class="set-grid">
          <article v-for="index in 4" :key="index" class="set-photo set-photo-skeleton" aria-hidden="true">
            <div class="set-skeleton-block set-skeleton-image" />
            <div class="set-photo-caption">
              <div class="set-skeleton-block set-skeleton-line" />
            </div>
          </article>
        </div>
      </div>

      <template v-else>
        <header class="set-head">
          <div>
            <span class="set-kicker">Photoset</span>
            <h1 data-directus-field="title">{{ photoset.title }}</h1>
            <p v-if="photoset.description" class="set-description" data-directus-field="description">
              {{ photoset.description }}
            </p>
          </div>
          <div class="set-meta">
            <div>
              <span class="set-meta-label">Published</span>
              <strong data-directus-field="published_at">{{ formatDate(photoset.publishedAt) }}</strong>
            </div>
            <div>
              <span class="set-meta-label">Photos</span>
              <strong>{{ photoset.photos.length }}</strong>
            </div>
            <div>
              <span class="set-meta-label">First Capture</span>
              <strong>{{ formatDate(earliestDate) }}</strong>
            </div>
            <div>
              <span class="set-meta-label">Portrait Frames</span>
              <strong>{{ portraitCount }}</strong>
            </div>
          </div>
        </header>

        <div v-if="photoset.photos.length" class="set-grid" data-directus-field="photos">
          <article
            v-for="photo in photoset.photos"
            :key="photo.id"
            class="set-photo"
          >
            <div class="set-photo-frame">
              <InteractivePhotoSurface
                :photo="photo"
                aspect-ratio="4 / 3"
                fit="cover"
                :detail-href="`/photos/${photo.slug}?from=${photoset.slug}`"
              />
            </div>
            <div class="set-photo-caption">
              <NuxtLink :to="`/photos/${photo.slug}?from=${photoset.slug}`" class="set-photo-title">
                <span>{{ photo.title }}</span>
              </NuxtLink>
              <span v-if="photo.hasMotion" class="set-photo-camera">Motion {{ photo.motionFrameCount }}</span>
              <span v-else-if="photo.camera" class="set-photo-camera">{{ photo.camera }}</span>
            </div>
          </article>
        </div>

        <div v-if="photoset.tags.length" class="set-tags">
          <span v-for="tag in photoset.tags" :key="tag">{{ tag }}</span>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped>
  .set-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent 36%),
      linear-gradient(180deg, #040607 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .set-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .set-back {
    display: inline-flex;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .set-back:hover {
    color: #e2e8f0;
  }

  .set-head {
    display: grid;
    gap: 1.2rem;
    margin-top: 1.4rem;
  }

  .set-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #86efac;
  }

  .set-head h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.6rem, 5vw, 4.4rem);
    line-height: 0.96;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .set-description {
    max-width: 42rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #cbd5e1;
  }

  .set-meta {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }

  .set-meta div,
  .set-skeleton-card {
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 222, 128, 0.16);
    background: rgba(8, 15, 10, 0.9);
  }

  .set-meta-label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #86efac;
    margin-bottom: 0.35rem;
  }

  .set-meta strong {
    color: #f0fdf4;
    font-weight: 500;
  }

  .set-grid {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  }

  .set-photo {
    overflow: hidden;
    border-radius: 1.2rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(8, 15, 10, 0.9);
    transition: transform 0.18s ease, border-color 0.18s ease;
  }

  .set-photo:hover {
    transform: translateY(-3px);
    border-color: rgba(134, 239, 172, 0.34);
  }

  .set-photo-frame {
    overflow: hidden;
    background: rgba(15, 23, 42, 0.5);
  }

  .set-photo-caption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.75rem 0.85rem 0.85rem;
  }

  .set-photo-caption span {
    font-size: 0.85rem;
    font-weight: 500;
    color: #f0fdf4;
  }

  .set-photo-title:hover span {
    color: #86efac;
  }

  .set-photo-camera {
    font-size: 0.7rem !important;
    color: #64748b !important;
    font-weight: 400 !important;
    white-space: nowrap;
  }

  .set-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1.5rem;
  }

  .set-tags span {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.12);
    color: #d1fae5;
    padding: 0.3rem 0.68rem;
    font-size: 0.75rem;
  }

  .set-skeleton-block {
    border-radius: 0.95rem;
    background:
      linear-gradient(110deg, rgba(148, 163, 184, 0.08) 8%, rgba(148, 163, 184, 0.18) 18%, rgba(148, 163, 184, 0.08) 33%);
    background-size: 200% 100%;
    animation: set-page-shimmer 1.35s linear infinite;
  }

  .set-skeleton-kicker {
    width: 8rem;
    height: 0.85rem;
  }

  .set-skeleton-title {
    margin-top: 0.8rem;
    width: 60%;
    height: 3rem;
  }

  .set-skeleton-line {
    margin-top: 0.9rem;
    width: 100%;
    height: 1rem;
  }

  .set-skeleton-line-short {
    width: 76%;
  }

  .set-skeleton-label {
    width: 50%;
    height: 0.8rem;
  }

  .set-skeleton-value {
    margin-top: 0.7rem;
    width: 72%;
    height: 1.1rem;
  }

  .set-skeleton-image {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  @keyframes set-page-shimmer {
    from {
      background-position: 200% 0;
    }

    to {
      background-position: -200% 0;
    }
  }

  @media (min-width: 980px) {
    .set-page {
      padding-inline: 2rem;
    }

    .set-head {
      grid-template-columns: minmax(0, 1.3fr) minmax(14rem, 0.7fr);
      align-items: end;
    }
  }

  @media (max-width: 540px) {
    .set-page {
      padding: 5.5rem 1rem 3rem;
    }

    .set-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .set-photo {
      border-radius: 0.85rem;
    }
  }
</style>
