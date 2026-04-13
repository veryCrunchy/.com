<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

  import type { CmsAsset, CmsMotionFrame } from "~/types/directus";

  const props = withDefaults(
    defineProps<{
      finalImage: CmsAsset | null;
      motionFrames?: CmsMotionFrame[];
      alt?: string | null;
      intervalMs?: number;
      autoplay?: boolean;
    }>(),
    {
      motionFrames: () => [],
      alt: null,
      intervalMs: 130,
      autoplay: true,
    }
  );

  const activeIndex = ref(0);
  const isPlaying = ref(false);
  const timer = ref<ReturnType<typeof setTimeout> | null>(null);

  const frames = computed(() => {
    const motion = (props.motionFrames || [])
      .map((frame) => frame.image)
      .filter((image): image is CmsAsset => Boolean(image));

    return props.finalImage ? [...motion, props.finalImage] : motion;
  });

  const currentFrame = computed(() => frames.value[activeIndex.value] || props.finalImage);
  const hasMotion = computed(() => frames.value.length > 1);

  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
  }

  function stepPlayback() {
    clearTimer();

    if (activeIndex.value >= frames.value.length - 1) {
      isPlaying.value = false;
      return;
    }

    timer.value = setTimeout(() => {
      activeIndex.value += 1;
      stepPlayback();
    }, props.intervalMs);
  }

  function playSequence() {
    if (!hasMotion.value) {
      return;
    }

    clearTimer();
    isPlaying.value = true;
    activeIndex.value = 0;
    stepPlayback();
  }

  function jumpToFinalFrame() {
    clearTimer();
    isPlaying.value = false;
    activeIndex.value = Math.max(0, frames.value.length - 1);
  }

  watch(
    () => frames.value.map((frame) => frame.id).join(","),
    () => {
      jumpToFinalFrame();
      if (props.autoplay && hasMotion.value) {
        playSequence();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    if (props.autoplay && hasMotion.value) {
      playSequence();
    }
  });

  onBeforeUnmount(() => {
    clearTimer();
  });
</script>

<template>
  <div class="motion-photo-player" :class="{ 'motion-photo-player--active': hasMotion }">
    <img
      v-if="currentFrame"
      class="motion-photo-player-image"
      :src="currentFrame.url"
      :alt="alt || currentFrame.alt || ''"
    />

    <div v-if="hasMotion" class="motion-photo-player-overlay">
      <span class="motion-photo-player-badge">
        {{ isPlaying ? `Frame ${activeIndex + 1} / ${frames.length}` : `Sequence ${frames.length - 1} + final` }}
      </span>
      <button type="button" class="motion-photo-player-button" @click="playSequence">
        Replay sequence
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

  .motion-photo-player-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    background: rgba(4, 6, 7, 0.82);
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

  .motion-photo-player-button:hover {
    background: rgba(34, 197, 94, 0.18);
  }
  </style>
