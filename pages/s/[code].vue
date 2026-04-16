<script setup lang="ts">
  const route = useRoute();

  await navigateTo(`/p/${encodeURIComponent(String(route.params.code || ""))}`, {
    redirectCode: 301,
    replace: true,
  });
</script>
