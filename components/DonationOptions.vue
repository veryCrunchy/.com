<script setup lang="ts">
  const donations = [
    {
      eyebrow: "Ko-fi",
      title: "One-time or monthly",
      description: "Quick contributions with a message. Works best for small, meaningful gestures. No account required.",
      link: { href: "https://ko-fi.com/verycrunchy", label: "Open Ko-fi →", target: "_blank" },
    },
    {
      eyebrow: "GitHub Sponsors",
      title: "Monthly via GitHub",
      description: "100% goes directly to me. GitHub matches contributions. Leave a message.",
      link: { href: "https://github.com/sponsors/verycrunchy", label: "Open GitHub Sponsors →", target: "_blank" },
    },
    {
      eyebrow: "Stripe",
      title: "Larger contributions",
      description: "Professional payment processing. Best if you want to give more and leave a note.",
      link: { href: "https://buy.stripe.com/00gcO34iX4KpdfG001", label: "Open Stripe →", target: "_blank" },
    },
  ];
</script>

<template>
  <div class="donation-root">
    <ArticleCard
      v-for="opt in donations"
      :key="opt.eyebrow"
      :eyebrow="opt.eyebrow"
      :title="opt.title"
      :description="opt.description"
      :link="opt.link"
      theme="dark"
    />
  </div>
</template>

<style scoped>
.donation-root {
  padding-top: 0;
}
</style>
