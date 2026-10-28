<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <!-- Keyed so switching CV mounts a fresh page instead of reusing the previous one's state -->
  <RouterView :key="$route.fullPath" />
</template>

<style>
body {
  margin: 0;
  background: #fff;
}
</style>
