<script setup lang="ts">
import { computed, useSlots } from 'vue';

const slots = useSlots();
const hasSidebar = computed(() => Boolean(slots.sidebar));
</script>

<template>
  <div class="social-workspace" :class="{ 'has-sidebar': hasSidebar }">
    <aside v-if="hasSidebar" class="social-sidebar">
      <slot name="sidebar" />
    </aside>

    <section class="workspace-content">
      <slot />
    </section>
  </div>
</template>

<style scoped>
.social-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  width: min(100%, 1100px);
  margin: 0 auto;
  padding: 24px 16px;
}

.social-workspace.has-sidebar {
  grid-template-columns: 250px minmax(0, 1fr);
}

.social-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: sticky;
  top: calc(64px + env(safe-area-inset-top) + 16px);
  align-self: start;
}

.workspace-content {
  min-width: 0;
}

@media (max-width: 900px) {
  .social-workspace,
  .social-workspace.has-sidebar {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 12px 8px;
  }

  .social-sidebar {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 4px;
  }
}
</style>
