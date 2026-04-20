<script setup lang="ts">
  import kofiSponsors from "../data/kofiSponsors.json";
  const { data: githubSponsors } = await useFetch("/api/sponsors/github");

  const githubSponsorsList = computed(() =>
    (githubSponsors?.value?.sponsors || []).map((s: any) => ({
      name: s.login,
      meta: s.name || 'GitHub Sponsor',
      source: 'GitHub Sponsors',
    }))
  );

  const kofiSponsorsList = computed(() =>
    kofiSponsors.map((s) => ({
      name: s.name,
      meta: `$${s.total}`,
      source: 'Ko-fi',
    }))
  );

  const allSponsors = computed(() => [...githubSponsorsList.value, ...kofiSponsorsList.value]);
</script>

<template>
  <div class="sponsors-root">
    <div v-if="allSponsors.length" class="sponsors-list">
      <div
        v-for="sponsor in allSponsors"
        :key="sponsor.name + sponsor.source"
        class="sponsor-row"
      >
        <span class="sponsor-name">{{ sponsor.name }}</span>
        <span class="sponsor-meta">{{ sponsor.source }} · {{ sponsor.meta }}</span>
      </div>
    </div>

    <p v-else class="sponsors-empty">No sponsors yet.</p>
  </div>
</template>

<style scoped>
.sponsors-root {
  padding: 0;
  border-top: none;
}

.sponsors-list {
  display: flex;
  flex-direction: column;
}

.sponsor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-bottom: 1px solid rgba(113, 113, 122, 0.1);
}

.sponsor-row:last-child {
  border-bottom: none;
}

.sponsor-name {
  font-size: 0.875rem;
  color: #a1a1aa;
}

.sponsor-meta {
  font-size: 0.72rem;
  color: #3f3f46;
  letter-spacing: 0.02em;
}

.sponsors-empty {
  font-size: 0.875rem;
  color: #3f3f46;
  padding: 0.75rem 0;
}
</style>
