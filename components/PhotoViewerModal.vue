<script setup lang="ts">
  import { computed, onBeforeUnmount, watch } from "vue";

  import type { CmsAsset, CmsMotionFrame } from "~/types/directus";

  const props = withDefaults(
    defineProps<{
      open: boolean;
      image: CmsAsset | null;
      motionFrames?: CmsMotionFrame[];
      title?: string | null;
      description?: string | null;
      initialMode?: "still" | "motion";
    }>(),
    {
      motionFrames: () => [],
      title: null,
      description: null,
      initialMode: "still",
    }
  );

  const emit = defineEmits<{
    (event: "update:open", value: boolean): void;
  }>();

  const mode = ref<"still" | "motion">("still");
  const hasMotion = computed(() => (props.motionFrames || []).some((frame) => frame.image));
  const canUseDom = import.meta.client;
  const imageRatio = computed(() => {
    const width = props.image?.width;
    const height = props.image?.height;

    if (!width || !height) {
      return null;
    }

    return width / height;
  });
  const mediaStyle = computed(() => {
    const width = props.image?.width;
    const height = props.image?.height;
    const ratio = imageRatio.value;

    if (!width || !height || !ratio) {
      return undefined;
    }

    return {
      aspectRatio: `${width} / ${height}`,
      "--photo-viewer-ratio": `${ratio}`,
    };
  });

  function closeViewer() {
    emit("update:open", false);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeViewer();
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
        mode.value = props.initialMode === "motion" && hasMotion.value ? "motion" : "still";
      }

      syncViewerSideEffects(isOpen);
    },
    { immediate: true }
  );

  watch(
    () => props.initialMode,
    (nextMode) => {
      if (props.open) {
        mode.value = nextMode === "motion" && hasMotion.value ? "motion" : "still";
      }
    }
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
              <span class="photo-viewer-kicker">Viewer</span>
              <h2 v-if="title">{{ title }}</h2>
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

          <div class="photo-viewer-stage">
            <div class="photo-viewer-media" :style="mediaStyle">
              <MotionPhotoPlayer
                v-if="image && mode === 'motion' && hasMotion"
                :key="`motion-${image.id}`"
                :final-image="image"
                :motion-frames="motionFrames"
                :alt="title"
                :autoplay="true"
                :show-overlay-controls="true"
                fit="contain"
              />
              <PhotoAsset
                v-else-if="image"
                :src="image.url"
                :alt="image.alt || title || ''"
                fit="contain"
              />
            </div>
          </div>

          <p v-if="description" class="photo-viewer-description">{{ description }}</p>
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
