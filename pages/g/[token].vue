<script setup lang="ts">
  import { computed, reactive, ref, watch } from "vue";

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
  const activePreviewIndex = ref(0);
  const touchStartX = ref(0);
  const touchStartY = ref(0);
  const gallery = computed(() => galleryResponse.value.gallery);
  const downloadablePhotos = computed(() => gallery.value?.photos.filter((entry) => entry.photo.image?.id) || []);
  const activePreviewEntry = computed(() => downloadablePhotos.value[activePreviewIndex.value] || downloadablePhotos.value[0] || null);
  const activePreviewImage = computed(() => {
    const image = activePreviewEntry.value?.photo.image;

    return image?.fallbackUrl || image?.url || image?.previewUrl || "";
  });

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

  const downloadAllUrl = computed(() => `/api/cms/street-delivery/galleries/${encodeURIComponent(token.value)}/download-all`);

  function setPreviewIndex(index: number) {
    const count = downloadablePhotos.value.length;

    if (!count) {
      activePreviewIndex.value = 0;
      return;
    }

    activePreviewIndex.value = (index + count) % count;
  }

  function showPreviousPhoto() {
    setPreviewIndex(activePreviewIndex.value - 1);
  }

  function showNextPhoto() {
    setPreviewIndex(activePreviewIndex.value + 1);
  }

  function handlePreviewTouchStart(event: TouchEvent) {
    const touch = event.touches[0];

    touchStartX.value = touch?.clientX || 0;
    touchStartY.value = touch?.clientY || 0;
  }

  function handlePreviewTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - touchStartX.value;
    const deltaY = touch.clientY - touchStartY.value;

    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      return;
    }

    if (deltaX > 0) {
      showPreviousPhoto();
    } else {
      showNextPhoto();
    }
  }

  watch(downloadablePhotos, (photos) => {
    if (activePreviewIndex.value >= photos.length) {
      activePreviewIndex.value = Math.max(photos.length - 1, 0);
    }
  });

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

        <section
          v-if="activePreviewEntry"
          class="gallery-preview"
          tabindex="0"
          aria-label="Photo preview"
          @keydown.left.prevent="showPreviousPhoto"
          @keydown.right.prevent="showNextPhoto"
        >
          <div
            class="gallery-preview-stage"
            @touchstart.passive="handlePreviewTouchStart"
            @touchend.passive="handlePreviewTouchEnd"
          >
            <button
              class="gallery-preview-nav is-left"
              type="button"
              aria-label="Previous photo"
              @click="showPreviousPhoto"
            >
              ‹
            </button>
            <img
              :src="activePreviewImage"
              :alt="activePreviewEntry.photo.image?.alt || activePreviewEntry.photo.title"
            >
            <button
              class="gallery-preview-nav is-right"
              type="button"
              aria-label="Next photo"
              @click="showNextPhoto"
            >
              ›
            </button>
          </div>
          <div class="gallery-preview-bar">
            <div class="gallery-preview-copy">
              <p>{{ activePreviewIndex + 1 }} / {{ downloadablePhotos.length }}</p>
              <h2>{{ activePreviewEntry.photo.title }}</h2>
            </div>
            <div class="gallery-preview-actions">
              <a
                class="gallery-download is-primary"
                :href="downloadAllUrl"
                :download="`${gallery.session.code || 'street-gallery'}-photos.zip`"
              >
                Download all
              </a>
              <a
                class="gallery-download"
                :href="downloadUrl(activePreviewEntry.photo.image?.id)"
                :download="activePreviewEntry.photo.image?.downloadFilename || activePreviewEntry.photo.title || undefined"
              >
                Download photo
              </a>
            </div>
          </div>
          <div class="gallery-preview-strip" aria-label="Choose photo">
            <button
              v-for="(entry, index) in downloadablePhotos"
              :key="entry.linkId"
              class="gallery-preview-thumb"
              :class="{ 'is-active': index === activePreviewIndex }"
              type="button"
              :aria-label="`Preview ${entry.photo.title}`"
              @click="setPreviewIndex(index)"
            >
              <img
                :src="entry.photo.image?.previewUrl || entry.photo.image?.fallbackUrl || entry.photo.image?.url || undefined"
                :alt="entry.photo.image?.alt || entry.photo.title"
                loading="lazy"
              >
            </button>
          </div>
        </section>

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
              @click="setPreviewIndex(downloadablePhotos.findIndex((item) => item.linkId === entry.linkId))"
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

  .gallery-preview {
    display: grid;
    gap: 1rem;
    outline: none;
  }

  .gallery-preview:focus-visible .gallery-preview-stage {
    border-color: rgba(251, 191, 36, 0.72);
    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.16);
  }

  .gallery-preview-stage {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    min-height: min(72vh, 46rem);
    border: 1px solid rgba(212, 212, 216, 0.18);
    border-radius: 1.2rem;
    background:
      linear-gradient(135deg, rgba(39, 39, 42, 0.92), rgba(7, 9, 13, 0.94)),
      #111216;
    box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.3);
  }

  .gallery-preview-stage img {
    display: block;
    width: 100%;
    max-height: min(72vh, 46rem);
    object-fit: contain;
  }

  .gallery-preview-nav {
    position: absolute;
    top: 50%;
    z-index: 1;
    width: 3.25rem;
    height: 3.25rem;
    border: 1px solid rgba(244, 244, 245, 0.22);
    border-radius: 50%;
    background: rgba(9, 11, 15, 0.72);
    color: #f4f4f5;
    font-size: 2.45rem;
    line-height: 1;
    transform: translateY(-50%);
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .gallery-preview-nav:hover,
  .gallery-preview-nav:focus-visible {
    border-color: rgba(251, 191, 36, 0.74);
    background: rgba(24, 24, 27, 0.92);
    transform: translateY(-50%) scale(1.04);
  }

  .gallery-preview-nav.is-left {
    left: 1rem;
  }

  .gallery-preview-nav.is-right {
    right: 1rem;
  }

  .gallery-preview-bar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .gallery-preview-copy {
    min-width: 0;
  }

  .gallery-preview-copy p {
    margin: 0 0 0.25rem;
    color: #a1a1aa;
    font-size: 0.82rem;
  }

  .gallery-preview-copy h2 {
    margin: 0;
    font-size: clamp(1.2rem, 2.2vw, 2rem);
    letter-spacing: -0.03em;
  }

  .gallery-preview-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.65rem;
  }

  .gallery-preview-strip {
    display: flex;
    gap: 0.55rem;
    overflow-x: auto;
    padding-bottom: 0.2rem;
    scrollbar-color: rgba(161, 161, 170, 0.65) transparent;
  }

  .gallery-preview-thumb {
    flex: 0 0 auto;
    overflow: hidden;
    width: 5.4rem;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: 0.65rem;
    padding: 0;
    background: rgba(39, 39, 42, 0.7);
    cursor: pointer;
    opacity: 0.62;
    transition: border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
  }

  .gallery-preview-thumb:hover,
  .gallery-preview-thumb:focus-visible,
  .gallery-preview-thumb.is-active {
    border-color: rgba(251, 191, 36, 0.82);
    opacity: 1;
    transform: translateY(-1px);
  }

  .gallery-preview-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    cursor: zoom-in;
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
    text-decoration: none;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .gallery-download:hover,
  .gallery-download:focus-visible {
    border-color: rgba(251, 191, 36, 0.72);
    background: rgba(251, 191, 36, 0.1);
  }

  .gallery-download.is-primary {
    border-color: #fbbf24;
    background: #fbbf24;
    color: #111216;
    font-weight: 700;
  }

  .gallery-download.is-primary:hover,
  .gallery-download.is-primary:focus-visible {
    background: #fcd34d;
    color: #111216;
  }

  @media (max-width: 640px) {
    .gallery-page {
      padding: 2.6rem 1rem 2.25rem;
    }

    .gallery-preview-stage {
      width: calc(100% + 2rem);
      min-height: 56vh;
      margin-inline: -1rem;
      border-radius: 0.9rem;
      touch-action: pan-y;
    }

    .gallery-preview-stage img {
      max-height: 62vh;
    }

    .gallery-preview-nav {
      width: 2.75rem;
      height: 2.75rem;
      font-size: 2rem;
    }

    .gallery-preview-nav.is-left {
      left: 0.65rem;
    }

    .gallery-preview-nav.is-right {
      right: 0.65rem;
    }

    .gallery-preview-bar,
    .gallery-item-copy {
      display: grid;
    }

    .gallery-preview-copy h2 {
      font-size: 1.22rem;
    }

    .gallery-preview-actions,
    .gallery-item-actions {
      justify-content: stretch;
      align-items: stretch;
    }

    .gallery-download {
      width: 100%;
      text-align: center;
    }

    .gallery-preview-thumb {
      width: 4.4rem;
      border-radius: 0.55rem;
    }
  }

  @media (max-width: 420px) {
    .gallery-shell {
      gap: 1.4rem;
    }

    .gallery-preview-stage {
      min-height: 48vh;
    }

    .gallery-preview-stage img {
      max-height: 54vh;
    }

    .gallery-preview-nav {
      top: auto;
      bottom: 0.75rem;
      transform: none;
    }

    .gallery-preview-nav:hover,
    .gallery-preview-nav:focus-visible {
      transform: scale(1.04);
    }

    .gallery-preview-thumb {
      width: 4rem;
    }
  }
</style>
