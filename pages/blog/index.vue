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
      <p class="eyebrow">Directus Collection</p>
      <div class="cms-hero-row">
        <div>
          <h1 class="cms-title">{{ site.postsLabel }}</h1>
          <p class="cms-intro">
            Long-form notes, build logs, essays, and project write-ups are all pulled from
            Directus here.
          </p>
        </div>
        <div class="cms-hero-card">
          <span class="cms-hero-card-label">Editable From Directus</span>
          <p class="cms-hero-card-copy">
            Titles, excerpts, cover images, publishing dates, and the full body content all live
            in your CMS.
          </p>
        </div>
      </div>
    </section>

    <section v-if="posts.length" class="post-grid">
      <NuxtLink
        v-for="post in posts"
        :key="post.id"
        :to="`/blog/${post.slug}`"
        class="post-card"
      >
        <div v-if="post.coverImage" class="post-card-media">
          <img
            :src="post.coverImage.url"
            :alt="post.coverImage.alt || post.title"
            loading="lazy"
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
      <p class="eyebrow">Waiting On Content</p>
      <h2>No posts yet</h2>
      <p>
        Create items in the Directus <code>posts</code> collection and they will appear here
        automatically.
      </p>
    </section>
  </main>
</template>

<style scoped>
  .cms-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(59, 130, 246, 0.14), transparent 42%),
      linear-gradient(180deg, #07090c 0%, #0b0d11 35%, #090b0f 100%);
    color: #e2e8f0;
  }

  .cms-hero,
  .post-grid,
  .cms-empty {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .cms-hero {
    margin-bottom: 2rem;
  }

  .cms-hero-row {
    display: grid;
    gap: 1rem;
    align-items: end;
  }

  .cms-title {
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
    margin-top: 0.65rem;
  }

  .cms-intro {
    max-width: 40rem;
    margin-top: 1rem;
    font-size: 1rem;
    line-height: 1.8;
    color: #94a3b8;
  }

  .cms-hero-card {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 1.25rem;
    background: rgba(15, 23, 42, 0.46);
    padding: 1rem 1.05rem;
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.22);
  }

  .cms-hero-card-label {
    display: inline-block;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #cbd5e1;
  }

  .cms-hero-card-copy {
    margin-top: 0.75rem;
    line-height: 1.7;
    color: #94a3b8;
  }

  .post-grid {
    display: grid;
    gap: 1.1rem;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .post-card {
    overflow: hidden;
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.75), rgba(9, 12, 18, 0.95));
    box-shadow: 0 24px 44px rgba(2, 6, 23, 0.26);
  }

  .post-card:hover {
    transform: translateY(-3px);
    border-color: rgba(191, 219, 254, 0.34);
  }

  .post-card-media {
    aspect-ratio: 1.28;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.7);
  }

  .post-card-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .post-card-body {
    display: grid;
    gap: 0.85rem;
    padding: 1.2rem;
  }

  .post-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem 1rem;
    font-size: 0.78rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .post-card h2,
  .cms-empty h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.45rem;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: #f8fafc;
  }

  .post-card p,
  .cms-empty p {
    line-height: 1.8;
    color: #a5b4fc;
  }

  .cms-empty {
    border-radius: 1.5rem;
    border: 1px dashed rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.32);
    padding: 1.5rem;
  }

  @media (min-width: 900px) {
    .cms-page {
      padding-inline: 2rem;
    }

    .cms-hero-row {
      grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.72fr);
      gap: 1.6rem;
    }
  }
</style>
