<script setup lang="ts">
  import { computed } from "vue";

  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const { data } = await useAsyncData(
    () => `cms-post-${slug.value}`,
    () => $fetch(`/api/cms/posts/${slug.value}`),
    {
      default: () => ({
        post: {
          id: "",
          slug: "",
          title: "",
          excerpt: null,
          publishedAt: null,
          tags: [],
          coverImage: null,
          content: null,
        },
      }),
    }
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
    <article
      class="entry-shell"
      data-directus-collection="posts"
      :data-directus-item="post.id"
    >
      <NuxtLink to="/blog" class="entry-back">← All posts</NuxtLink>

      <header class="entry-header">
        <h1 data-directus-field="title">{{ post.title }}</h1>
        <div class="entry-meta">
          <span data-directus-field="published_at">{{ formatDate(post.publishedAt) }}</span>
          <span v-if="post.tags.length" data-directus-field="tags">{{ post.tags.join(" · ") }}</span>
        </div>
        <p v-if="post.excerpt" class="entry-excerpt" data-directus-field="excerpt">{{ post.excerpt }}</p>
      </header>

      <div v-if="post.coverImage" class="entry-cover" data-directus-field="cover_image">
        <img :src="post.coverImage.url" :alt="post.coverImage.alt || post.title" />
      </div>

      <div
        class="entry-content"
        data-directus-field="content"
        v-html="post.content || ''"
      ></div>
    </article>
  </main>
</template>

<style scoped>
  .entry-page {
    min-height: 100dvh;
    padding: 7rem 1.25rem 6rem;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.08), transparent 55%),
      linear-gradient(180deg, #06070a 0%, #0b0d11 100%);
    color: #e2e8f0;
  }

  .entry-shell {
    width: min(100%, 48rem);
    margin: 0 auto;
  }

  .entry-back {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    color: #64748b;
    transition: color 0.15s;
  }

  .entry-back:hover {
    color: #94a3b8;
  }

  .entry-header {
    margin-top: 2.5rem;
    padding-bottom: 1.75rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  }

  .entry-header h1 {
    font-family: "Syne", sans-serif;
    font-size: clamp(2.4rem, 5.5vw, 4rem);
    line-height: 1.0;
    letter-spacing: -0.04em;
    color: #f8fafc;
    margin-bottom: 1rem;
  }

  .entry-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0;
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .entry-meta span + span::before {
    content: "·";
    margin: 0 0.55rem;
    opacity: 0.5;
  }

  .entry-excerpt {
    margin-top: 1.25rem;
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: 1.15rem;
    line-height: 1.75;
    color: #94a3b8;
  }

  .entry-cover {
    overflow: hidden;
    margin-top: 2rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.56);
  }

  .entry-cover img {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .entry-content {
    margin-top: 2.5rem;
    font-size: 1.0625rem;
    line-height: 1.85;
    color: #c8d0db;
    font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
  }

  /* Drop cap on the first paragraph */
  .entry-content :deep(p:first-of-type)::first-letter {
    float: left;
    font-family: "Instrument Serif", serif;
    font-size: 3.85rem;
    font-style: normal;
    line-height: 0.78;
    margin-right: 0.08em;
    margin-bottom: -0.04em;
    color: #e4e4e7;
  }

  .entry-content :deep(h2),
  .entry-content :deep(h3),
  .entry-content :deep(h4) {
    margin-top: 2.5rem;
    margin-bottom: 0.65rem;
    font-family: "Syne", sans-serif;
    line-height: 1.08;
    letter-spacing: -0.035em;
    color: #f1f5f9;
  }

  .entry-content :deep(h2) {
    font-size: 1.75rem;
    padding-top: 0.25rem;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  .entry-content :deep(h3) {
    font-size: 1.3rem;
  }

  .entry-content :deep(p),
  .entry-content :deep(ul),
  .entry-content :deep(ol) {
    margin-bottom: 1.35rem;
  }

  .entry-content :deep(blockquote) {
    margin: 2rem 0;
  }

  .entry-content :deep(a) {
    color: #93c5fd;
    text-decoration: underline;
    text-decoration-color: rgba(147, 197, 253, 0.35);
    text-underline-offset: 0.2em;
    transition: color 0.15s, text-decoration-color 0.15s;
  }

  .entry-content :deep(a:hover) {
    color: #bfdbfe;
    text-decoration-color: rgba(191, 219, 254, 0.65);
  }

  .entry-content :deep(img) {
    width: 100%;
    display: block;
    margin: 2rem 0;
    border-radius: 0.75rem;
  }

  .entry-content :deep(blockquote) {
    border-left: 2px solid rgba(148, 163, 184, 0.3);
    padding: 0.1rem 0 0.1rem 1.5rem;
    color: #94a3b8;
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: 1.15rem;
    line-height: 1.7;
  }

  .entry-content :deep(code) {
    font-size: 0.875em;
    font-family: "IBM Plex Mono", "Fira Code", ui-monospace, monospace;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 0.35rem;
    padding: 0.12rem 0.38rem;
    color: #a5b4fc;
  }

  .entry-content :deep(pre) {
    overflow-x: auto;
    margin: 2rem 0;
    padding: 1.25rem 1.5rem;
    border-radius: 0.85rem;
    background: #020617;
    border: 1px solid rgba(148, 163, 184, 0.14);
  }

  @media (min-width: 900px) {
    .entry-page {
      padding-inline: 2rem;
    }
  }

  @media (max-width: 540px) {
    .entry-page {
      padding: 5.5rem 1rem 3rem;
    }

    .entry-cover {
      border-radius: 0.75rem;
    }
  }
</style>
