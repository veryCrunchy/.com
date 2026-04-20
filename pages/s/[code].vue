<script setup lang="ts">
  definePageMeta({
    layout: false,
  });

  const route = useRoute();

  await navigateTo(`/p/${encodeURIComponent(String(route.params.code || ""))}`, {
    redirectCode: 301,
    replace: true,
  });
</script>
