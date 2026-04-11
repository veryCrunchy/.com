<script setup lang="ts">
  import kofiSponsors from "../data/kofiSponsors.json";
  const { data: githubSponsors } = await useFetch("/api/sponsors/github");

  const githubSponsorsList = computed(() => {
    return (
      githubSponsors?.value?.sponsors?.map((sponsor) => ({
        ...sponsor,
        source: "GitHub",
      })) || []
    );
  });

  const kofiSponsorsList = computed(() => {
    return kofiSponsors.map((sponsor) => ({
      ...sponsor,
      source: "Ko-fi",
    }));
  });
</script>

<template>
  <div class="grid gap-6">
    <div class="flex items-center justify-between">
      <h3 class="text-xl font-semibold tracking-tight text-zinc-100">Current Sponsors</h3>
      <p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Thank you</p>
    </div>

    <section v-if="githubSponsorsList.length" class="space-y-3">
      <p class="platform-title">GitHub Sponsors</p>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="sponsor in githubSponsorsList"
          :key="sponsor.login"
          class="hover sponsor-card flex items-center gap-3"
        >
          <img
            :src="sponsor.avatarUrl"
            :alt="sponsor.login"
            class="h-10 w-10 rounded-full border border-zinc-600 object-cover"
          />
          <div class="min-w-0">
            <h4 class="truncate text-sm font-semibold text-zinc-100">@{{ sponsor.login }}</h4>
            <p class="truncate text-xs text-zinc-400">{{ sponsor.name || "GitHub Sponsor" }}</p>
          </div>
        </article>
      </div>
    </section>

    <section v-if="kofiSponsorsList.length" class="space-y-3">
      <p class="platform-title">Ko-fi Supporters</p>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="sponsor in kofiSponsorsList"
          :key="sponsor.name"
          class="hover sponsor-card"
        >
          <h4 class="text-sm font-semibold text-zinc-100">{{ sponsor.name }}</h4>
          <p class="mt-1 text-xs text-zinc-400">Total: ${{ sponsor.total }}</p>
        </article>
      </div>
    </section>

    <div
      v-if="!githubSponsorsList.length && !kofiSponsorsList.length"
      class="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-4 text-sm text-zinc-400"
    >
      Sponsors will appear here once available.
    </div>
  </div>
</template>

<style scoped>
  .platform-title {
    font-size: 0.73rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .sponsor-card {
    border: 1px solid rgba(113, 113, 122, 0.6);
    border-radius: 0.75rem;
    background: rgba(24, 24, 27, 0.7);
    padding: 0.75rem;
    transition: all 0.3s ease;
  }

  .sponsor-card:hover {
    border-color: rgba(148, 163, 184, 0.65);
    box-shadow: 0 12px 24px -18px rgba(148, 163, 184, 0.75);
  }
</style>
