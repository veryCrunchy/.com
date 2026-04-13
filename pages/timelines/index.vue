<script setup lang="ts">
  const { data, pending } = await useAsyncData(
    "cms-timelines",
    () => $fetch("/api/cms/timelines"),
    {
      lazy: true,
      default: () => ({ timelines: [] }),
    }
  );

  const timelines = computed(() => data.value.timelines || []);

  useSeoMeta({
    title: "Timelines | veryCrunchy",
    description: "Curated photo timelines with story-led sequencing.",
  });
</script>

<template>
  <main class="timelines-page">
    <section class="timelines-shell">
      <header class="timelines-hero">
        <span class="timelines-kicker">Stories</span>
        <h1>Timelines</h1>
        <p>Curated sequences that use photographs and text together, so a session can read like a story instead of only a gallery.</p>
      </header>

      <section v-if="pending && !timelines.length" class="timelines-grid" aria-live="polite">
        <article v-for="index in 4" :key="index" class="timeline-card timeline-card-skeleton" aria-hidden="true">
          <div class="timeline-skeleton timeline-skeleton-image" />
          <div class="timeline-skeleton timeline-skeleton-title" />
          <div class="timeline-skeleton timeline-skeleton-line" />
        </article>
      </section>

      <section v-else class="timelines-grid">
        <NuxtLink
          v-for="timeline in timelines"
          :key="timeline.id"
          :to="`/timelines/${timeline.slug}`"
          class="timeline-card"
        >
          <div class="timeline-card-image">
            <PhotoAsset
              v-if="timeline.coverImage"
              :src="timeline.coverImage.previewUrl || timeline.coverImage.url"
              :alt="timeline.coverImage.alt || timeline.title"
              aspect-ratio="4 / 3"
            />
          </div>
          <div class="timeline-card-copy">
            <div class="timeline-card-head">
              <h2>{{ timeline.title }}</h2>
              <span>{{ timeline.photoCount }} entries</span>
            </div>
            <p>{{ timeline.description || timeline.story || "A curated timeline from the archive." }}</p>
          </div>
        </NuxtLink>
      </section>
    </section>
  </main>
</template>

<style scoped>
  .timelines-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.1), transparent 32%),
      linear-gradient(180deg, #050608 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .timelines-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .timelines-kicker {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #86efac;
  }

  .timelines-hero h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .timelines-hero p {
    max-width: 44rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #94a3b8;
  }

  .timelines-grid {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .timeline-card {
    overflow: hidden;
    border-radius: 1.35rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.3);
  }

  .timeline-card:hover {
    transform: translateY(-3px);
    border-color: rgba(134, 239, 172, 0.36);
  }

  .timeline-card-copy {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }

  .timeline-card-head {
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    align-items: baseline;
  }

  .timeline-card-head h2 {
    font-family: "Syne", sans-serif;
    font-size: 1.4rem;
    color: #f8fafc;
  }

  .timeline-card-head span {
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #86efac;
  }

  .timeline-card-copy p {
    line-height: 1.75;
    color: #cbd5e1;
  }

  .timeline-skeleton {
    border-radius: 0.95rem;
    background: linear-gradient(110deg, rgba(148, 163, 184, 0.08) 8%, rgba(148, 163, 184, 0.18) 18%, rgba(148, 163, 184, 0.08) 33%);
    background-size: 200% 100%;
    animation: timelines-shimmer 1.35s linear infinite;
  }

  .timeline-skeleton-image {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  .timeline-skeleton-title {
    margin: 1rem;
    width: 55%;
    height: 1.3rem;
  }

  .timeline-skeleton-line {
    margin: 0 1rem 1rem;
    height: 1rem;
  }

  @keyframes timelines-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
</style>
