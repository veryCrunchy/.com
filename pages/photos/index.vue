<script setup lang="ts">
  import { computed } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

  const { data: shell } = await useCmsShell();
  const { data } = await useAsyncData(
    "cms-photos",
    () => $fetch("/api/cms/photos"),
    {
      default: () => ({
        photos: [],
      }),
    }
  );

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const photos = computed(() => data.value.photos);

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
</script>

<template>
  <main class="photo-page">
    <section class="photo-hero">
      <p class="eyebrow">Directus Gallery</p>
      <h1>{{ site.photosLabel }}</h1>
      <p>
        A living image archive for finished shots, experiments, travel frames, and whatever else
        deserves a permanent place.
      </p>
    </section>

    <section v-if="photos.length" class="photo-grid">
      <NuxtLink
        v-for="photo in photos"
        :key="photo.id"
        :to="`/photos/${photo.slug}`"
        class="photo-card"
      >
        <div v-if="photo.image" class="photo-card-image">
          <img :src="photo.image.url" :alt="photo.image.alt || photo.title" loading="lazy" />
        </div>
        <div class="photo-card-copy">
          <div class="photo-card-head">
            <h2>{{ photo.title }}</h2>
            <span>{{ formatDate(photo.takenAt || photo.publishedAt) }}</span>
          </div>
          <p>{{ photo.description || "Open the photo page for the full frame and notes." }}</p>
          <div v-if="photo.location || photo.camera" class="photo-card-meta">
            <span v-if="photo.location">{{ photo.location }}</span>
            <span v-if="photo.camera">{{ photo.camera }}</span>
          </div>
        </div>
      </NuxtLink>
    </section>

    <section v-else class="photo-empty">
      <p class="eyebrow">Waiting On Content</p>
      <h2>No photos yet</h2>
      <p>
        Add records to the Directus <code>photos</code> collection and the gallery will fill
        itself in here.
      </p>
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
  .photo-grid,
  .photo-empty {
    width: min(100%, 72rem);
    margin: 0 auto;
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

  .photo-grid {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  }

  .photo-card {
    overflow: hidden;
    border-radius: 1.3rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.3);
  }

  .photo-card:hover {
    transform: translateY(-3px);
    border-color: rgba(134, 239, 172, 0.36);
  }

  .photo-card-image {
    aspect-ratio: 1;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.5);
  }

  .photo-card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-card-copy {
    display: grid;
    gap: 0.75rem;
    padding: 1rem 1rem 1.1rem;
  }

  .photo-card-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.85rem;
    align-items: baseline;
    justify-content: space-between;
  }

  .photo-card-head h2,
  .photo-empty h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.35rem;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: #f8fafc;
  }

  .photo-card-head span {
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-card-copy p,
  .photo-empty p {
    line-height: 1.75;
    color: #cbd5e1;
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
    margin-top: 2rem;
    border-radius: 1.5rem;
    border: 1px dashed rgba(74, 222, 128, 0.24);
    background: rgba(8, 15, 10, 0.9);
    padding: 1.5rem;
  }

  @media (min-width: 900px) {
    .photo-page {
      padding-inline: 2rem;
    }
  }
</style>
