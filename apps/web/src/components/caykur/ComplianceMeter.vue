<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        /** Current value, in the same units as `max`. */
        value: number;
        /** Scale maximum (default 100 for percentages). */
        max?: number;
        tone?: 'success' | 'warning' | 'danger' | 'info';
        /** Optional target tick (e.g. the 1/7 budama target), in value units. */
        marker?: number;
        height?: number;
    }>(),
    { max: 100, tone: 'success', marker: undefined, height: 8 },
);

const fillPct = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)));
const over = computed(() => props.value > props.max);
const markerPct = computed(() =>
    props.marker === undefined ? null : Math.max(0, Math.min(100, (props.marker / props.max) * 100)),
);
</script>

<template>
    <div class="meter" :style="{ height: `${height}px` }" :data-tone="over ? 'danger' : tone">
        <div class="meter-fill" :style="{ width: `${fillPct}%` }"></div>
        <div v-if="markerPct !== null" class="meter-marker" :style="{ left: `${markerPct}%` }" aria-hidden="true"></div>
    </div>
</template>

<style scoped>
.meter {
    position: relative;
    width: 100%;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
}

.meter-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width var(--transition-normal);
}

.meter[data-tone='success'] .meter-fill {
    background: var(--color-success);
}
.meter[data-tone='warning'] .meter-fill {
    background: var(--color-warning);
}
.meter[data-tone='danger'] .meter-fill {
    background: var(--color-danger);
}
.meter[data-tone='info'] .meter-fill {
    background: var(--color-secondary);
}

.meter-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-text-primary);
    opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
    .meter-fill {
        transition: none;
    }
}
</style>
