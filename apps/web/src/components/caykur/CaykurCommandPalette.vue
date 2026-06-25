<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';
import { NAV_GROUPS } from '@/services/caykur/nav';
import type { ModuleKey } from '@/services/caykur/roles';
import { useFocusTrap } from '@/composables/useFocusTrap';

/**
 * Panel-wide command palette (⌘K): jump to a module, find a producer by name /
 * ruhsat / cüzdan number, or run a frequent action. Pure client-side over the
 * seeded dataset; swap the producer source together with the caykur store seam.
 */

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const caykur = useCaykurStore();

interface PaletteItem {
    id: string;
    label: string;
    meta?: string;
    iconSvg: string;
    to: string;
}

interface PaletteGroup {
    title: string;
    items: PaletteItem[];
}

const ICONS = {
    producer:
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    back: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
};

const query = ref('');
const activeIndex = ref(0);
const panelRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);

useFocusTrap(open, panelRef);

function norm(value: string): string {
    return value.toLocaleLowerCase('tr');
}

const navItems = computed<PaletteItem[]>(() =>
    NAV_GROUPS.flatMap((g) => g.items)
        .filter((it) => caykur.can(it.module))
        .map((it) => ({
            id: `page:${it.to}`,
            label: it.label,
            meta: 'Sayfa',
            iconSvg: it.iconSvg,
            to: it.to,
        })),
);

interface ActionDef {
    label: string;
    to: string;
    module: ModuleKey | null;
    iconSvg: string;
}

const ACTION_DEFS: ActionDef[] = [
    { label: 'Yaş çay alımı kaydet', to: '/caykur/deliveries/new', module: 'deliveries', iconSvg: ICONS.plus },
    { label: 'Yeni görev oluştur', to: '/caykur/tasks', module: 'tasks', iconSvg: ICONS.plus },
    { label: 'Duyuru yayınla', to: '/caykur/announcements', module: 'announcements', iconSvg: ICONS.plus },
    { label: 'Üretici uygulamasına dön', to: '/tea/dashboard', module: null, iconSvg: ICONS.back },
];

const actionItems = computed<PaletteItem[]>(() =>
    ACTION_DEFS.filter((a) => a.module === null || caykur.can(a.module)).map((a) => ({
        id: `action:${a.to}:${a.label}`,
        label: a.label,
        meta: 'İşlem',
        iconSvg: a.iconSvg,
        to: a.to,
    })),
);

const producerItems = computed<PaletteItem[]>(() => {
    const q = norm(query.value.trim());
    if (q.length < 2) return [];
    return caykur.producers
        .filter(
            (p) =>
                norm(p.fullName).includes(q) ||
                p.ruhsatNo.includes(q) ||
                p.cuzdanNo.includes(q),
        )
        .slice(0, 8)
        .map((p) => ({
            id: `producer:${p.id}`,
            label: p.fullName,
            meta: `${p.region} · ${p.ruhsatNo}`,
            iconSvg: ICONS.producer,
            to: `/caykur/producers/${p.id}`,
        }));
});

const groups = computed<PaletteGroup[]>(() => {
    const q = norm(query.value.trim());
    const byQuery = (items: PaletteItem[]) =>
        q ? items.filter((it) => norm(it.label).includes(q)) : items;

    return [
        { title: 'Sayfalar', items: byQuery(navItems.value) },
        { title: 'Müstahsiller', items: producerItems.value },
        { title: 'İşlemler', items: byQuery(actionItems.value) },
    ].filter((g) => g.items.length > 0);
});

const flatItems = computed<PaletteItem[]>(() => groups.value.flatMap((g) => g.items));

watch(query, () => {
    activeIndex.value = 0;
});

watch(open, async (isOpen) => {
    if (isOpen) {
        query.value = '';
        activeIndex.value = 0;
        document.body.style.overflow = 'hidden';
        await nextTick();
        inputRef.value?.focus();
    } else {
        document.body.style.overflow = '';
    }
});

function close(): void {
    open.value = false;
}

function go(item: PaletteItem): void {
    close();
    router.push(item.to);
}

function move(step: number): void {
    const count = flatItems.value.length;
    if (count === 0) return;
    activeIndex.value = (activeIndex.value + step + count) % count;
    nextTick(() => {
        listRef.value
            ?.querySelector(`#ck-palette-opt-${activeIndex.value}`)
            ?.scrollIntoView({ block: 'nearest' });
    });
}

function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
    } else if (e.key === 'Enter') {
        const item = flatItems.value[activeIndex.value];
        if (item) {
            e.preventDefault();
            go(item);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
    }
}

/** Index of an item within the flattened list (drives aria-activedescendant). */
function flatIndexOf(item: PaletteItem): number {
    return flatItems.value.findIndex((it) => it.id === item.id);
}
</script>

<template>
    <Teleport to="body">
        <div v-if="open" class="palette-root" @keydown="onKeydown">
            <div class="palette-backdrop" aria-hidden="true" @click="close"></div>
            <div
                ref="panelRef"
                class="palette-panel ck-pop-in"
                role="dialog"
                aria-modal="true"
                aria-label="Komut paleti"
            >
                <div class="palette-input-row">
                    <svg class="palette-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        ref="inputRef"
                        v-model="query"
                        type="text"
                        class="palette-input"
                        placeholder="Sayfa, müstahsil veya işlem ara…"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="ck-palette-list"
                        :aria-activedescendant="flatItems.length ? `ck-palette-opt-${activeIndex}` : undefined"
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <button type="button" class="ck-kbd palette-esc" @click="close">esc</button>
                </div>

                <div id="ck-palette-list" ref="listRef" class="palette-list" role="listbox" aria-label="Sonuçlar">
                    <template v-for="group in groups" :key="group.title">
                        <p class="palette-group-title" role="presentation">{{ group.title }}</p>
                        <button
                            v-for="item in group.items"
                            :id="`ck-palette-opt-${flatIndexOf(item)}`"
                            :key="item.id"
                            type="button"
                            class="palette-item"
                            role="option"
                            :aria-selected="flatIndexOf(item) === activeIndex"
                            :class="{ 'is-active': flatIndexOf(item) === activeIndex }"
                            tabindex="-1"
                            @mousemove="activeIndex = flatIndexOf(item)"
                            @click="go(item)"
                        >
                            <svg class="palette-item-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="item.iconSvg" />
                            <span class="palette-item-label">{{ item.label }}</span>
                            <span v-if="item.meta" class="palette-item-meta">{{ item.meta }}</span>
                        </button>
                    </template>

                    <div v-if="flatItems.length === 0" class="palette-empty">
                        <p class="palette-empty-title">Sonuç bulunamadı</p>
                        <p class="palette-empty-sub">
                            "{{ query }}" için sayfa, müstahsil veya işlem eşleşmedi.
                        </p>
                    </div>
                </div>

                <div class="palette-foot" aria-hidden="true">
                    <span class="palette-hint"><span class="ck-kbd">↑</span><span class="ck-kbd">↓</span> gezin</span>
                    <span class="palette-hint"><span class="ck-kbd">↵</span> aç</span>
                    <span class="palette-hint"><span class="ck-kbd">esc</span> kapat</span>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.palette-root {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 14vh var(--space-4) var(--space-4);
}

.palette-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
}

.palette-panel {
    position: relative;
    width: min(580px, 100%);
    display: flex;
    flex-direction: column;
    max-height: min(460px, 70vh);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
}

.palette-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
}

.palette-search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
}

.palette-input {
    flex: 1;
    height: 52px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--color-text-primary);
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    min-width: 0;
}

.palette-input::placeholder {
    color: var(--color-text-muted);
}

.palette-esc {
    cursor: pointer;
    flex-shrink: 0;
}

.palette-list {
    overflow-y: auto;
    padding: var(--space-2);
    overscroll-behavior: contain;
}

.palette-group-title {
    margin: var(--space-2) var(--space-3) 4px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
}

.palette-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 42px;
    padding: 0 var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
}

.palette-item.is-active {
    background: var(--color-bg-tertiary);
}

.palette-item-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
}

.palette-item.is-active .palette-item-icon {
    color: var(--color-text-secondary);
}

.palette-item-label {
    flex: 1;
    font-weight: var(--font-weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.palette-item-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}

.palette-empty {
    padding: var(--space-8) var(--space-5);
    text-align: center;
}

.palette-empty-title {
    margin: 0 0 4px;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.palette-empty-sub {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
}

.palette-foot {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-primary);
    flex-shrink: 0;
}

.palette-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}
</style>
