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
    class="ac-root"
    :class="[
      `ac-theme--${theme}`,
      wide && 'ac-wide',
    ]"
    hs-dist="90"
  >
    <!-- Left: meta — category, link/status, footer -->
    <div class="ac-meta">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <a
        v-if="link"
        :href="link.href"
        :target="link.target ?? '_self'"
        :rel="link.target === '_blank' ? 'noopener' : undefined"
        class="ac-btn"
        :class="link.variant === 'green' ? 'ac-btn--green' : 'ac-btn--default'"
      >{{ link.label }}</a>
      <span v-else-if="status" class="ac-status-pill">{{ status }}</span>
      <div v-if="footer" class="ac-foot-meta">
        <span class="ac-foot-label">{{ footer.label }}</span>
      </div>
    </div>

    <!-- Right: content — title, description, tags -->
    <div class="ac-content">
      <h3 class="ac-title">{{ title }}</h3>
      <div v-if="description" class="ac-desc" v-html="description"></div>
      <div v-else-if="$slots.default" class="ac-desc">
        <slot />
      </div>
      <div v-if="tags?.length" class="ac-tags">
        <span
          v-for="t in tags"
          :key="t.label"
          class="ac-tag"
          :class="t.variant ? `ac-tag--${t.variant}` : ''"
        >{{ t.label }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* ── Root ──────────────────────────────────── */
.ac-root {
  display: flex;
  gap: 2.5rem;
  padding: 1.75rem 0;
  border-top: 1px solid rgba(113, 113, 122, 0.18);
  align-items: start;
  transition: background 0.2s ease;
}

.ac-root:hover {
  background: rgba(142, 168, 195, 0.02);
}

@media (max-width: 600px) {
  .ac-root {
    flex-direction: column;
    gap: 0.5rem;
  }
}

/* Wide column span — layout handled by parent pa-grid */

/* ── Themes ────────────────────────────────── */
.ac-theme--dark   { background: none; }
.ac-theme--darker { background: none; }
.ac-theme--ob:hover { background: rgba(74, 222, 128, 0.015); }
.ac-theme--ob .ac-title { color: rgba(134, 239, 172, 0.85); }

/* ── Meta column (left) ────────────────────── */
.ac-meta {
  flex-shrink: 0;
  width: 11rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.15rem;
}

@media (max-width: 600px) {
  .ac-meta { width: 100%; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
}

/* Override global eyebrow letter-spacing in narrow column */
.ac-meta .eyebrow {
  letter-spacing: 0.1em;
  line-height: 1.4;
}

/* ── Content column (right) ────────────────── */
.ac-content {
  flex: 1;
  min-width: 0;
}

.ac-title {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: #e4e4e7;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin-bottom: 0.45rem;
}

/* ── Action link ───────────────────────────── */
.ac-btn {
  font-size: 0.7rem;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s ease;
  cursor: none;
  display: block;
}

.ac-btn--default { color: rgba(142, 168, 195, 0.5); }
.ac-btn--default:hover { color: #c9d1d9; }
.ac-btn--green { color: rgba(74, 222, 128, 0.5); }
.ac-btn--green:hover { color: rgba(134, 239, 172, 1); }

/* ── Status pill ───────────────────────────── */
.ac-status-pill {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #52525b;
}

/* ── Description ───────────────────────────── */
.ac-desc {
  font-size: 0.9rem;
  line-height: 1.8;
  color: #71717a;
}

.ac-desc p + p {
  margin-top: 0.65rem;
}

.ac-desc nav {
  margin-top: 0.25rem;
}

/* ── Tags ──────────────────────────────────── */
.ac-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.75rem;
}

.ac-tag {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: #52525b;
  border: 1px solid rgba(63, 63, 70, 0.5);
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
}

.ac-tag--blue   { color: rgba(96, 165, 250, 0.6);  border-color: rgba(59, 130, 246, 0.2); }
.ac-tag--rust   { color: rgba(253, 186, 116, 0.6); border-color: rgba(249, 115, 22, 0.2); }
.ac-tag--green  { color: rgba(134, 239, 172, 0.6); border-color: rgba(74, 222, 128, 0.2); }
.ac-tag--purple { color: rgba(216, 180, 254, 0.6); border-color: rgba(168, 85, 247, 0.2); }
.ac-tag--orange { color: rgba(253, 186, 116, 0.6); border-color: rgba(249, 115, 22, 0.2); }

/* ── Footer meta ───────────────────────────── */
.ac-foot-meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.ac-foot-label {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #3f3f46;
}

</style>
