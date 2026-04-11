<script setup lang="ts">
  import { computed } from "vue";
  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

  const { data: shell } = await useCmsShell();
  const { data } = await useAsyncData(
    "cms-photosets",
    () => $fetch("/api/cms/photosets"),
    { default: () => ({ photosets: [] }) }
  );

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const photosets = computed(() => data.value.photosets);

  useSeoMeta({
    title: computed(() => `Sets | ${site.value.siteName}`),
    description: computed(() => site.value.siteDescription),
  });

  function formatDate(value: string | null) {
    if (!value) return "Undated";
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
  }
</script>

<template>
  <main class="sets-page">
    <section class="sets-hero">
      <h1>Sets</h1>
      <p>Groups of photos from the same shoot, place, or idea.</p>
    </section>

    <section v-if="photosets.length" class="sets-grid">
      <NuxtLink
        v-for="set in photosets"
        :key="set.id"
        :to="`/photosets/${set.slug}`"
        class="set-card"
      >
        <div class="set-card-image">
          <img
            v-if="set.coverImage"
            :src="set.coverImage.previewUrl || set.coverImage.url"
            :alt="set.coverImage.alt || set.title"
            loading="lazy"
          />
          <div v-else class="set-card-image-placeholder" />
        </div>
        <div class="set-card-copy">
          <div class="set-card-head">
            <h2>{{ set.title }}</h2>
            <span>{{ formatDate(set.publishedAt) }}</span>
          </div>
          <p v-if="set.description">{{ set.description }}</p>
          <div class="set-card-foot">
            <span class="set-count">{{ set.photoCount }} photo{{ set.photoCount !== 1 ? "s" : "" }}</span>
            <span v-for="tag in set.tags.slice(0, 3)" :key="tag" class="set-tag">{{ tag }}</span>
          </div>
        </div>
      </NuxtLink>
    </section>

    <section v-else class="sets-empty">
      <h2>No sets yet</h2>
      <p>Create a photoset in Directus and add photos to it — it'll show up here.</p>
    </section>
  </main>
</template>

<style scoped>
  .sets-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.11), transparent 34%),
      linear-gradient(180deg, #050608 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .sets-hero,
  .sets-grid,
  .sets-empty {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .sets-hero h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .sets-hero p {
    max-width: 44rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #94a3b8;
  }

  .sets-grid {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
    grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
  }

  .set-card {
    overflow: hidden;
    border-radius: 1.3rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.3);
    transition: transform 0.18s ease, border-color 0.18s ease;
  }

  .set-card:hover {
    transform: translateY(-3px);
    border-color: rgba(134, 239, 172, 0.36);
  }

  .set-card-image {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.5);
  }

  .set-card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .set-card:hover .set-card-image img {
    transform: scale(1.03);
  }

  .set-card-image-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(15, 23, 42, 0.8));
  }

  .set-card-copy {
    display: grid;
    gap: 0.6rem;
    padding: 1rem 1rem 1.1rem;
  }

  .set-card-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.85rem;
    align-items: baseline;
    justify-content: space-between;
  }

  .set-card-head h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.35rem;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: #f8fafc;
  }

  .set-card-head span {
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #86efac;
  }

  .set-card-copy p {
    font-size: 0.9rem;
    line-height: 1.75;
    color: #cbd5e1;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .set-card-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .set-count {
    font-size: 0.72rem;
    color: #f8fafc;
    background: rgba(34, 197, 94, 0.18);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 999px;
    padding: 0.24rem 0.55rem;
  }

  .set-tag {
    font-size: 0.72rem;
    color: #d1fae5;
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(74, 222, 128, 0.14);
    border-radius: 999px;
    padding: 0.24rem 0.55rem;
  }

  .sets-empty {
    margin-top: 2rem;
    border-radius: 1.5rem;
    border: 1px dashed rgba(74, 222, 128, 0.24);
    background: rgba(8, 15, 10, 0.9);
    padding: 1.5rem;
  }

  .sets-empty h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.5rem;
    color: #f8fafc;
  }

  .sets-empty p {
    margin-top: 0.5rem;
    line-height: 1.75;
    color: #94a3b8;
  }
</style>
