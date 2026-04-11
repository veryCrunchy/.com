<script setup lang="ts">
/**
 * ArticleCard — a stylized editorial card component.
 *
 * Props:
 *   eyebrow     — small uppercase label above the title (e.g. "Infrastructure · Go")
 *   title       — card heading
 *   description — body text (supports raw HTML via v-html)
 *   tags        — array of { label, variant? } objects  variant: 'blue'|'rust'|'green'|'purple'|'orange'|default
 *   link        — { href, label, target? }  optional CTA button
 *   accentColor — top accent bar:  'blue'|'orange'|'purple'|'green'|'pink'|'none'  (default: 'none')
 *   theme       — card background theme: 'dark'|'darker'|'ob' (obiente green-tinted)  (default: 'dark')
 *   wide        — spans 2 columns when inside a multi-col ob-grid  (default: false)
 *   footer      — { label, live? } optional footer meta row
 *   status      — replaces link btn with a pill label (e.g. 'In progress')
 */
const props = withDefaults(defineProps<{
  eyebrow?:     string
  title:        string
  description?: string
  tags?:        Array<{ label: string; variant?: 'blue' | 'rust' | 'green' | 'purple' | 'orange' }>
  link?:        { href: string; label: string; target?: string; variant?: 'default' | 'green' }
  accentColor?: 'blue' | 'orange' | 'purple' | 'green' | 'pink' | 'none'
  theme?:       'dark' | 'darker' | 'ob'
  wide?:        boolean
  footer?:      { label: string; live?: boolean }
  status?:      string
}>(), {
  accentColor: 'none',
  theme: 'dark',
  wide: false,
})
</script>

<template>
  <article
    class="ac-root hover"
    :class="[
      `ac-theme--${theme}`,
      wide && 'ac-wide',
    ]"
    hs-dist="90"
  >
    <!-- Accent bar (optional) -->
    <div v-if="accentColor !== 'none'" class="ac-accent" :class="`ac-accent--${accentColor}`"></div>

    <div class="ac-body">
      <!-- Header row -->
      <div class="ac-head">
        <div>
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <h3 class="ac-title">{{ title }}</h3>
        </div>
        <a
          v-if="link"
          :href="link.href"
          :target="link.target ?? '_self'"
          :rel="link.target === '_blank' ? 'noopener' : undefined"
          class="ac-btn"
          :class="link.variant === 'green' ? 'ac-btn--green' : 'ac-btn--default'"
        >{{ link.label }}</a>
        <span v-else-if="status" class="ac-status-pill">{{ status }}</span>
      </div>

      <!-- Description (slot or prop) -->
      <p v-if="description" class="ac-desc" v-html="description"></p>
      <div v-else-if="$slots.default" class="ac-desc">
        <slot />
      </div>

      <!-- Tags -->
      <div v-if="tags?.length" class="ac-tags">
        <span
          v-for="t in tags"
          :key="t.label"
          class="ac-tag"
          :class="t.variant ? `ac-tag--${t.variant}` : ''"
        >{{ t.label }}</span>
      </div>

      <!-- Footer -->
      <div v-if="footer" class="ac-foot">
        <span class="ac-foot-label">{{ footer.label }}</span>
        <span v-if="footer.live" class="ac-live">
          <span class="ac-live-dot"></span>Live
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* ── Root ──────────────────────────────────── */
.ac-root {
  border-radius: 0.85rem;
  border: 1px solid rgba(113, 113, 122, 0.42);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
}

.ac-root:hover {
  box-shadow: 0 18px 40px -14px rgba(0, 0, 0, 0.55);
}

/* Wide column span (used inside ob-grid) */
.ac-wide { /* handled in parent grid via :class="wide && 'ac-wide'" */ }

/* ── Themes ────────────────────────────────── */
.ac-theme--dark {
  background: rgba(16, 17, 22, 0.7);
}
.ac-theme--dark:hover  { border-color: rgba(148, 163, 184, 0.32); }

.ac-theme--darker {
  background: rgba(10, 10, 14, 0.82);
  border-style: dashed;
  border-color: rgba(113, 113, 122, 0.28);
}
.ac-theme--darker:hover { border-color: rgba(148, 163, 184, 0.28); }

.ac-theme--ob {
  background: rgba(10, 18, 13, 0.65);
  border-color: rgba(74, 222, 128, 0.1);
}
.ac-theme--ob:hover { border-color: rgba(74, 222, 128, 0.28); box-shadow: 0 20px 44px -16px rgba(0, 0, 0, 0.65); }

/* ── Accent bars ───────────────────────────── */
.ac-accent {
  height: 3px;
  width: 100%;
  flex-shrink: 0;
}
.ac-accent--blue   { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.ac-accent--orange { background: linear-gradient(90deg, #f97316, #fb923c); }
.ac-accent--purple { background: linear-gradient(90deg, #a855f7, #c084fc); }
.ac-accent--green  { background: linear-gradient(90deg, #22c55e, #4ade80); }
.ac-accent--pink   { background: linear-gradient(90deg, #ec4899, #f472b6); }

/* ── Body ──────────────────────────────────── */
.ac-body {
  padding: 1.1rem 1.25rem 1.25rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* ── Head ──────────────────────────────────── */
.ac-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.ac-title {
  font-family: "Syne", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #e4e4e7;
  letter-spacing: -0.02em;
  margin-top: 0.2rem;
  line-height: 1.15;
}

/* ── Action button ─────────────────────────── */
.ac-btn {
  font-size: 0.75rem;
  border-radius: 6px;
  padding: 0.22rem 0.6rem;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
  cursor: none;
}

.ac-btn--default {
  color: #8ea8c3;
  border: 1px solid rgba(142, 168, 195, 0.28);
}
.ac-btn--default:hover {
  background: rgba(142, 168, 195, 0.1);
  border-color: rgba(142, 168, 195, 0.55);
  color: #c9d1d9;
}

.ac-btn--green {
  color: rgba(74, 222, 128, 0.75);
  border: 1px solid rgba(74, 222, 128, 0.22);
}
.ac-btn--green:hover {
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.5);
  color: rgba(134, 239, 172, 1);
}

/* ── Status pill ───────────────────────────── */
.ac-status-pill {
  font-size: 0.63rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #94a3b8;
  border: 1px solid rgba(113, 113, 122, 0.45);
  border-radius: 99px;
  padding: 0.14rem 0.5rem;
  flex-shrink: 0;
  white-space: nowrap;
}

/* ── Description ───────────────────────────── */
.ac-desc {
  font-size: 0.875rem;
  line-height: 1.65;
  color: #a1a1aa;
  flex: 1;
}

/* Tags */
.ac-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: auto;
}

.ac-tag {
  font-size: 0.68rem;
  color: #71717a;
  background: rgba(39, 39, 42, 0.7);
  border: 1px solid rgba(63, 63, 70, 0.7);
  border-radius: 4px;
  padding: 0.15rem 0.45rem;
}

.ac-tag--blue   { color: #67e8f9; background: rgba(0, 125, 162, 0.15); border-color: rgba(0, 175, 220, 0.3); }
.ac-tag--rust   { color: #fdba74; background: rgba(183, 65, 14, 0.15); border-color: rgba(249, 115, 22, 0.3); }
.ac-tag--green  { color: #86efac; background: rgba(34, 197, 94, 0.12); border-color: rgba(74, 222, 128, 0.28); }
.ac-tag--purple { color: #d8b4fe; background: rgba(168, 85, 247, 0.12); border-color: rgba(192, 132, 252, 0.28); }
.ac-tag--orange { color: #fdba74; background: rgba(249, 115, 22, 0.12); border-color: rgba(251, 146, 60, 0.28); }

/* ── Footer ────────────────────────────────── */
.ac-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 0.6rem;
  border-top: 1px solid rgba(113, 113, 122, 0.1);
}

.ac-theme--ob .ac-foot {
  border-top-color: rgba(74, 222, 128, 0.07);
}

.ac-foot-label {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #3f3f46;
}

.ac-live {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(74, 222, 128, 0.65);
}

.ac-live-dot {
  width: 6px;
  height: 6px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.82); }
}

/* root hover lift */
.ac-root:hover {
  transform: translateY(-2px);
  filter: drop-shadow(0 12px 30px rgba(14, 20, 29, 0.5));
}
</style>
