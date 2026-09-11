<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Search, SearchX } from '@lucide/vue';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared';
import { useCaykurStore } from '@/stores/caykurStore';
import { NAV_GROUPS } from '@/services/caykur/nav';
import type { ModuleKey } from '@/services/caykur/roles';

/**
 * Panel-wide command palette (⌘K): jump to a module or run a frequent action.
 */

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const caykur = useCaykurStore();

interface PaletteItem {
    id: string;
    label: string;
    meta?: string;
    icon: Component;
    to: string;
}

interface PaletteGroup {
    title: string;
    items: PaletteItem[];
}

const query = ref('');
const activeIndex = ref(0);
const inputRef = ref<InstanceType<typeof Input> | null>(null);
const listRef = ref<HTMLElement | null>(null);

function norm(value: string): string {
    return value.toLocaleLowerCase('tr');
}

const navItems = computed<PaletteItem[]>(() =>
    NAV_GROUPS.flatMap((group) => group.items)
        .filter((item) => caykur.can(item.module))
        .map((item) => ({
            id: `page:${item.to}`,
            label: item.label,
            meta: 'Sayfa',
            icon: item.icon,
            to: item.to,
        })),
);

interface ActionDef {
    label: string;
    to: string;
    module: ModuleKey | null;
    icon: Component;
}

const ACTION_DEFS: ActionDef[] = [
    { label: 'Üretici uygulamasına dön', to: '/tea/dashboard', module: null, icon: ArrowLeft },
];

const actionItems = computed<PaletteItem[]>(() =>
    ACTION_DEFS.filter((action) => action.module === null || caykur.can(action.module)).map((action) => ({
        id: `action:${action.to}:${action.label}`,
        label: action.label,
        meta: 'İşlem',
        icon: action.icon,
        to: action.to,
    })),
);

const groups = computed<PaletteGroup[]>(() => {
    const q = norm(query.value.trim());
    const byQuery = (items: PaletteItem[]) =>
        q ? items.filter((item) => norm(item.label).includes(q)) : items;

    return [
        { title: 'Sayfalar', items: byQuery(navItems.value) },
        { title: 'İşlemler', items: byQuery(actionItems.value) },
    ].filter((group) => group.items.length > 0);
});

const flatItems = computed<PaletteItem[]>(() => groups.value.flatMap((group) => group.items));

watch(query, () => {
    activeIndex.value = 0;
});

watch(open, async (isOpen) => {
    if (!isOpen) return;
    query.value = '';
    activeIndex.value = 0;
    await nextTick();
    focusInput();
});

function focusInput(): void {
    const el = inputRef.value?.$el as HTMLInputElement | undefined;
    el?.focus();
}

function onQueryInput(value: string | number): void {
    query.value = String(value);
}

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
            ?.querySelector(`#caykur-palette-opt-${activeIndex.value}`)
            ?.scrollIntoView({ block: 'nearest' });
    });
}

/** Arrow / Enter handling; Escape is owned by the Dialog itself. */
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
    }
}

/** Index of an item within the flattened list (drives aria-activedescendant). */
function flatIndexOf(item: PaletteItem): number {
    return flatItems.value.findIndex((it) => it.id === item.id);
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent
            class="top-[14vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
            :show-close-button="false"
            aria-label="Komut paleti"
            @keydown="onKeydown"
            @open-auto-focus.prevent="focusInput"
        >
            <DialogTitle class="sr-only">Komut paleti</DialogTitle>
            <DialogDescription class="sr-only">Sayfa veya işlem arayın, ok tuşlarıyla gezinin.</DialogDescription>

            <div class="flex items-center gap-2 border-b px-3">
                <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Input
                    ref="inputRef"
                    :model-value="query"
                    type="text"
                    placeholder="Sayfa veya işlem ara…"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="caykur-palette-list"
                    :aria-activedescendant="flatItems.length ? `caykur-palette-opt-${activeIndex}` : undefined"
                    autocomplete="off"
                    spellcheck="false"
                    class="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
                    @update:model-value="onQueryInput"
                />
                <Button
                    variant="ghost"
                    size="xs"
                    class="h-6 shrink-0 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                    aria-label="Kapat"
                    @click="close"
                >
                    esc
                </Button>
            </div>

            <div
                id="caykur-palette-list"
                ref="listRef"
                class="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain p-2"
                role="listbox"
                aria-label="Sonuçlar"
            >
                <template v-for="group in groups" :key="group.title">
                    <div class="px-2 pb-1 pt-2" role="presentation">
                        <Badge variant="muted">{{ group.title }}</Badge>
                    </div>
                    <Button
                        v-for="item in group.items"
                        :id="`caykur-palette-opt-${flatIndexOf(item)}`"
                        :key="item.id"
                        variant="ghost"
                        role="option"
                        :aria-selected="flatIndexOf(item) === activeIndex"
                        :data-active="flatIndexOf(item) === activeIndex"
                        tabindex="-1"
                        class="h-11 w-full justify-start gap-3 px-3 font-medium data-[active=true]:bg-accent data-[active=true]:text-accent-foreground md:h-10"
                        @mousemove="activeIndex = flatIndexOf(item)"
                        @click="go(item)"
                    >
                        <component :is="item.icon" class="text-muted-foreground" aria-hidden="true" />
                        <span class="flex-1 truncate text-left">{{ item.label }}</span>
                        <span v-if="item.meta" class="shrink-0 text-xs font-normal text-muted-foreground">
                            {{ item.meta }}
                        </span>
                    </Button>
                </template>

                <EmptyState
                    v-if="flatItems.length === 0"
                    title="Sonuç bulunamadı"
                    :description="`&quot;${query}&quot; için sayfa veya işlem eşleşmedi.`"
                    :icon="SearchX"
                    class="min-h-0 border-0 bg-transparent py-8"
                />
            </div>

            <div class="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground" aria-hidden="true">
                <span class="inline-flex items-center gap-1">
                    <kbd class="rounded border bg-muted px-1 font-mono text-[10px]">↑</kbd>
                    <kbd class="rounded border bg-muted px-1 font-mono text-[10px]">↓</kbd>
                    gezin
                </span>
                <span class="inline-flex items-center gap-1">
                    <kbd class="rounded border bg-muted px-1 font-mono text-[10px]">↵</kbd>
                    aç
                </span>
                <span class="inline-flex items-center gap-1">
                    <kbd class="rounded border bg-muted px-1 font-mono text-[10px]">esc</kbd>
                    kapat
                </span>
            </div>
        </DialogContent>
    </Dialog>
</template>
