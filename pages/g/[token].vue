<script setup lang="ts">
  import { computed, reactive, ref } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";
  import type { CmsStreetDeliveryGallery } from "~/types/directus";

  definePageMeta({
    layout: false,
  });

  const route = useRoute();
  const { data: shell } = await useCmsShell();

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const token = computed(() => String(route.params.token || "").trim());

  const { data: galleryResponse, pending } = await useAsyncData(
    `street-delivery-gallery-${token.value}`,
    async () => {
      try {
        const gallery = await $fetch<CmsStreetDeliveryGallery>(
          `/api/cms/street-delivery/galleries/${encodeURIComponent(token.value)}`
        );

        return { gallery };
      } catch (error: unknown) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 500;

        if (statusCode === 404) {
          return { gallery: null };
        }

        throw error;
      }
    },
    {
      default: () => ({
        gallery: null as CmsStreetDeliveryGallery | null,
      }),
    }
  );
  const consentBusy = reactive<Record<number, boolean>>({});
  const consentError = ref("");
  const consentMessage = ref("");
  const gallery = computed(() => galleryResponse.value.gallery);

  const formattedDate = computed(() => {
    if (!gallery.value?.session.photographedAt) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(gallery.value.session.photographedAt));
  });

  function downloadUrl(assetId: string | null | undefined) {
    if (!assetId) {
      return "#";
    }

    return `/api/cms/street-delivery/galleries/${encodeURIComponent(token.value)}/download/${encodeURIComponent(assetId)}`;
  }

  async function updatePhotoConsent(linkId: number, consentPublish: boolean) {
    if (!gallery.value) {
      return;
    }

    consentBusy[linkId] = true;
    consentError.value = "";
    consentMessage.value = "";

    try {
      const nextGallery = await $fetch<CmsStreetDeliveryGallery>(
        `/api/cms/street-delivery/galleries/${encodeURIComponent(token.value)}/consent`,
        {
          method: "PATCH",
          body: {
            linkId,
            consentPublish,
          },
        }
      );

      galleryResponse.value = { gallery: nextGallery };
      consentMessage.value = "Sharing preference updated.";
    } catch (error: unknown) {
      consentError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not update sharing preference.")
          : "Could not update sharing preference.";
    } finally {
      consentBusy[linkId] = false;
    }
  }

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
        <p class="gallery-note">
          You can choose public sharing permission separately for each photo below.
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

      <template v-else>
        <p v-if="consentError" class="gallery-message is-error">{{ consentError }}</p>
        <p v-else-if="consentMessage" class="gallery-message">{{ consentMessage }}</p>

        <div class="gallery-grid">
          <article
            v-for="entry in gallery.photos"
            :key="entry.linkId"
            class="gallery-item"
          >
            <img
              v-if="entry.photo.image"
              :src="entry.photo.image.fallbackUrl || entry.photo.image.url || entry.photo.image.previewUrl || undefined"
              :alt="entry.photo.image.alt || entry.photo.title"
              loading="lazy"
            >
            <div class="gallery-item-copy">
              <div>
                <h2>{{ entry.photo.title }}</h2>
                <p v-if="entry.photo.description">{{ entry.photo.description }}</p>
                <label class="gallery-consent">
                  <input
                    :checked="entry.consentPublish"
                    :disabled="consentBusy[entry.linkId]"
                    type="checkbox"
                    @change="updatePhotoConsent(entry.linkId, ($event.target as HTMLInputElement).checked)"
                  >
                  <span>You may publish this photo publicly</span>
                </label>
              </div>
              <div class="gallery-item-actions">
                <a
                  class="gallery-download"
                  :href="downloadUrl(entry.photo.image?.id)"
                  :download="entry.photo.image?.downloadFilename || entry.photo.title || undefined"
                >
                  Download
                </a>
              </div>
            </div>
          </article>
        </div>
      </template>
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

  .gallery-note {
    margin: 0.85rem 0 0;
    color: #a1a1aa;
    line-height: 1.55;
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

  .gallery-message {
    margin: 0;
    color: #c4c4cb;
  }

  .gallery-message.is-error {
    color: #fca5a5;
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

  .gallery-item-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .gallery-consent {
    display: flex;
    gap: 0.7rem;
    align-items: start;
    margin-top: 0.9rem;
    color: #d4d4d8;
    line-height: 1.45;
  }

  .gallery-consent input {
    margin-top: 0.15rem;
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
