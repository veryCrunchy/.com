<script setup lang="ts">
  import { computed } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";
  import type { CmsStreetDeliveryGallery } from "~/types/directus";

  definePageMeta({
    layout: false,
  });

  const route = useRoute();
  const { data: shell } = await useCmsShell();

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const token = computed(() => String(route.params.token || "").trim());

  const { data: gallery, pending } = await useAsyncData(
    `street-delivery-gallery-${token.value}`,
    async () => {
      try {
        return await $fetch<CmsStreetDeliveryGallery>(
          `/api/cms/street-delivery/galleries/${encodeURIComponent(token.value)}`
        );
      } catch (error: unknown) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 500;

        if (statusCode === 404) {
          return null;
        }

        throw error;
      }
    }
  );

  const formattedDate = computed(() => {
    if (!gallery.value?.session.photographedAt) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(gallery.value.session.photographedAt));
  });

  useSeoMeta({
    title: () => `Your photos | ${site.value.siteName}`,
    description: () => "Street photo delivery gallery.",
  });
</script>

<template>
  <main class="gallery-page">
    <section class="gallery-shell">
      <div class="gallery-copy">
        <p class="gallery-kicker">Delivered</p>
        <h1>Your photos</h1>
        <p class="gallery-lede">
          Download the images below. If you need anything removed, message
          <a href="https://instagram.com/verycrunchy" target="_blank" rel="noopener">@verycrunchy</a>.
        </p>
        <div class="gallery-meta">
          <span class="gallery-chip">Code: {{ gallery?.session.code }}</span>
          <span v-if="gallery?.session.location" class="gallery-chip">{{ gallery.session.location }}</span>
          <span v-if="formattedDate" class="gallery-chip">{{ formattedDate }}</span>
        </div>
      </div>

      <div v-if="pending" class="gallery-state">
        <h2>Loading gallery…</h2>
      </div>

      <div v-else-if="!gallery" class="gallery-state">
        <h2>Gallery not found</h2>
        <p>This link isn’t active right now.</p>
      </div>

      <div v-else-if="!gallery.photos.length" class="gallery-state">
        <h2>Photos aren’t assigned yet</h2>
        <p>The gallery link exists, but no photos have been attached to it yet.</p>
      </div>

      <div v-else class="gallery-grid">
        <article
          v-for="photo in gallery.photos"
          :key="photo.id"
          class="gallery-item"
        >
          <img
            v-if="photo.image"
            :src="photo.image.fallbackUrl || photo.image.url || photo.image.previewUrl || undefined"
            :alt="photo.image.alt || photo.title"
            loading="lazy"
          >
          <div class="gallery-item-copy">
            <div>
              <h2>{{ photo.title }}</h2>
              <p v-if="photo.description">{{ photo.description }}</p>
            </div>
            <a
              class="gallery-download"
              :href="photo.image?.fallbackUrl || '#'"
              :download="photo.image?.downloadFilename || photo.title || undefined"
            >
              Download
            </a>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
  .gallery-page {
    min-height: 100dvh;
    padding: 6rem 1.25rem 2.5rem;
    background:
      radial-gradient(circle at top, rgba(251, 191, 36, 0.14), transparent 28%),
      linear-gradient(180deg, rgba(9, 11, 15, 0.98), rgb(7, 9, 13));
    color: #f4f4f5;
  }

  .gallery-shell {
    max-width: 76rem;
    margin: 0 auto;
    display: grid;
    gap: 1.8rem;
  }

  .gallery-kicker {
    margin: 0 0 0.8rem;
    font-size: 0.78rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(212, 212, 216, 0.66);
  }

  h1 {
    margin: 0;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.1rem, 4vw, 4rem);
    line-height: 0.96;
    letter-spacing: -0.04em;
  }

  .gallery-lede {
    margin: 1rem 0 0;
    max-width: 36rem;
    color: #c4c4cb;
    line-height: 1.6;
  }

  .gallery-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-top: 1.25rem;
  }

  .gallery-chip {
    border: 1px solid rgba(161, 161, 170, 0.24);
    border-radius: 999px;
    padding: 0.45rem 0.8rem;
    font-size: 0.8rem;
    color: #d4d4d8;
    background: rgba(24, 24, 27, 0.72);
  }

  .gallery-state {
    border: 1px solid rgba(161, 161, 170, 0.2);
    border-radius: 1.5rem;
    padding: 1.4rem;
    background: rgba(17, 18, 22, 0.94);
  }

  .gallery-state h2,
  .gallery-item-copy h2 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: -0.02em;
  }

  .gallery-state p,
  .gallery-item-copy p {
    margin: 0.6rem 0 0;
    color: #c4c4cb;
    line-height: 1.55;
  }

  .gallery-grid {
    display: grid;
    gap: 1.1rem;
  }

  @media (min-width: 760px) {
    .gallery-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .gallery-item {
    overflow: hidden;
    border: 1px solid rgba(161, 161, 170, 0.18);
    border-radius: 1.4rem;
    background: rgba(17, 18, 22, 0.94);
  }

  .gallery-item img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    background: rgba(24, 24, 27, 0.9);
  }

  .gallery-item-copy {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
  }

  .gallery-download {
    align-self: start;
    border: 1px solid rgba(161, 161, 170, 0.24);
    border-radius: 999px;
    padding: 0.62rem 0.9rem;
    color: #f4f4f5;
    white-space: nowrap;
  }
</style>
