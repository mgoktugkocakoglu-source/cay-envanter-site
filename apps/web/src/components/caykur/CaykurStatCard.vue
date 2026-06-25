<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    label: string;
    value: string;
    /** Unit rendered after the value at a smaller size ("ton", "da", "kg"). */
    unit?: string;
    sub?: string;
    /** Pre-formatted change vs. the previous season, e.g. "+%4,2". */
    delta?: string;
    /** Whether the change is good news — direction alone doesn't decide it. */
    deltaTone?: 'success' | 'danger' | 'warning' | 'muted';
}>();

const deltaDir = computed<'up' | 'down' | 'flat'>(() => {
    if (!props.delta) return 'flat';
    if (props.delta.startsWith('+')) return 'up';
    if (props.delta.startsWith('-')) return 'down';
    return 'flat';
});
</script>

<template>
    <div class="ck-kpi">
        <span class="ck-kpi-label">{{ label }}</span>
        <div class="ck-kpi-value-row">
            <span class="ck-kpi-value">
                {{ value }}<span v-if="unit" class="ck-kpi-unit">&nbsp;{{ unit }}</span>
            </span>
            <span v-if="delta" class="ck-delta" :data-tone="deltaTone ?? 'muted'">
                <svg
                    v-if="deltaDir !== 'flat'"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :style="deltaDir === 'down' ? 'transform: rotate(180deg)' : undefined"
                    aria-hidden="true"
                >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                </svg>
                {{ delta }}
            </span>
        </div>
        <span v-if="sub" class="ck-kpi-sub">{{ sub }}</span>
        <div v-if="$slots.default" class="ck-kpi-foot"><slot /></div>
    </div>
</template>
