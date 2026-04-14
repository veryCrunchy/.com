<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from "vue";

  import type { CmsAsset, CmsMotionFrame } from "~/types/directus";

  const props = withDefaults(
    defineProps<{
      finalImage: CmsAsset | null;
      motionFrames?: CmsMotionFrame[];
      alt?: string | null;
      fit?: "cover" | "contain";
      intervalMs?: number;
      transitionMs?: number;
      finalFrameHoldMs?: number;
      frameDurationsMs?: number[];
      autoplay?: boolean;
      playOnHover?: boolean;
      showOverlayControls?: boolean;
    }>(),
    {
      motionFrames: () => [],
      alt: null,
      fit: "contain",
      intervalMs: 130,
      transitionMs: 55,
      finalFrameHoldMs: 1400,
      frameDurationsMs: () => [],
      autoplay: true,
      playOnHover: false,
      showOverlayControls: true,
    }
  );

  // ─── Refs ────────────────────────────────────────────────────────────────────

  const activeIndex = ref(0);
  const isPlaying = ref(false);
  const timer = ref<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const previousFrameIndex = ref<number | null>(null);
  const isTransitioning = ref(false);

  // Preload tracking
  const framesReady = ref(false);
  const isPreloading = ref(false);
  const pendingPlay = ref(false);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const frames = computed(() => {
    const motion = (props.motionFrames || [])
      .map((frame) => frame.image)
      .filter((image): image is CmsAsset => Boolean(image));

    return props.finalImage ? [...motion, props.finalImage] : motion;
  });

  const currentFrame = computed(() => frames.value[activeIndex.value] || props.finalImage);
  const previousFrame = computed(() => {
    if (previousFrameIndex.value === null) return null;
    return frames.value[previousFrameIndex.value] || null;
  });
  const hasMotion = computed(() => frames.value.length > 1);

  const playbackDurations = computed(() => {
    const lastIndex = frames.value.length - 1;
    const lastMotionIndex = Math.max(0, lastIndex - 1);

    return frames.value.map((_, index) => {
      const explicit = Number(props.frameDurationsMs?.[index]);

      if (Number.isFinite(explicit) && explicit > 0) {
        return explicit;
      }

      if (index === lastIndex) {
        return props.finalFrameHoldMs;
      }

      if (index === lastMotionIndex) {
        return Math.max(props.intervalMs + 50, 160);
      }

      return props.intervalMs;
    });
  });

  const transitionStyle = computed(() => ({
    "--motion-transition-ms": `${props.transitionMs}ms`,
  }));

  // ─── Playback helpers ─────────────────────────────────────────────────────────

  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
  }

  function clearTransitionTimer() {
    if (transitionTimer.value) {
      clearTimeout(transitionTimer.value);
      transitionTimer.value = null;
    }
  }

  function finishTransition() {
    clearTransitionTimer();
    previousFrameIndex.value = null;
    isTransitioning.value = false;
  }

  function advanceFrame(nextIndex: number) {
    clearTransitionTimer();
    previousFrameIndex.value = activeIndex.value;
    activeIndex.value = nextIndex;
    isTransitioning.value = true;

    transitionTimer.value = setTimeout(finishTransition, props.transitionMs);
  }

  function stepPlayback() {
    clearTimer();

    const lastIndex = frames.value.length - 1;

    if (lastIndex < 0) {
      isPlaying.value = false;
      return;
    }

    if (activeIndex.value >= lastIndex) {
      timer.value = setTimeout(() => {
        isPlaying.value = false;
        timer.value = null;
      }, playbackDurations.value[lastIndex] || props.finalFrameHoldMs);
      return;
    }

    timer.value = setTimeout(() => {
      advanceFrame(activeIndex.value + 1);
      stepPlayback();
    }, playbackDurations.value[activeIndex.value] || props.intervalMs);
  }

  function playSequence() {
    if (!hasMotion.value || !framesReady.value) return;

    clearTimer();
    finishTransition();
    isPlaying.value = true;
    activeIndex.value = 0;
    stepPlayback();
  }

  function jumpToFinalFrame() {
    clearTimer();
    finishTransition();
    isPlaying.value = false;
    activeIndex.value = Math.max(0, frames.value.length - 1);
  }

  // ─── Preloading ───────────────────────────────────────────────────────────────

  function decodeImage(url: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const img = new window.Image();
      img.src = url;
      img.decode()
        .then(() => resolve())
        .catch(() => resolve()); // don't block on errors
    });
  }

  async function preloadAllFrames(): Promise<void> {
    if (!import.meta.client || frames.value.length === 0) {
      framesReady.value = true;
      return;
    }

    isPreloading.value = true;

    try {
      await Promise.all(frames.value.map((frame) => decodeImage(frame.url)));
    } finally {
      framesReady.value = true;
      isPreloading.value = false;

      if (pendingPlay.value) {
        pendingPlay.value = false;
        playSequence();
      }
    }
  }

  // ─── Hover ────────────────────────────────────────────────────────────────────

  function handleMouseEnter() {
    if (!props.playOnHover || !hasMotion.value) return;

    if (framesReady.value) {
      playSequence();
    } else {
      pendingPlay.value = true;
    }
  }

  function handleMouseLeave() {
    if (!props.playOnHover || !hasMotion.value) return;

    pendingPlay.value = false;
    jumpToFinalFrame();
  }

  defineExpose({ playSequence, jumpToFinalFrame });

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  watch(
    () => frames.value.map((frame) => frame.id).join(","),
    () => {
      framesReady.value = false;
      pendingPlay.value = false;
      jumpToFinalFrame();

      if (!hasMotion.value) {
        framesReady.value = true;
        return;
      }

      if (props.autoplay) {
        pendingPlay.value = true;
      }

      preloadAllFrames();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    clearTimer();
    clearTransitionTimer();
  });
</script>

<template>
  <div
    class="motion-photo-player"
    :class="{
      'motion-photo-player--active': hasMotion,
      'motion-photo-player--cover': fit === 'cover',
      'motion-photo-player--contain': fit === 'contain',
    }"
    :style="transitionStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="motion-photo-player-stage">
      <img
        v-if="currentFrame"
        class="motion-photo-player-image"
        :src="currentFrame.url"
        :alt="alt || currentFrame.alt || ''"
        decoding="async"
        fetchpriority="high"
      />

      <img
        v-if="previousFrame"
        class="motion-photo-player-image motion-photo-player-image--previous"
        :class="{ 'motion-photo-player-image--fading': isTransitioning }"
        :src="previousFrame.url"
        :alt="alt || previousFrame.alt || ''"
        decoding="async"
        aria-hidden="true"
      />
    </div>

    <Transition name="motion-loading-fade">
      <div v-if="isPreloading" class="motion-photo-player-loading" aria-hidden="true" />
    </Transition>

    <div v-if="hasMotion && showOverlayControls" class="motion-photo-player-overlay">
      <span class="motion-photo-player-badge">
        {{ isPlaying ? `Frame ${activeIndex + 1} / ${frames.length}` : `Moment sequence · ${frames.length - 1} frames` }}
      </span>
      <button
        type="button"
        class="motion-photo-player-button"
        :disabled="isPreloading"
        @click="playSequence"
      >
        {{ isPreloading ? "Loading…" : "Replay moment" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
  .motion-photo-player {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(145deg, rgba(10, 14, 18, 0.94), rgba(17, 24, 39, 0.82));
  }

  .motion-photo-player-stage {
    position: relative;
  }

  .motion-photo-player-image {
    width: 100%;
    height: 100%;
    display: block;
    background: rgba(4, 6, 7, 0.82);
  }

  .motion-photo-player--contain .motion-photo-player-image {
    object-fit: contain;
  }

  .motion-photo-player--cover .motion-photo-player-image {
    object-fit: cover;
  }

  .motion-photo-player--contain .motion-photo-player-stage {
    height: 100%;
  }

  .motion-photo-player--cover .motion-photo-player-stage {
    height: 100%;
  }

  .motion-photo-player-image--previous {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
    opacity: 1;
    transition: opacity var(--motion-transition-ms) cubic-bezier(0.22, 1, 0.36, 1);
    will-change: opacity;
  }

  .motion-photo-player-image--fading {
    opacity: 0;
  }

  .motion-photo-player-overlay {
    position: absolute;
    inset: auto 1rem 1rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    z-index: 2;
  }

  .motion-photo-player-badge,
  .motion-photo-player-button {
    border-radius: 999px;
    backdrop-filter: blur(12px);
  }

  .motion-photo-player-badge {
    padding: 0.45rem 0.72rem;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(4, 6, 7, 0.68);
    color: #d1fae5;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .motion-photo-player-button {
    border: 1px solid rgba(74, 222, 128, 0.24);
    background: rgba(34, 197, 94, 0.12);
    color: #dcfce7;
    padding: 0.5rem 0.85rem;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .motion-photo-player-loading {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    border-radius: inherit;
    background: linear-gradient(
      110deg,
      transparent 0%,
      rgba(74, 222, 128, 0.04) 40%,
      rgba(74, 222, 128, 0.09) 50%,
      rgba(74, 222, 128, 0.04) 60%,
      transparent 100%
    );
    background-size: 240% 100%;
    animation: motion-player-shimmer 1.4s linear infinite;
  }

  @keyframes motion-player-shimmer {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }

  .motion-loading-fade-enter-active,
  .motion-loading-fade-leave-active {
    transition: opacity 0.25s ease;
  }

  .motion-loading-fade-enter-from,
  .motion-loading-fade-leave-to {
    opacity: 0;
  }

  .motion-photo-player-button:disabled {
    opacity: 0.6;
    cursor: default;
  }


  </style>
