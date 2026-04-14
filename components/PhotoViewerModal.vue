<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from "vue";

  import type { CmsAsset, CmsMotionFrame } from "~/types/directus";

  type ViewerItem = {
    key: string;
    label?: string | null;
    description?: string | null;
    image: CmsAsset | null;
    motionFrames?: CmsMotionFrame[];
  };

  const props = withDefaults(
    defineProps<{
      open: boolean;
      gallery?: ViewerItem[];
      initialIndex?: number;
      initialMode?: "still" | "motion";
      // Legacy single-item fallback
      image?: CmsAsset | null;
      motionFrames?: CmsMotionFrame[];
      title?: string | null;
      description?: string | null;
    }>(),
    {
      gallery: () => [],
      initialIndex: 0,
      motionFrames: () => [],
      title: null,
      description: null,
      initialMode: "still",
      image: null,
    }
  );

  const emit = defineEmits<{
    (event: "update:open", value: boolean): void;
  }>();

  const currentIndex = ref(0);
  const mode = ref<"still" | "motion">("still");
  const canUseDom = import.meta.client;

  const effectiveGallery = computed<ViewerItem[]>(() => {
    if (props.gallery && props.gallery.length > 0) {
      return props.gallery;
    }

    return [{
      key: "single",
      label: props.title,
      description: props.description,
      image: props.image,
      motionFrames: props.motionFrames || [],
    }];
  });

  const currentItem = computed(() => effectiveGallery.value[currentIndex.value] || effectiveGallery.value[0]);
  const hasMultiple = computed(() => effectiveGallery.value.length > 1);
  const hasPrev = computed(() => currentIndex.value > 0);
  const hasNext = computed(() => currentIndex.value < effectiveGallery.value.length - 1);

  const hasMotion = computed(() => (currentItem.value?.motionFrames || []).some((frame) => frame.image));

  const imageRatio = computed(() => {
    const img = currentItem.value?.image;

    if (!img?.width || !img?.height) {
      return null;
    }

    return img.width / img.height;
  });

  const mediaStyle = computed(() => {
    const img = currentItem.value?.image;
    const ratio = imageRatio.value;

    if (!img?.width || !img?.height || !ratio) {
      return undefined;
    }

    return {
      aspectRatio: `${img.width} / ${img.height}`,
      "--photo-viewer-ratio": `${ratio}`,
    };
  });

  function closeViewer() {
    emit("update:open", false);
  }

  function goTo(index: number) {
    currentIndex.value = Math.max(0, Math.min(index, effectiveGallery.value.length - 1));

    if (!hasMotion.value) {
      mode.value = "still";
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeViewer();
    } else if (event.key === "ArrowLeft" && hasPrev.value) {
      goTo(currentIndex.value - 1);
    } else if (event.key === "ArrowRight" && hasNext.value) {
      goTo(currentIndex.value + 1);
    }
  }

  function syncViewerSideEffects(isOpen: boolean) {
    if (!canUseDom) {
      return;
    }

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeydown);
      return;
    }

    document.body.style.overflow = "";
    window.removeEventListener("keydown", onKeydown);
  }

  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen) {
        currentIndex.value = props.initialIndex ?? 0;
        const itemHasMotion = (effectiveGallery.value[currentIndex.value]?.motionFrames || []).some((f) => f.image);
        mode.value = props.initialMode === "motion" && itemHasMotion ? "motion" : "still";
      }

      syncViewerSideEffects(isOpen);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    syncViewerSideEffects(false);
  });
</script>

<template>
  <Teleport to="body">
    <Transition name="photo-viewer-fade">
      <div v-if="open" class="photo-viewer" @click.self="closeViewer">
        <div class="photo-viewer-shell">
          <div class="photo-viewer-topbar">
            <div>
              <span class="photo-viewer-kicker">{{ hasMultiple ? `${currentIndex + 1} / ${effectiveGallery.length}` : "Viewer" }}</span>
              <h2 v-if="currentItem?.label">{{ currentItem.label }}</h2>
            </div>
            <div class="photo-viewer-actions">
              <button
                v-if="hasMotion"
                type="button"
                class="photo-viewer-action"
                :class="{ 'is-active': mode === 'still' }"
                @click="mode = 'still'"
              >
                Still
              </button>
              <button
                v-if="hasMotion"
                type="button"
                class="photo-viewer-action"
                :class="{ 'is-active': mode === 'motion' }"
                @click="mode = 'motion'"
              >
                Motion
              </button>
              <button type="button" class="photo-viewer-close" @click="closeViewer">Close</button>
            </div>
          </div>

          <div class="photo-viewer-stage-wrap">
            <div class="photo-viewer-stage">
              <div class="photo-viewer-media" :style="mediaStyle">
                <MotionPhotoPlayer
                  v-if="currentItem?.image && mode === 'motion' && hasMotion"
                  :key="`motion-${currentItem.image.id}`"
                  :final-image="currentItem.image"
                  :motion-frames="currentItem.motionFrames || []"
                  :alt="currentItem.label || ''"
                  :autoplay="true"
                  :show-overlay-controls="true"
                  fit="contain"
                />
                <PhotoAsset
                  v-else-if="currentItem?.image"
                  :src="currentItem.image.url"
                  :srcset="currentItem.image.srcset"
                  sizes="(min-width: 1600px) 1200px, (min-width: 1024px) 85vw, 95vw"
                  :fallback-src="currentItem.image.fallbackUrl"
                  :alt="currentItem.image.alt || currentItem.label || ''"
                  fit="contain"
                />
              </div>
            </div>

            <button
              v-if="hasPrev"
              type="button"
              class="photo-viewer-nav photo-viewer-nav--prev"
              aria-label="Previous"
              @click="goTo(currentIndex - 1)"
            >←</button>
            <button
              v-if="hasNext"
              type="button"
              class="photo-viewer-nav photo-viewer-nav--next"
              aria-label="Next"
              @click="goTo(currentIndex + 1)"
            >→</button>
          </div>

          <p v-if="currentItem?.description" class="photo-viewer-description">{{ currentItem.description }}</p>

          <div v-if="hasMultiple" class="photo-viewer-strip">
            <button
              v-for="(item, i) in effectiveGallery"
              :key="item.key"
              type="button"
              class="photo-viewer-strip-thumb"
              :class="{ 'is-active': i === currentIndex }"
              :aria-label="item.label || `Frame ${i + 1}`"
              @click="goTo(i)"
            >
              <PhotoAsset
                :src="item.image?.previewUrl || item.image?.url"
                :srcset="item.image?.previewSrcset || item.image?.srcset"
                sizes="77px"
                :fallback-src="item.image?.fallbackUrl"
                :alt="item.image?.alt || item.label || ''"
                aspect-ratio="3 / 2"
              />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .photo-viewer {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(3, 5, 8, 0.84);
    backdrop-filter: blur(18px);
  }

  .photo-viewer-shell {
    width: min(100%, 88rem);
    max-height: calc(100dvh - 2rem);
    display: grid;
    gap: 1rem;
    padding: 1rem;
    border-radius: 1.6rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(8, 15, 10, 0.94);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.42);
  }

  .photo-viewer-topbar {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .photo-viewer-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #86efac;
  }

  .photo-viewer-topbar h2 {
    margin-top: 0.45rem;
    color: #f8fafc;
    font-family: "Syne", sans-serif;
    font-size: clamp(1.6rem, 3vw, 2.35rem);
    line-height: 1;
  }

  .photo-viewer-actions {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .photo-viewer-action,
  .photo-viewer-close {
    min-height: 2.6rem;
    padding: 0.62rem 0.95rem;
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(34, 197, 94, 0.08);
    color: #d1fae5;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  .photo-viewer-action.is-active {
    background: #dcfce7;
    color: #052e16;
  }

  .photo-viewer-close {
    border-color: rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
  }

  .photo-viewer-stage-wrap {
    position: relative;
  }

  .photo-viewer-stage {
    min-height: min(68dvh, 48rem);
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    overflow: hidden;
    border-radius: 1.2rem;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(4, 6, 7, 0.82);
  }

  .photo-viewer-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    width: 2.8rem;
    height: 2.8rem;
    border-radius: 50%;
    border: 1px solid rgba(74, 222, 128, 0.22);
    background: rgba(8, 15, 10, 0.82);
    color: #86efac;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    backdrop-filter: blur(6px);
  }

  .photo-viewer-nav:hover {
    background: rgba(34, 197, 94, 0.18);
    border-color: rgba(134, 239, 172, 0.4);
    color: #d1fae5;
  }

  .photo-viewer-nav--prev {
    left: 0.75rem;
  }

  .photo-viewer-nav--next {
    right: 0.75rem;
  }

  .photo-viewer-strip {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    justify-content: center;
    padding-block: 0.1rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(74, 222, 128, 0.18) transparent;
  }

  .photo-viewer-strip-thumb {
    flex: 0 0 auto;
    width: 4.8rem;
    height: 3.2rem;
    border-radius: 0.45rem;
    border: 2px solid rgba(148, 163, 184, 0.12);
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, opacity 0.15s;
    opacity: 0.52;
  }

  .photo-viewer-strip-thumb:hover {
    opacity: 0.85;
    border-color: rgba(74, 222, 128, 0.32);
  }

  .photo-viewer-strip-thumb.is-active {
    opacity: 1;
    border-color: rgba(74, 222, 128, 0.65);
  }

  .photo-viewer-strip-thumb :deep(.photo-asset) {
    width: 100%;
    height: 100%;
  }

  .photo-viewer-media {
    width: min(100%, calc(min(72dvh, 54rem) * var(--photo-viewer-ratio, 1)));
    max-height: min(72dvh, 54rem);
  }

  .photo-viewer-media :deep(.photo-asset),
  .photo-viewer-media :deep(.motion-photo-player) {
    width: 100%;
    height: 100%;
  }

  .photo-viewer-description {
    max-width: 60rem;
    color: #cbd5e1;
    line-height: 1.7;
  }

  .photo-viewer-fade-enter-active,
  .photo-viewer-fade-leave-active {
    transition: opacity 0.18s ease;
  }

  .photo-viewer-fade-enter-from,
  .photo-viewer-fade-leave-to {
    opacity: 0;
  }
</style>
