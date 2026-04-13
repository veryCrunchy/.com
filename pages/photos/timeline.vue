<script setup lang="ts">
  import { computed } from "vue";

  const { data, pending } = await useAsyncData(
    "cms-photos-timeline",
    () => $fetch("/api/cms/photos-timeline"),
    {
      lazy: true,
      default: () => ({ photos: [] }),
    }
  );

  const photos = computed(() => data.value.photos || []);

  const timelineGroups = computed(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        items: typeof photos.value;
      }
    >();

    for (const photo of photos.value) {
      const timestamp = photo.takenAt || photo.publishedAt || "";
      const date = timestamp ? new Date(timestamp) : null;
      const key = timestamp ? timestamp.slice(0, 10) : "undated";
      const label = date
        ? new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(date)
        : "Undated";
      const group = groups.get(key) || { key, label, items: [] };
      group.items.push(photo);
      groups.set(key, group);
    }

    return [...groups.values()];
  });

  useSeoMeta({
    title: "Photo Timeline | veryCrunchy",
    description: "A chronological timeline view of the photo archive.",
  });
</script>

<template>
  <main class="timeline-page">
    <section class="timeline-shell">
      <header class="timeline-hero">
        <span class="timeline-kicker">Story View</span>
        <h1>Timeline</h1>
        <p>A chronological pass through the archive for sessions, sequences, and the little turns that made a day feel like a story.</p>
        <div class="timeline-actions">
          <NuxtLink to="/photos" class="timeline-action timeline-action-secondary">Back to grid</NuxtLink>
        </div>
      </header>

      <section v-if="pending && !photos.length" class="timeline-loading" aria-live="polite">
        <article v-for="index in 4" :key="index" class="timeline-item timeline-item-skeleton" aria-hidden="true">
          <div class="timeline-node" />
          <div class="timeline-card">
            <div class="timeline-skeleton timeline-skeleton-image" />
            <div class="timeline-skeleton timeline-skeleton-title" />
            <div class="timeline-skeleton timeline-skeleton-line" />
            <div class="timeline-skeleton timeline-skeleton-line timeline-skeleton-line-short" />
          </div>
        </article>
      </section>

      <section v-else class="timeline-groups">
        <div v-for="group in timelineGroups" :key="group.key" class="timeline-group">
          <div class="timeline-date">{{ group.label }}</div>

          <article
            v-for="(photo, index) in group.items"
            :key="photo.id"
            class="timeline-item"
            :class="{ 'timeline-item--reverse': index % 2 === 1 }"
          >
            <div class="timeline-node" />

            <NuxtLink :to="`/photos/${photo.slug}`" class="timeline-card">
              <div class="timeline-card-image">
                <PhotoAsset
                  v-if="photo.image"
                  :src="photo.image.previewUrl || photo.image.url"
                  :alt="photo.image.alt || photo.title"
                  aspect-ratio="4 / 3"
                />
              </div>

              <div class="timeline-card-copy">
                <div class="timeline-card-head">
                  <div>
                    <span class="timeline-card-kicker">
                      {{ photo.sets?.[0]?.title || "Single frame" }}
                    </span>
                    <h2>{{ photo.title }}</h2>
                  </div>
                  <span class="timeline-card-date">
                    {{ photo.takenAt ? new Date(photo.takenAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) : "Undated" }}
                  </span>
                </div>

                <p>{{ photo.description || "Open the frame for the full image and notes." }}</p>

                <div class="timeline-card-meta">
                  <span v-if="photo.location">{{ photo.location }}</span>
                  <span v-if="photo.camera">{{ photo.camera }}</span>
                  <span v-if="photo.hasMotion">Motion sequence · {{ photo.motionFrameCount }} frame{{ photo.motionFrameCount !== 1 ? "s" : "" }}</span>
                </div>
              </div>
            </NuxtLink>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
  .timeline-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.1), transparent 30%),
      linear-gradient(180deg, #050608 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .timeline-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .timeline-hero h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .timeline-kicker,
  .timeline-card-kicker {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #86efac;
  }

  .timeline-hero p {
    max-width: 46rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #94a3b8;
  }

  .timeline-actions {
    margin-top: 1.25rem;
  }

  .timeline-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.6rem;
    padding: 0.7rem 1rem;
    border-radius: 999px;
    font-weight: 600;
  }

  .timeline-action-secondary {
    background: rgba(34, 197, 94, 0.08);
    color: #d1fae5;
    border: 1px solid rgba(74, 222, 128, 0.22);
  }

  .timeline-groups {
    position: relative;
    margin-top: 2.5rem;
  }

  .timeline-groups::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(50% - 1px);
    width: 2px;
    background: linear-gradient(180deg, rgba(74, 222, 128, 0.22), rgba(148, 163, 184, 0.08));
  }

  .timeline-group + .timeline-group {
    margin-top: 2.2rem;
  }

  .timeline-date {
    position: sticky;
    top: 4.25rem;
    z-index: 2;
    width: fit-content;
    margin: 0 auto 1.2rem;
    padding: 0.48rem 0.9rem;
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.18);
    background: rgba(4, 6, 7, 0.72);
    color: #d1fae5;
    backdrop-filter: blur(12px);
  }

  .timeline-item {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.25rem minmax(0, 1fr);
    gap: 1.25rem;
    align-items: center;
    margin-bottom: 1.4rem;
  }

  .timeline-item--reverse .timeline-card {
    grid-column: 1;
  }

  .timeline-item:not(.timeline-item--reverse) .timeline-card {
    grid-column: 3;
  }

  .timeline-node {
    grid-column: 2;
    justify-self: center;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 999px;
    background: #86efac;
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12);
  }

  .timeline-card {
    overflow: hidden;
    border-radius: 1.35rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.9);
    box-shadow: 0 28px 44px rgba(0, 0, 0, 0.28);
  }

  .timeline-card:hover {
    transform: translateY(-3px);
    border-color: rgba(134, 239, 172, 0.34);
  }

  .timeline-card-copy {
    padding: 1rem;
  }

  .timeline-card-head {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    align-items: start;
  }

  .timeline-card h2 {
    margin-top: 0.4rem;
    font-family: "Syne", sans-serif;
    font-size: 1.65rem;
    line-height: 1;
    color: #f8fafc;
  }

  .timeline-card-date {
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #86efac;
    white-space: nowrap;
  }

  .timeline-card-copy p {
    margin-top: 0.85rem;
    line-height: 1.8;
    color: #cbd5e1;
  }

  .timeline-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 0.9rem;
  }

  .timeline-card-meta span {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.2);
    background: rgba(34, 197, 94, 0.12);
    color: #d1fae5;
    padding: 0.28rem 0.6rem;
    font-size: 0.75rem;
  }

  .timeline-skeleton {
    border-radius: 0.95rem;
    background: linear-gradient(110deg, rgba(148, 163, 184, 0.08) 8%, rgba(148, 163, 184, 0.18) 18%, rgba(148, 163, 184, 0.08) 33%);
    background-size: 200% 100%;
    animation: timeline-shimmer 1.35s linear infinite;
  }

  .timeline-skeleton-image {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  .timeline-skeleton-title {
    margin: 1rem;
    width: 50%;
    height: 1.4rem;
  }

  .timeline-skeleton-line {
    margin: 0 1rem 0.75rem;
    height: 1rem;
  }

  .timeline-skeleton-line-short {
    width: 70%;
  }

  @keyframes timeline-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }

  @media (max-width: 860px) {
    .timeline-groups::before {
      left: 0.45rem;
    }

    .timeline-item,
    .timeline-item--reverse {
      grid-template-columns: 1.3rem minmax(0, 1fr);
    }

    .timeline-item .timeline-card,
    .timeline-item--reverse .timeline-card {
      grid-column: 2;
    }

    .timeline-node {
      grid-column: 1;
    }
  }

  @media (max-width: 540px) {
    .timeline-page {
      padding: 5.5rem 1rem 3rem;
    }

    .timeline-card h2 {
      font-size: 1.35rem;
    }
  }
</style>
