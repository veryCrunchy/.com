<script setup lang="ts">
/**
 * PageArticle — the large "article in the papers" chapter card.
 *
 * Props:
 *   chapterNum      — chapter/issue number shown top-left (e.g. "02")
 *   chapterLabel    — optional right-of-number label (e.g. "Founder & CEO")
 *   watermark       — large ghosted background text (e.g. "OBIENTE")
 *   title           — main heading (supports a link via titleHref)
 *   titleHref       — makes title a link (opens in new tab)
 *   tagline         — italic subheading below the title
 *   description     — body paragraph text
 *   theme           — colour theme: 'blue'|'green'|'purple'|'orange'|'pink'|'white'  (default: 'blue')
 *   marqueeItems    — array of strings for the scrolling marquee (omit to hide)
 *   footerLinks     — array of { href, label } for bottom link row
 *
 * Slots:
 *   default         — card grid content (use ArticleCard components inside)
 */
const props = withDefaults(defineProps<{
  chapterNum?:   string
  chapterLabel?: string
  watermark?:    string
  title:         string
  titleHref?:    string
  tagline?:      string
  description?:  string
  theme?:        'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'white'
  marqueeItems?: string[]
  footerLinks?:  Array<{ href: string; label: string; dim?: boolean }>
}>(), {
  theme: 'blue',
})

// Double items for seamless marquee loop
const doubledMarquee = computed(() =>
  props.marqueeItems ? [...props.marqueeItems, ...props.marqueeItems] : []
)
</script>

<template>
  <div class="pa-wrap">
  <div class="pa-root" :class="`pa-theme--${theme}`">

    <!-- Top row: chapter num + label + watermark -->
    <div v-if="chapterNum || watermark" class="pa-top">
      <div class="pa-top-left">
        <span v-if="chapterNum" class="pa-ch-num">{{ chapterNum }}</span>
        <span v-if="chapterLabel" class="pa-role-pill">
          <span class="pa-role-dot"></span>{{ chapterLabel }}
        </span>
      </div>
      <div v-if="watermark" class="pa-watermark" aria-hidden="true">{{ watermark }}</div>
    </div>

    <!-- Intro block -->
    <div class="pa-intro">
      <h2 class="pa-title">
        <a
          v-if="titleHref"
          :href="titleHref"
          target="_blank"
          rel="noopener"
          class="pa-title-link"
        >{{ title }}</a>
        <template v-else>{{ title }}</template>
      </h2>
      <p v-if="tagline" class="pa-tagline">{{ tagline }}</p>
      <p v-if="description" class="pa-desc">{{ description }}</p>
    </div>

    <!-- Marquee (optional) -->
    <div v-if="marqueeItems?.length" class="pa-marquee-track">
      <div class="pa-marquee">
        <template v-for="(item, i) in doubledMarquee" :key="`m-${i}`">
          <span>{{ item }}</span>
          <span class="pa-msep">✦</span>
        </template>
      </div>
    </div>

    <!-- Card grid (slot) -->
    <div v-if="$slots.default" class="pa-grid">
      <slot />
    </div>

    <!-- Footer links -->
    <div v-if="footerLinks?.length" class="pa-footer">
      <a
        v-for="link in footerLinks"
        :key="link.href"
        :href="link.href"
        target="_blank"
        rel="noopener"
        class="pa-link"
        :class="link.dim ? 'pa-link--dim' : ''"
      >{{ link.label }}</a>
    </div>

  </div>
  </div>
</template>

<style scoped>
/* ── Root shell ────────────────────────────── */

/* Wrapper provides the stacked-sheets shadow — sits outside overflow clip */
.pa-wrap {
  position: relative;
  margin-bottom: clamp(4rem, 8vw, 6rem);
  perspective: 1800px;
  transform-style: preserve-3d;
  height: 100%;
}

/* Ghost sheet layers (behind the card) */
.pa-wrap::before,
.pa-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 1.5rem;
  pointer-events: none;
  z-index: -1;
  border: 1px solid rgba(113, 113, 122, 0.18);
}

.pa-wrap::before {
  inset: 0 -12px -8px 12px;
  background:
    linear-gradient(90deg, rgba(248, 250, 252, 0.02), rgba(14, 16, 22, 0.78)),
    rgba(14, 16, 22, 0.72);
  opacity: 0.58;
  transform: scaleY(0.988);
}

.pa-wrap::after {
  inset: 0 -24px -16px 24px;
  background:
    linear-gradient(90deg, rgba(248, 250, 252, 0.01), rgba(12, 14, 20, 0.62)),
    rgba(12, 14, 20, 0.5);
  opacity: 0.34;
  transform: scaleY(0.976);
}

.pa-root {
  border-radius: 1.5rem;
  border: 1px solid;
  padding: 1.75rem 2rem 2.25rem;
  height: 100%;
  position: relative;
  overflow-x: hidden;
  overflow-y: hidden;
  backdrop-filter: blur(4px);
  transform-origin: left center;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  box-shadow: 0 28px 70px -34px rgba(0, 0, 0, 0.62);
}

.pa-root::before,
.pa-root::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pa-root::before {
  inset: 0 auto 0 0;
  width: 1.35rem;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent);
  opacity: 0.35;
}

.pa-root::after {
  inset: 0 0 0 auto;
  width: 1.8rem;
  background: linear-gradient(270deg, rgba(255, 255, 255, 0.06), transparent);
  opacity: 0.18;
}

/* ── Themes ────────────────────────────────── */
/* Blue */
.pa-theme--blue {
  border-color: rgba(59, 130, 246, 0.14);
  background: rgba(8, 12, 24, 0.65);
}
.pa-theme--blue .pa-ch-num    { color: rgba(59, 130, 246, 0.6); }
.pa-theme--blue .pa-role-pill { color: rgba(96, 165, 250, 0.75); border-color: rgba(59, 130, 246, 0.25); }
.pa-theme--blue .pa-role-dot  { background: #60a5fa; }
.pa-theme--blue .pa-title-link {
  background: linear-gradient(135deg, #e4e4e7 0%, #60a5fa 45%, #93c5fd 75%, #e4e4e7 100%);
  background-size: 250% 250%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: shimmer 6s ease infinite;
}
.pa-theme--blue .pa-tagline   { color: rgba(96, 165, 250, 0.65); }
.pa-theme--blue .pa-watermark { color: rgba(59, 130, 246, 0.035); }
.pa-theme--blue .pa-marquee   { color: rgba(96, 165, 250, 0.45); }
.pa-theme--blue .pa-msep      { color: rgba(96, 165, 250, 0.18); }
.pa-theme--blue .pa-marquee-track {
  border-top-color: rgba(59, 130, 246, 0.1);
  border-bottom-color: rgba(59, 130, 246, 0.1);
}
.pa-theme--blue .pa-footer    { border-top-color: rgba(59, 130, 246, 0.1); }
.pa-theme--blue .pa-link      { color: rgba(147, 197, 253, 0.65); }
.pa-theme--blue .pa-link:hover{ color: rgba(147, 197, 253, 1); }
.pa-theme--blue .pa-link--dim { color: rgba(147, 197, 253, 0.28); }

/* Green */
.pa-theme--green {
  border-color: rgba(74, 222, 128, 0.1);
  background: rgba(8, 18, 12, 0.6);
}
.pa-theme--green .pa-ch-num    { color: rgba(74, 222, 128, 0.55); }
.pa-theme--green .pa-role-pill { color: rgba(74, 222, 128, 0.7); border-color: rgba(74, 222, 128, 0.22); }
.pa-theme--green .pa-role-dot  { background: #4ade80; }
.pa-theme--green .pa-title-link {
  background: linear-gradient(135deg, #e4e4e7 0%, #4ade80 45%, #86efac 75%, #e4e4e7 100%);
  background-size: 250% 250%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: shimmer-green 6s ease infinite;
}
.pa-theme--green .pa-tagline   { color: rgba(134, 239, 172, 0.7); }
.pa-theme--green .pa-watermark { color: rgba(74, 222, 128, 0.04); }
.pa-theme--green .pa-marquee   { color: rgba(74, 222, 128, 0.45); }
.pa-theme--green .pa-msep      { color: rgba(74, 222, 128, 0.18); }
.pa-theme--green .pa-marquee-track {
  border-top-color: rgba(74, 222, 128, 0.08);
  border-bottom-color: rgba(74, 222, 128, 0.08);
}
.pa-theme--green .pa-footer    { border-top-color: rgba(74, 222, 128, 0.08); }
.pa-theme--green .pa-link      { color: rgba(134, 239, 172, 0.65); }
.pa-theme--green .pa-link:hover{ color: rgba(134, 239, 172, 1); }
.pa-theme--green .pa-link--dim { color: rgba(134, 239, 172, 0.3); }

/* Purple */
.pa-theme--purple {
  border-color: rgba(168, 85, 247, 0.12);
  background: rgba(12, 8, 20, 0.65);
}
.pa-theme--purple .pa-ch-num    { color: rgba(168, 85, 247, 0.6); }
.pa-theme--purple .pa-role-pill { color: rgba(192, 132, 252, 0.7); border-color: rgba(168, 85, 247, 0.25); }
.pa-theme--purple .pa-role-dot  { background: #c084fc; }
.pa-theme--purple .pa-title-link {
  background: linear-gradient(135deg, #e4e4e7 0%, #c084fc 45%, #ddd6fe 75%, #e4e4e7 100%);
  background-size: 250% 250%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: shimmer 6s ease infinite;
}
.pa-theme--purple .pa-tagline   { color: rgba(192, 132, 252, 0.65); }
.pa-theme--purple .pa-watermark { color: rgba(168, 85, 247, 0.04); }
.pa-theme--purple .pa-marquee   { color: rgba(192, 132, 252, 0.42); }
.pa-theme--purple .pa-msep      { color: rgba(192, 132, 252, 0.18); }
.pa-theme--purple .pa-marquee-track {
  border-top-color:    rgba(168, 85, 247, 0.1);
  border-bottom-color: rgba(168, 85, 247, 0.1);
}
.pa-theme--purple .pa-footer    { border-top-color: rgba(168, 85, 247, 0.1); }
.pa-theme--purple .pa-link      { color: rgba(216, 180, 254, 0.65); }
.pa-theme--purple .pa-link:hover{ color: rgba(216, 180, 254, 1); }
.pa-theme--purple .pa-link--dim { color: rgba(216, 180, 254, 0.28); }

/* Orange */
.pa-theme--orange {
  border-color: rgba(249, 115, 22, 0.12);
  background: rgba(18, 10, 5, 0.65);
}
.pa-theme--orange .pa-ch-num    { color: rgba(249, 115, 22, 0.6); }
.pa-theme--orange .pa-role-pill { color: rgba(251, 146, 60, 0.7); border-color: rgba(249, 115, 22, 0.25); }
.pa-theme--orange .pa-role-dot  { background: #fb923c; }
.pa-theme--orange .pa-title-link {
  background: linear-gradient(135deg, #e4e4e7 0%, #fb923c 45%, #fed7aa 75%, #e4e4e7 100%);
  background-size: 250% 250%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: shimmer 6s ease infinite;
}
.pa-theme--orange .pa-tagline   { color: rgba(251, 146, 60, 0.65); }
.pa-theme--orange .pa-watermark { color: rgba(249, 115, 22, 0.04); }
.pa-theme--orange .pa-marquee   { color: rgba(251, 146, 60, 0.45); }
.pa-theme--orange .pa-msep      { color: rgba(251, 146, 60, 0.18); }
.pa-theme--orange .pa-marquee-track {
  border-top-color:    rgba(249, 115, 22, 0.1);
  border-bottom-color: rgba(249, 115, 22, 0.1);
}
.pa-theme--orange .pa-footer    { border-top-color: rgba(249, 115, 22, 0.1); }
.pa-theme--orange .pa-link      { color: rgba(253, 186, 116, 0.65); }
.pa-theme--orange .pa-link:hover{ color: rgba(253, 186, 116, 1); }
.pa-theme--orange .pa-link--dim { color: rgba(253, 186, 116, 0.28); }

/* Pink */
.pa-theme--pink {
  border-color: rgba(236, 72, 153, 0.12);
  background: rgba(20, 8, 16, 0.65);
}
.pa-theme--pink .pa-ch-num    { color: rgba(236, 72, 153, 0.6); }
.pa-theme--pink .pa-role-pill { color: rgba(244, 114, 182, 0.7); border-color: rgba(236, 72, 153, 0.25); }
.pa-theme--pink .pa-role-dot  { background: #f472b6; }
.pa-theme--pink .pa-title-link {
  background: linear-gradient(135deg, #e4e4e7 0%, #f472b6 45%, #fbcfe8 75%, #e4e4e7 100%);
  background-size: 250% 250%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: shimmer 6s ease infinite;
}
.pa-theme--pink .pa-tagline   { color: rgba(244, 114, 182, 0.65); }
.pa-theme--pink .pa-watermark { color: rgba(236, 72, 153, 0.04); }
.pa-theme--pink .pa-marquee   { color: rgba(244, 114, 182, 0.42); }
.pa-theme--pink .pa-msep      { color: rgba(244, 114, 182, 0.18); }
.pa-theme--pink .pa-marquee-track {
  border-top-color:    rgba(236, 72, 153, 0.1);
  border-bottom-color: rgba(236, 72, 153, 0.1);
}
.pa-theme--pink .pa-footer    { border-top-color: rgba(236, 72, 153, 0.1); }
.pa-theme--pink .pa-link      { color: rgba(249, 168, 212, 0.65); }
.pa-theme--pink .pa-link:hover{ color: rgba(249, 168, 212, 1); }
.pa-theme--pink .pa-link--dim { color: rgba(249, 168, 212, 0.28); }

/* White (neutral) */
.pa-theme--white {
  border-color: rgba(228, 228, 231, 0.1);
  background: rgba(18, 18, 22, 0.7);
}
.pa-theme--white .pa-ch-num    { color: rgba(228, 228, 231, 0.4); }
.pa-theme--white .pa-role-pill { color: rgba(228, 228, 231, 0.55); border-color: rgba(228, 228, 231, 0.18); }
.pa-theme--white .pa-role-dot  { background: #e4e4e7; }
.pa-theme--white .pa-title-link {
  background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 50%, #ffffff 100%);
  background-size: 250% 250%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: shimmer 8s ease infinite;
}
.pa-theme--white .pa-tagline   { color: rgba(161, 161, 170, 0.75); }
.pa-theme--white .pa-watermark { color: rgba(228, 228, 231, 0.03); }
.pa-theme--white .pa-marquee   { color: rgba(161, 161, 170, 0.4); }
.pa-theme--white .pa-msep      { color: rgba(161, 161, 170, 0.15); }
.pa-theme--white .pa-marquee-track {
  border-top-color:    rgba(228, 228, 231, 0.08);
  border-bottom-color: rgba(228, 228, 231, 0.08);
}
.pa-theme--white .pa-footer    { border-top-color: rgba(228, 228, 231, 0.08); }
.pa-theme--white .pa-link      { color: rgba(212, 212, 216, 0.65); }
.pa-theme--white .pa-link:hover{ color: rgba(212, 212, 216, 1); }
.pa-theme--white .pa-link--dim { color: rgba(212, 212, 216, 0.28); }

/* ── Top header row ────────────────────────── */
.pa-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 1;
}

.pa-top-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pa-watermark {
  position: absolute;
  top: -0.75rem;
  right: -0.5rem;
  font-family: "Syne", sans-serif;
  font-size: clamp(4rem, 14vw, 11rem);
  font-weight: 800;
  letter-spacing: -0.05em;
  pointer-events: none;
  user-select: none;
  line-height: 1;
  white-space: nowrap;
}

.pa-ch-num {
  font-family: "Syne", sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3em;
}

.pa-role-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-radius: 99px;
  padding: 0.22rem 0.65rem;
  border: 1px solid;
}

.pa-role-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  animation: pulse-dot 2.4s ease-in-out infinite;
  flex-shrink: 0;
}

/* ── Intro ─────────────────────────────────── */
.pa-intro {
  position: relative;
  z-index: 1;
  margin-bottom: 1.25rem;
}

.pa-title {
  font-family: "Syne", sans-serif;
  font-size: clamp(2.2rem, 6vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: #e4e4e7;
}

.pa-title-link { text-decoration: none; }

.pa-tagline {
  font-family: "Instrument Serif", serif;
  font-style: italic;
  font-size: clamp(1rem, 2.5vw, 1.3rem);
  margin-top: 0.35rem;
}

.pa-desc {
  font-size: 0.875rem;
  line-height: 1.7;
  color: #71717a;
  max-width: 60ch;
  margin-top: 0.75rem;
}

/* ── Marquee ───────────────────────────────── */
.pa-marquee-track {
  overflow: hidden;
  border-top: 1px solid;
  border-bottom: 1px solid;
  padding: 0.55rem 0;
  margin: 0 -2rem 1.5rem;
  position: relative;
  z-index: 1;
}

.pa-marquee {
  display: flex;
  gap: 2rem;
  width: max-content;
  animation: marquee 32s linear infinite;
  font-family: "Syne", sans-serif;
  font-weight: 600;
  font-size: 0.68rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
}

@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ── Card grid (slot) ──────────────────────── */
.pa-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  position: relative;
  z-index: 1;
}

@media (min-width: 640px) {
  .pa-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .pa-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Wide card spans 2 cols */
.pa-grid :deep(.ac-wide) { grid-column: span 2; }

/* Full-width slot items: sub-rules, leads, full-col wrappers, para-cards */
.pa-grid :deep(.ch-sub-rule),
.pa-grid :deep(.ch-sub-lead),
.pa-grid :deep(.ch-full),
.pa-grid :deep(.para-card) { grid-column: 1 / -1; }

/* Theme-tinted sub-rule accents */
.pa-theme--green  :deep(.ch-sub-num)   { color: rgba(74, 222, 128, 0.28); }
.pa-theme--green  :deep(.ch-sub-title) { color: rgba(74, 222, 128, 0.4); }
.pa-theme--green  :deep(.ch-sub-rule)  { border-bottom-color: rgba(74, 222, 128, 0.1); }
.pa-theme--blue   :deep(.ch-sub-num)   { color: rgba(59, 130, 246, 0.32); }
.pa-theme--blue   :deep(.ch-sub-title) { color: rgba(96, 165, 250, 0.45); }
.pa-theme--blue   :deep(.ch-sub-rule)  { border-bottom-color: rgba(59, 130, 246, 0.1); }
.pa-theme--purple :deep(.ch-sub-num)   { color: rgba(168, 85, 247, 0.32); }
.pa-theme--purple :deep(.ch-sub-title) { color: rgba(192, 132, 252, 0.45); }
.pa-theme--purple :deep(.ch-sub-rule)  { border-bottom-color: rgba(168, 85, 247, 0.1); }
.pa-theme--orange :deep(.ch-sub-num)   { color: rgba(249, 115, 22, 0.32); }
.pa-theme--orange :deep(.ch-sub-title) { color: rgba(251, 146, 60, 0.45); }
.pa-theme--orange :deep(.ch-sub-rule)  { border-bottom-color: rgba(249, 115, 22, 0.1); }
.pa-theme--pink   :deep(.ch-sub-num)   { color: rgba(236, 72, 153, 0.32); }
.pa-theme--pink   :deep(.ch-sub-title) { color: rgba(244, 114, 182, 0.45); }
.pa-theme--pink   :deep(.ch-sub-rule)  { border-bottom-color: rgba(236, 72, 153, 0.1); }

/* ── Footer links ──────────────────────────── */
.pa-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid;
  position: relative;
  z-index: 1;
}

.pa-link {
  font-size: 0.82rem;
  text-decoration: none;
  transition: color 0.18s ease;
  cursor: none;
}

/* ── Animations ────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes shimmer-green {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.82); }
}

@media (max-width: 640px) {
  .pa-wrap::before {
    inset: 0 -8px -6px 8px;
  }

  .pa-wrap::after {
    inset: 0 -16px -12px 16px;
  }
}
</style>
