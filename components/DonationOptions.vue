<script setup lang="ts">
  const donations = [
    {
      name: "Ko-Fi",
      description:
        "Make quick, one-time contributions and leave a message of support. Perfect for small, meaningful gestures.",
      icon: "☕",
      url: "https://ko-fi.com/verycrunchy",
      color: "#29abe0 ",
    },
    {
      name: "GitHub Sponsors",
      description:
        "Support me monthly with GitHub's matched contributions. 100% of your money goes directly to me, and you can leave a message.",
      icon: "⭐",
      url: "https://github.com/sponsors/verycrunchy",
      color: "#ea4aaa",
    },
    {
      name: "Stripe",
      description:
        "Use professional-grade payment processing and leave a message with your contribution. Best for larger contributions.",
      icon: "💳",
      url: "https://buy.stripe.com/00gcO34iX4KpdfG001",
      color: "#635bff",
    },
  ];
</script>

<template>
  <div class="grid gap-6">
    <div class="flex items-center justify-between">
      <h3 class="text-xl font-semibold tracking-tight text-zinc-100">Support The Work</h3>
      <p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Contribute</p>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <a
        v-for="option in donations"
        :key="option.name"
        :href="option.url"
        target="_blank"
        rel="noopener"
        hs-dist="100"
        class="hover donation-card group"
      >
        <article class="flex h-full flex-col gap-4 p-5">
          <div class="flex items-center justify-between">
            <h4 class="text-base font-semibold text-zinc-100">
              {{ option.name }}
            </h4>
            <span class="text-2xl donation-icon">{{ option.icon }}</span>
          </div>
          <p class="text-sm leading-relaxed text-zinc-300">
            {{ option.description }}
          </p>
          <span class="mt-auto text-xs uppercase tracking-[0.18em] text-zinc-400">Open Link</span>
        </article>
      </a>
    </div>
  </div>
</template>

<style scoped>
  .donation-card {
    border: 1px solid rgba(113, 113, 122, 0.6);
    border-radius: 0.9rem;
    background: rgba(24, 24, 27, 0.7);
    transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
  }

  .donation-card:hover {
    transform: translateY(-2px);
    border-color: rgba(148, 163, 184, 0.65);
    box-shadow: 0 12px 24px -18px rgba(148, 163, 184, 0.75);
  }

  .donation-icon {
    color: #cbd5e1;
  }
</style>
