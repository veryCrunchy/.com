<script setup lang="ts">
  import { computed } from "vue";

  const route = useRoute();
  const slug = computed(() => String(route.params.slug || ""));

  const { data } = await useAsyncData(
    () => `cms-photo-${slug.value}`,
    () => $fetch(`/api/cms/photos/${slug.value}`)
  );

  const photo = computed(() => data.value.photo);

  // Set context: when navigating from a set page via ?from=setSlug
  const fromSet = computed(() => String(route.query.from || ""));

  const { data: setCtxData } = await useAsyncData(
    () => (fromSet.value ? `cms-photoset-${fromSet.value}` : "__no-set-ctx__"),
    async () => {
      if (!fromSet.value) return null;
      return $fetch(`/api/cms/photosets/${fromSet.value}`);
    }
  );

  const setContext = computed(() => setCtxData.value?.photoset ?? null);

  const photoIndexInSet = computed(() => {
    if (!setContext.value?.photos) return -1;
    return setContext.value.photos.findIndex((p: { slug: string }) => p.slug === slug.value);
  });

  const prevInSet = computed(() => {
    if (photoIndexInSet.value <= 0) return null;
    return setContext.value!.photos[photoIndexInSet.value - 1];
  });

  const nextInSet = computed(() => {
    const idx = photoIndexInSet.value;
    if (idx === -1 || !setContext.value || idx >= setContext.value.photos.length - 1) return null;
    return setContext.value.photos[idx + 1];
  });

  useSeoMeta({
    title: computed(() => `${photo.value.title} | Photos | veryCrunchy`),
    description: computed(
      () => photo.value.description || "Photography archive from veryCrunchy."
    ),
    ogTitle: computed(() => photo.value.title),
    ogDescription: computed(
      () => photo.value.description || "Photography archive from veryCrunchy."
    ),
    ogImage: computed(() => photo.value.image?.url || ""),
  });

  function formatDate(value: string | null) {
    if (!value) return "Undated";

    return new Intl.DateTimeFormat("en", {
      dateStyle: "long",
    }).format(new Date(value));
  }
</script>

<template>
  <main class="photo-entry-page">
    <section class="photo-entry-shell">
      <div class="photo-entry-topbar">
        <NuxtLink to="/photos" class="photo-entry-back">← Photos</NuxtLink>
        <nav v-if="setContext" class="photo-entry-set-nav">
          <NuxtLink
            v-if="prevInSet"
            :to="`/photos/${prevInSet.slug}?from=${fromSet}`"
            :title="prevInSet.title"
            class="set-nav-arrow"
          >←</NuxtLink>
          <span v-else class="set-nav-gap" />
          <NuxtLink :to="`/photosets/${setContext.slug}`" class="set-nav-pill">
            {{ setContext.title }}<span class="set-nav-count"> · {{ photoIndexInSet + 1 }} / {{ setContext.photos.length }}</span>
          </NuxtLink>
          <NuxtLink
            v-if="nextInSet"
            :to="`/photos/${nextInSet.slug}?from=${fromSet}`"
            :title="nextInSet.title"
            class="set-nav-arrow"
          >→</NuxtLink>
          <span v-else class="set-nav-gap" />
        </nav>
      </div>

      <header
        class="photo-entry-head"
        data-directus-collection="photos"
        :data-directus-item="photo.id"
      >
        <div>
          <h1 data-directus-field="title">{{ photo.title }}</h1>
          <p v-if="photo.description" class="photo-entry-description" data-directus-field="description">{{ photo.description }}</p>
        </div>
        <div class="photo-entry-meta">
          <div>
            <span class="photo-entry-meta-label">Captured</span>
            <strong data-directus-field="taken_at">{{ formatDate(photo.takenAt || photo.publishedAt) }}</strong>
          </div>
          <div v-if="photo.location">
            <span class="photo-entry-meta-label">Location</span>
            <strong data-directus-field="location">{{ photo.location }}</strong>
          </div>
          <div v-if="photo.camera">
            <span class="photo-entry-meta-label">Camera</span>
            <strong data-directus-field="camera">{{ photo.camera }}</strong>
          </div>
          <div v-if="photo.lens">
            <span class="photo-entry-meta-label">Lens</span>
            <strong data-directus-field="lens">{{ photo.lens }}</strong>
          </div>
        </div>
      </header>

      <div v-if="photo.image" class="photo-entry-frame" data-directus-collection="photos" :data-directus-item="photo.id" data-directus-field="image">
        <img :src="photo.image.url" :alt="photo.image.alt || photo.title" />
      </div>

      <div v-if="photo.tags.length" class="photo-entry-tags">
        <span v-for="tag in photo.tags" :key="tag">{{ tag }}</span>
      </div>

      <div v-if="photo.sets?.length" class="photo-entry-in-sets">
        <span class="photo-entry-in-sets-label">Part of</span>
        <NuxtLink
          v-for="set in photo.sets"
          :key="set.slug"
          :to="`/photosets/${set.slug}`"
          class="photo-entry-set-chip"
        >{{ set.title }}</NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
  .photo-entry-page {
    min-height: 100dvh;
    padding: 6.75rem 1.25rem 4rem;
    background:
      radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent 36%),
      linear-gradient(180deg, #040607 0%, #0a0c10 100%);
    color: #e2e8f0;
  }

  .photo-entry-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .photo-entry-back {
    display: inline-flex;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .photo-entry-back:hover {
    color: #e2e8f0;
  }

  .photo-entry-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .photo-entry-set-nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .set-nav-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(8, 15, 10, 0.6);
    color: #94a3b8;
    font-size: 0.82rem;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .set-nav-arrow:hover {
    border-color: rgba(134, 239, 172, 0.38);
    color: #86efac;
    background: rgba(34, 197, 94, 0.08);
  }

  .set-nav-gap {
    display: inline-block;
    width: 1.9rem;
  }

  .set-nav-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.72rem;
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.08);
    font-size: 0.78rem;
    color: #86efac;
    white-space: nowrap;
    transition: border-color 0.15s, background 0.15s;
  }

  .set-nav-pill:hover {
    border-color: rgba(134, 239, 172, 0.38);
    background: rgba(34, 197, 94, 0.14);
  }

  .set-nav-count {
    color: #64748b;
  }

  .photo-entry-in-sets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    margin-top: 1.2rem;
  }

  .photo-entry-in-sets-label {
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
  }

  .photo-entry-set-chip {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.1);
    color: #86efac;
    padding: 0.28rem 0.68rem;
    font-size: 0.78rem;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }

  .photo-entry-set-chip:hover {
    border-color: rgba(134, 239, 172, 0.38);
    background: rgba(34, 197, 94, 0.16);
    color: #d1fae5;
  }

  .photo-entry-head {
    display: grid;
    gap: 1.2rem;
    margin-top: 1.4rem;
  }

  .photo-entry-head h1 {
    margin-top: 0.7rem;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.6rem, 5vw, 4.4rem);
    line-height: 0.96;
    letter-spacing: -0.05em;
    color: #f8fafc;
  }

  .photo-entry-description {
    max-width: 42rem;
    margin-top: 1rem;
    line-height: 1.85;
    color: #cbd5e1;
  }

  .photo-entry-meta {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }

  .photo-entry-meta div {
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 222, 128, 0.16);
    background: rgba(8, 15, 10, 0.9);
  }

  .photo-entry-meta-label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #86efac;
    margin-bottom: 0.35rem;
  }

  .photo-entry-meta strong {
    color: #f0fdf4;
    font-weight: 500;
  }

  .photo-entry-frame {
    overflow: hidden;
    margin-top: 1.8rem;
    border-radius: 1.8rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 10, 0.92);
    box-shadow: 0 28px 44px rgba(0, 0, 0, 0.34);
  }

  .photo-entry-frame img {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .photo-entry-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1.2rem;
  }

  .photo-entry-tags span {
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.12);
    color: #d1fae5;
    padding: 0.3rem 0.68rem;
    font-size: 0.75rem;
  }

  @media (min-width: 980px) {
    .photo-entry-page {
      padding-inline: 2rem;
    }

    .photo-entry-head {
      grid-template-columns: minmax(0, 1.3fr) minmax(16rem, 0.7fr);
      align-items: end;
    }
  }

  @media (max-width: 540px) {
    .photo-entry-page {
      padding: 5.5rem 1rem 3rem;
    }

    .photo-entry-frame {
      border-radius: 1rem;
    }

    .set-nav-pill {
      max-width: 9rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style>
