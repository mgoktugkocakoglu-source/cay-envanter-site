<script setup lang="ts">
import { computed } from 'vue';
import type { ComplianceStatus } from '@/services/caykurData';

const props = withDefaults(
    defineProps<{
        status: ComplianceStatus;
        label?: string;
    }>(),
    { label: '' },
);

const META: Record<ComplianceStatus, { text: string; tone: string }> = {
    compliant: { text: 'Uyumlu', tone: 'success' },
    partial: { text: 'Kısmi', tone: 'warning' },
    noncompliant: { text: 'Uyumsuz', tone: 'danger' },
};

const meta = computed(() => META[props.status]);
const text = computed(() => props.label || meta.value.text);
</script>

<template>
    <span class="c-badge" :data-tone="meta.tone">
        <span class="c-badge-dot" aria-hidden="true"></span>
        {{ text }}
    </span>
</template>

<style scoped>
.c-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    line-height: 1.4;
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    white-space: nowrap;
}

.c-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
}

.c-badge[data-tone='success'] {
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
}

.c-badge[data-tone='warning'] {
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-warning) 28%, transparent);
}

.c-badge[data-tone='danger'] {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-danger) 26%, transparent);
}
</style>
