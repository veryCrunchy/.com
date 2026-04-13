<script setup lang="ts">
  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const emptyTimeline = {
    id: 0,
    slug: "",
    title: "",
    description: "",
    story: "",
    publishedAt: null,
    tags: [],
    coverImage: null,
    photoCount: 0,
    entries: [],
  };

  const { data, pending } = await useAsyncData(
    () => `cms-timeline-${slug.value}`,
    () => $fetch(`/api/cms/timelines/${slug.value}`),
    {
      lazy: true,
      default: () => ({ timeline: emptyTimeline }),
    }
  );

  const timeline = computed(() => data.value.timeline || emptyTimeline);
  const isLoading = computed(() => pending.value && !timeline.value.id);

  useSeoMeta({
    title: computed(() => `${timeline.value.title || "Timeline"} | veryCrunchy`),
    description: computed(() => timeline.value.description || timeline.value.story || "A story-led photo timeline."),
  });
</script>

<template>
  <main class="timeline-detail-page">
    <section class="timeline-detail-shell">
      <NuxtLink to="/timelines" class="timeline-detail-back">← Timelines</NuxtLink>

      <div v-if="isLoading" class="timeline-detail-loading" aria-live="polite">
        <div class="timeline-detail-skeleton timeline-detail-skeleton-title" />
        <div class="timeline-detail-skeleton timeline-detail-skeleton-line" />
      </div>

      <template v-else>
        <header class="timeline-detail-head">
          <span class="timeline-detail-kicker">Timeline Story</span>
          <h1>{{ timeline.title }}</h1>
          <p v-if="timeline.description" class="timeline-detail-description">{{ timeline.description }}</p>
          <div v-if="timeline.story" class="timeline-detail-story">{{ timeline.story }}</div>
        </header>

        <section class="timeline-detail-entries">
          <article
            v-for="entry in timeline.entries"
            :key="entry.id"
            class="timeline-detail-entry"
          >
            <div class="timeline-detail-entry-copy">
              <span v-if="entry.chapterTitle" class="timeline-detail-entry-kicker">{{ entry.chapterTitle }}</span>
              <p v-if="entry.storyText">{{ entry.storyText }}</p>
              <p v-else>{{ entry.photo?.description || "Open the frame for the full image and archive context." }}</p>
            </div>

            <NuxtLink
              v-if="entry.photo"
              :to="`/photos/${entry.photo.slug}`"
              class="timeline-detail-entry-photo"
            >
              <PhotoAsset
                v-if="entry.photo.image"
                :src="entry.photo.image.previewUrl || entry.photo.image.url"
                :alt="entry.photo.image.alt || entry.photo.title"
                aspect-ratio="4 / 3"
              />
              <div class="timeline-detail-entry-caption">
                <strong>{{ entry.photo.title }}</strong>
                <span v-if="entry.photo.hasMotion">Motion {{ entry.photo.motionFrameCount }}</span>
              </div>
            </NuxtLink>
          </article>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
  .timeline-detail-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.1), transparent 32%),
      linear-gradient(180deg, #050608 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .timeline-detail-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .timeline-detail-back {
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .timeline-detail-head {
    margin-top: 1.4rem;
  }

  .timeline-detail-kicker,
  .timeline-detail-entry-kicker {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #86efac;
  }

  .timeline-detail-head h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .timeline-detail-description,
  .timeline-detail-story {
    max-width: 46rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #cbd5e1;
  }

  .timeline-detail-entries {
    display: grid;
    gap: 1.25rem;
    margin-top: 2rem;
  }

  .timeline-detail-entry {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    border-radius: 1.35rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
  }

  .timeline-detail-entry-copy p {
    margin-top: 0.7rem;
    line-height: 1.8;
    color: #cbd5e1;
  }

  .timeline-detail-entry-caption {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.8rem 0.95rem 0.95rem;
  }

  .timeline-detail-entry-caption strong {
    color: #f8fafc;
    font-family: "Syne", sans-serif;
    font-size: 1.2rem;
  }

  .timeline-detail-entry-caption span {
    color: #86efac;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .timeline-detail-skeleton {
    border-radius: 0.95rem;
    background: linear-gradient(110deg, rgba(148, 163, 184, 0.08) 8%, rgba(148, 163, 184, 0.18) 18%, rgba(148, 163, 184, 0.08) 33%);
    background-size: 200% 100%;
    animation: timeline-detail-shimmer 1.35s linear infinite;
  }

  .timeline-detail-skeleton-title {
    margin-top: 1.8rem;
    width: 52%;
    height: 2.8rem;
  }

  .timeline-detail-skeleton-line {
    margin-top: 1rem;
    width: 70%;
    height: 1rem;
  }

  @keyframes timeline-detail-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }

  @media (min-width: 920px) {
    .timeline-detail-entry {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      align-items: start;
    }
  }
</style>
