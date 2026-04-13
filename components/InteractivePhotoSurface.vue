<script setup lang="ts">
  import type { CmsPhotoSummary } from "~/types/directus";

  const props = withDefaults(
    defineProps<{
      photo: CmsPhotoSummary;
      aspectRatio?: string | null;
      fit?: "cover" | "contain";
      detailHref?: string | null;
      showDetailButton?: boolean;
      motionButtonLabel?: string;
      viewButtonLabel?: string;
    }>(),
    {
      aspectRatio: "4 / 3",
      fit: "cover",
      detailHref: null,
      showDetailButton: true,
      motionButtonLabel: "Motion",
      viewButtonLabel: "View",
    }
  );

  const viewerOpen = ref(false);
  const viewerMode = ref<"still" | "motion">("still");
  const motionReady = computed(
    () => props.photo.hasMotion && Array.isArray(props.photo.motionFrames) && props.photo.motionFrames.length > 0
  );

  function openViewer(mode: "still" | "motion" = "still") {
    viewerMode.value = mode;
    viewerOpen.value = true;
  }
</script>

<template>
  <div class="interactive-photo-surface">
    <div
      class="interactive-photo-stage"
      role="button"
      tabindex="0"
      :style="aspectRatio ? { aspectRatio } : undefined"
      @click="openViewer('still')"
      @keydown.enter.prevent="openViewer('still')"
      @keydown.space.prevent="openViewer('still')"
    >
      <MotionPhotoPlayer
        v-if="motionReady && photo.image"
        :final-image="photo.image"
        :motion-frames="photo.motionFrames"
        :alt="photo.title"
        :autoplay="false"
        :play-on-hover="true"
        :show-overlay-controls="false"
        :fit="fit"
      />
      <PhotoAsset
        v-else-if="photo.image"
        :src="photo.image.previewUrl || photo.image.url"
        :alt="photo.image.alt || photo.title"
        :aspect-ratio="aspectRatio"
        :fit="fit"
      />
      <div v-else class="interactive-photo-placeholder" />

      <div class="interactive-photo-actions">
        <span v-if="motionReady" class="interactive-photo-pill">
          {{ photo.motionFrameCount }} frame{{ photo.motionFrameCount !== 1 ? "s" : "" }}
        </span>
        <div class="interactive-photo-action-group">
          <button type="button" class="interactive-photo-action" @click.stop="openViewer('still')">
            {{ viewButtonLabel }}
          </button>
          <button
            v-if="motionReady"
            type="button"
            class="interactive-photo-action interactive-photo-action--accent"
            @click.stop="openViewer('motion')"
          >
            {{ motionButtonLabel }}
          </button>
          <NuxtLink
            v-if="detailHref && showDetailButton"
            :to="detailHref"
            class="interactive-photo-action"
            @click.stop
          >
            Page
          </NuxtLink>
        </div>
      </div>
    </div>

    <slot />

    <ClientOnly>
      <PhotoViewerModal
        v-model:open="viewerOpen"
        :image="photo.image"
        :motion-frames="photo.motionFrames"
        :title="photo.title"
        :description="photo.description"
        :initial-mode="viewerMode"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
  .interactive-photo-surface {
    display: grid;
    gap: 0;
  }

  .interactive-photo-stage {
    position: relative;
    overflow: hidden;
    width: 100%;
    border: none;
    padding: 0;
    border-radius: inherit;
    background: rgba(15, 23, 42, 0.5);
    text-align: left;
    cursor: pointer;
  }

  .interactive-photo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(15, 23, 42, 0.8));
  }

  .interactive-photo-actions {
    position: absolute;
    inset: auto 0 0 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem;
    background: linear-gradient(180deg, transparent, rgba(3, 5, 8, 0.78));
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  .interactive-photo-stage:hover .interactive-photo-actions,
  .interactive-photo-stage:focus-visible .interactive-photo-actions {
    opacity: 1;
    transform: translateY(0);
  }

  .interactive-photo-pill {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(4, 6, 7, 0.68);
    color: #e2e8f0;
    padding: 0.38rem 0.66rem;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .interactive-photo-action-group {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .interactive-photo-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.2rem;
    padding: 0.48rem 0.75rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(4, 6, 7, 0.72);
    color: #f8fafc;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .interactive-photo-action--accent {
    border-color: rgba(74, 222, 128, 0.24);
    background: rgba(34, 197, 94, 0.14);
    color: #dcfce7;
  }
</style>
