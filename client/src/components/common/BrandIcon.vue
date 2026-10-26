<script setup lang="ts">
import trophyIcon from "@/assets/trophy.svg";

defineProps<{
  class?: string;
}>();
</script>

<template>
  <img :src="trophyIcon" :class="$props.class" alt="" aria-hidden="true" />
</template>
