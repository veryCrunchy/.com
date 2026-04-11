<script setup lang="ts">
  import { computed } from "vue";

  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const { data } = await useAsyncData(
    () => `cms-post-${slug.value}`,
    () => $fetch(`/api/cms/posts/${slug.value}`)
  );

  const post = computed(() => data.value.post);

  useSeoMeta({
    title: computed(() => `${post.value.title} | veryCrunchy`),
    description: computed(
      () => post.value.excerpt || "Writing, notes, and project posts from veryCrunchy."
    ),
    ogTitle: computed(() => post.value.title),
    ogDescription: computed(
      () => post.value.excerpt || "Writing, notes, and project posts from veryCrunchy."
    ),
    ogImage: computed(() => post.value.coverImage?.url || ""),
  });

  function formatDate(value: string | null) {
    if (!value) return "Recently updated";

    return new Intl.DateTimeFormat("en", {
      dateStyle: "long",
    }).format(new Date(value));
  }
</script>

<template>
  <main class="entry-page">
    <article class="entry-shell">
      <NuxtLink to="/blog" class="entry-back">Back to blog</NuxtLink>

      <header class="entry-header">
        <p class="eyebrow">Directus Entry</p>
        <h1>{{ post.title }}</h1>
        <div class="entry-meta">
          <span>{{ formatDate(post.publishedAt) }}</span>
          <span v-if="post.tags.length">{{ post.tags.join(" · ") }}</span>
        </div>
        <p v-if="post.excerpt" class="entry-excerpt">{{ post.excerpt }}</p>
      </header>

      <div v-if="post.coverImage" class="entry-cover">
        <img :src="post.coverImage.url" :alt="post.coverImage.alt || post.title" />
      </div>

      <div class="entry-content" v-html="post.content || '<p>No content yet.</p>'"></div>
    </article>
  </main>
</template>

<style scoped>
  .entry-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(99, 102, 241, 0.14), transparent 38%),
      linear-gradient(180deg, #06070a 0%, #0b0d11 100%);
    color: #e2e8f0;
  }

  .entry-shell {
    width: min(100%, 52rem);
    margin: 0 auto;
  }

  .entry-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .entry-back:hover {
    color: #e2e8f0;
  }

  .entry-header {
    margin-top: 1.35rem;
  }

  .entry-header h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.6rem, 6vw, 4.6rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .entry-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    margin-top: 1rem;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .entry-excerpt {
    margin-top: 1rem;
    font-size: 1rem;
    line-height: 1.85;
    color: #cbd5e1;
  }

  .entry-cover {
    overflow: hidden;
    margin-top: 1.75rem;
    border-radius: 1.6rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.56);
  }

  .entry-cover img {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .entry-content {
    margin-top: 2rem;
    font-size: 1rem;
    line-height: 1.9;
    color: #cbd5e1;
  }

  .entry-content :deep(h2),
  .entry-content :deep(h3),
  .entry-content :deep(h4) {
    margin-top: 2rem;
    margin-bottom: 0.8rem;
    font-family: "Syne", sans-serif;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: #f8fafc;
  }

  .entry-content :deep(h2) {
    font-size: 1.9rem;
  }

  .entry-content :deep(h3) {
    font-size: 1.45rem;
  }

  .entry-content :deep(p),
  .entry-content :deep(ul),
  .entry-content :deep(ol),
  .entry-content :deep(blockquote) {
    margin-bottom: 1.15rem;
  }

  .entry-content :deep(a) {
    color: #bfdbfe;
    text-decoration: underline;
    text-decoration-color: rgba(191, 219, 254, 0.4);
    text-underline-offset: 0.18em;
  }

  .entry-content :deep(img) {
    width: 100%;
    display: block;
    margin: 1.5rem 0;
    border-radius: 1rem;
  }

  .entry-content :deep(blockquote) {
    border-left: 3px solid rgba(191, 219, 254, 0.4);
    padding-left: 1rem;
    color: #cbd5e1;
  }

  .entry-content :deep(code) {
    font-size: 0.9em;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 0.45rem;
    padding: 0.1rem 0.35rem;
  }

  .entry-content :deep(pre) {
    overflow-x: auto;
    margin: 1.5rem 0;
    padding: 1rem;
    border-radius: 1rem;
    background: #020617;
    border: 1px solid rgba(148, 163, 184, 0.16);
  }

  @media (min-width: 900px) {
    .entry-page {
      padding-inline: 2rem;
    }
  }
</style>
