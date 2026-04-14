<script setup lang="ts">
  import { computed } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

  const { data: shell } = await useCmsShell();
  const { data } = await useAsyncData(
    "cms-posts",
    () => $fetch("/api/cms/posts"),
    {
      default: () => ({
        posts: [],
      }),
    }
  );

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const posts = computed(() => data.value.posts);

  useSeoMeta({
    title: computed(() => `${site.value.postsLabel} | ${site.value.siteName}`),
    description: computed(() => site.value.siteDescription),
  });

  function formatDate(value: string | null) {
    if (!value) return "Drafting quietly";

    return new Intl.DateTimeFormat("en", {
      dateStyle: "long",
    }).format(new Date(value));
  }
</script>

<template>
  <main class="cms-page">
    <section class="cms-hero">
      <h1 class="cms-title">{{ site.postsLabel }}</h1>
      <p class="cms-intro">{{ site.siteDescription }}</p>
    </section>

    <section v-if="posts.length" class="post-grid">
      <NuxtLink
        v-for="post in posts"
        :key="post.id"
        :to="`/blog/${post.slug}`"
        class="post-card"
      >
        <div v-if="post.coverImage" class="post-card-media">
          <PhotoAsset
            :src="post.coverImage.previewUrl || post.coverImage.url"
            :srcset="post.coverImage.previewSrcset || post.coverImage.srcset"
            sizes="(min-width: 1200px) 23rem, (min-width: 768px) 45vw, 100vw"
            :fallback-src="post.coverImage.fallbackUrl"
            :alt="post.coverImage.alt || post.title"
            aspect-ratio="16 / 9"
          />
        </div>
        <div class="post-card-body">
          <div class="post-card-meta">
            <span>{{ formatDate(post.publishedAt) }}</span>
            <span v-if="post.tags.length">{{ post.tags.slice(0, 2).join(" · ") }}</span>
          </div>
          <h2>{{ post.title }}</h2>
          <p>{{ post.excerpt || "Open the page to read the full entry." }}</p>
        </div>
      </NuxtLink>
    </section>

    <section v-else class="cms-empty">
      <h2>Nothing here yet</h2>
      <p>Check back soon.</p>
    </section>
  </main>
</template>

<style scoped>
  .cms-page {
    min-height: 100dvh;
    padding: 7rem 1.25rem 6rem;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.07), transparent 55%),
      linear-gradient(180deg, #07090c 0%, #0b0d11 100%);
    color: #e2e8f0;
  }

  .cms-hero,
  .post-grid,
  .cms-empty {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .cms-hero {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .cms-title {
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .cms-intro {
    max-width: 42rem;
    margin-top: 1.1rem;
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: 1.1rem;
    line-height: 1.75;
    color: #6b7280;
  }

  .post-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
  }

  .post-card {
    overflow: hidden;
    border-radius: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(11, 14, 22, 0.7);
    transition: border-color 0.2s ease, transform 0.2s ease;
  }

  .post-card:hover {
    transform: translateY(-2px);
    border-color: rgba(148, 163, 184, 0.28);
  }

  .post-card-media {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.7);
  }

  .post-card-media :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;
  }

  .post-card:hover .post-card-media :deep(img) {
    transform: scale(1.03);
  }

  .post-card-body {
    display: grid;
    gap: 0.7rem;
    padding: 1.25rem;
  }

  .post-card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0;
    font-size: 0.73rem;
    letter-spacing: 0.04em;
    color: #4b5563;
  }

  .post-card-meta span + span::before {
    content: "·";
    margin: 0 0.45rem;
    opacity: 0.6;
  }

  .post-card h2,
  .cms-empty h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.3rem;
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: #f1f5f9;
  }

  .post-card p,
  .cms-empty p {
    font-size: 0.9rem;
    line-height: 1.75;
    color: #6b7280;
  }

  .cms-empty {
    border-radius: 1rem;
    border: 1px dashed rgba(148, 163, 184, 0.18);
    background: rgba(11, 14, 22, 0.5);
    padding: 2rem;
  }

  @media (min-width: 900px) {
    .cms-page {
      padding-inline: 2rem;
    }
  }

  @media (max-width: 540px) {
    .cms-page {
      padding: 5.5rem 1rem 3rem;
    }

    .post-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .post-card {
      border-radius: 0.85rem;
    }
  }
</style>
