<script setup lang="ts">
defineProps<{
    label: string;
    value: string;
    sub?: string;
}>();
</script>

<template>
    <div class="stat-card">
        <span class="stat-label">{{ label }}</span>
        <span class="stat-value">{{ value }}</span>
        <span v-if="sub" class="stat-sub">{{ sub }}</span>
        <div v-if="$slots.default" class="stat-footer"><slot /></div>
    </div>
</template>

<style scoped>
.stat-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-5);
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}

.stat-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}

/* The numbers carry the promise: Ink, full contrast, never muted. */
.stat-value {
    font-size: 1.75rem;
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    line-height: 1.15;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
}

.stat-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

.stat-footer {
    margin-top: var(--space-3);
}
</style>
