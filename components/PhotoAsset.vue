<script setup lang="ts">
  const props = withDefaults(
    defineProps<{
      src?: string | null;
      srcset?: string | null;
      sizes?: string | null;
      fallbackSrc?: string | null;
      alt?: string | null;
      aspectRatio?: string | null;
      fit?: "cover" | "contain";
      loading?: "lazy" | "eager";
      fetchpriority?: "high" | "low" | "auto";
    }>(),
    {
      src: null,
      srcset: null,
      sizes: null,
      fallbackSrc: null,
      alt: null,
      aspectRatio: null,
      fit: "cover",
      loading: "lazy",
      fetchpriority: "auto",
    }
  );

  const isLoaded = ref(false);
  const hasError = ref(false);
  const currentSourceIndex = ref(0);
  const sources = computed(() => Array.from(new Set([props.src, props.fallbackSrc].filter(Boolean))) as string[]);
  const activeSrc = computed(() => sources.value[currentSourceIndex.value] || null);
  const activeSrcset = computed(() => currentSourceIndex.value === 0 ? props.srcset : null);
  const activeSizes = computed(() => currentSourceIndex.value === 0 ? props.sizes : null);

  watch(
    () => [props.src, props.fallbackSrc],
    () => {
      isLoaded.value = false;
      hasError.value = false;
      currentSourceIndex.value = 0;
    },
    { immediate: true }
  );

  function handleError() {
    if (currentSourceIndex.value < sources.value.length - 1) {
      currentSourceIndex.value += 1;
      isLoaded.value = false;
      return;
    }

    hasError.value = true;
  }
</script>

<template>
  <div
    class="photo-asset"
    :class="{
      'photo-asset--loaded': isLoaded,
      'photo-asset--contain': fit === 'contain',
      'photo-asset--empty': !activeSrc,
      'photo-asset--error': hasError,
    }"
    :style="aspectRatio ? { aspectRatio } : undefined"
  >
    <div class="photo-asset-skeleton" aria-hidden="true" />
    <img
      v-if="activeSrc"
      :src="activeSrc"
      :srcset="activeSrcset || undefined"
      :sizes="activeSizes || undefined"
      :alt="alt || ''"
      :loading="loading"
      :fetchpriority="fetchpriority"
      decoding="async"
      @load="isLoaded = true"
      @error="handleError"
    />
    <slot />
  </div>
</template>

<style scoped>
  .photo-asset {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    background:
      linear-gradient(145deg, rgba(10, 14, 18, 0.94), rgba(17, 24, 39, 0.82));
  }

  .photo-asset-skeleton {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(110deg, rgba(148, 163, 184, 0.05) 8%, rgba(148, 163, 184, 0.17) 18%, rgba(148, 163, 184, 0.05) 33%),
      radial-gradient(circle at top left, rgba(34, 197, 94, 0.13), transparent 42%);
    background-size: 200% 100%, auto;
    animation: photo-asset-shimmer 1.35s linear infinite;
    transition: opacity 0.3s ease;
  }

  .photo-asset img {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    opacity: 0;
    transform: scale(1.02);
    transition: opacity 0.32s ease, transform 0.45s ease;
  }

  .photo-asset--contain img {
    object-fit: contain;
    background: rgba(4, 6, 7, 0.82);
  }

  .photo-asset--loaded .photo-asset-skeleton {
    opacity: 0;
    pointer-events: none;
  }

  .photo-asset--loaded img {
    opacity: 1;
    transform: scale(1);
  }

  .photo-asset--empty .photo-asset-skeleton {
    opacity: 1;
  }

  .photo-asset--error .photo-asset-skeleton {
    opacity: 0.38;
    animation: none;
  }

  @keyframes photo-asset-shimmer {
    from {
      background-position: 200% 0, 0 0;
    }

    to {
      background-position: -200% 0, 0 0;
    }
  }
</style>
