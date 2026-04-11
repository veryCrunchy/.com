<script setup lang="ts">
  import { computed } from "vue";

  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const { data } = await useAsyncData(
    () => `cms-photoset-${slug.value}`,
    () => $fetch(`/api/cms/photosets/${slug.value}`)
  );

  const photoset = computed(() => data.value.photoset);

  useSeoMeta({
    title: computed(() => `${photoset.value.title} | Sets | veryCrunchy`),
    description: computed(
      () => photoset.value.description || "A photoset from veryCrunchy."
    ),
    ogTitle: computed(() => photoset.value.title),
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
      <NuxtLink to="/photosets" class="set-back">← Sets</NuxtLink>

      <header class="set-head">
        <div>
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
        </div>
      </header>

      <div v-if="photoset.photos.length" class="set-grid" data-directus-field="photos">
        <NuxtLink
          v-for="photo in photoset.photos"
          :key="photo.id"
          :to="`/photos/${photo.slug}`"
          class="set-photo"
        >
          <div class="set-photo-frame">
            <img
              v-if="photo.image"
              :src="photo.image.url"
              :alt="photo.image.alt || photo.title"
              loading="lazy"
            />
            <div v-else class="set-photo-placeholder" />
          </div>
          <div class="set-photo-caption">
            <span>{{ photo.title }}</span>
            <span v-if="photo.camera" class="set-photo-camera">{{ photo.camera }}</span>
          </div>
        </NuxtLink>
      </div>

      <div v-if="photoset.tags.length" class="set-tags">
        <span v-for="tag in photoset.tags" :key="tag">{{ tag }}</span>
      </div>
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
    transition: color 0.15s;
  }

  .set-back:hover {
    color: #e2e8f0;
  }

  .set-head {
    display: grid;
    gap: 1.2rem;
    margin-top: 1.4rem;
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

  .set-meta div {
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
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.5);
  }

  .set-photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .set-photo:hover .set-photo-frame img {
    transform: scale(1.04);
  }

  .set-photo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(15, 23, 42, 0.8));
  }

  .set-photo-caption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.65rem 0.85rem 0.75rem;
  }

  .set-photo-caption span {
    font-size: 0.85rem;
    font-weight: 500;
    color: #f0fdf4;
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

  @media (min-width: 980px) {
    .set-page {
      padding-inline: 2rem;
    }

    .set-head {
      grid-template-columns: minmax(0, 1.3fr) minmax(14rem, 0.6fr);
      align-items: end;
    }
  }
</style>
