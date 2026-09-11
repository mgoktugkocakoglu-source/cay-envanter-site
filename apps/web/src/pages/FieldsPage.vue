<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { LayoutGrid, List, Map, MapPin, Pencil, RefreshCw, Trash2, Users } from '@lucide/vue';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useToast } from '@/composables/useToast';
import type { Field } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { ConfirmDialog, EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const router = useRouter();
const fieldsStore = useFieldsStore();
const toast = useToast();

const ALL_PROVINCES = 'all';
const searchQuery = ref('');
const provinceFilter = ref(ALL_PROVINCES);
const viewMode = ref<'grid' | 'list'>('grid');

// Delete dialog state
const showDeleteDialog = ref(false);
const fieldToDelete = ref<Field | null>(null);
const isDeleting = ref(false);

// Rename ("Arazimi isimlendir") dialog state
const showRenameDialog = ref(false);
const fieldToRename = ref<Field | null>(null);
const renameValue = ref('');
const isRenaming = ref(false);

const provinces = ['Rize', 'Trabzon', 'Artvin', 'Giresun', 'Ordu'];

const filteredFields = computed(() => {
    let result = fieldsStore.fields;
    if (provinceFilter.value !== ALL_PROVINCES) {
        result = result.filter((f) => f.province === provinceFilter.value);
    }
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter((f) => displayName(f).toLowerCase().includes(query) || parcelAdaLabel(f).toLowerCase().includes(query));
    }
    return result;
});

const totalArea = computed(() =>
    fieldsStore.fields.reduce((sum, f) => (f.areaUnit === 'm2' ? sum + f.area : sum + f.area * 1000), 0),
);

onMounted(() => {
    fieldsStore.fetchFields();
});

function navigateToField(id: string) {
    router.push(`/tea/fields/${id}`);
}

function openRenameDialog(field: Field) {
    fieldToRename.value = field;
    renameValue.value = field.name || '';
    showRenameDialog.value = true;
}

async function confirmRename() {
    if (!fieldToRename.value) return;
    const name = renameValue.value.trim();
    if (!name) {
        toast.error('Lütfen bir arazi adı giriniz');
        return;
    }
    isRenaming.value = true;
    try {
        const updated = await fieldsStore.updateField(fieldToRename.value.id, { name });
        if (updated) {
            toast.success('Arazi adı kaydedildi');
            showRenameDialog.value = false;
        } else {
            toast.error('Arazi adı kaydedilirken bir hata oluştu');
        }
    } finally {
        isRenaming.value = false;
    }
}

function openDeleteDialog(field: Field) {
    fieldToDelete.value = field;
    showDeleteDialog.value = true;
}

async function confirmDelete() {
    if (!fieldToDelete.value) return;
    isDeleting.value = true;
    try {
        const success = await fieldsStore.deleteField(fieldToDelete.value.id);
        if (success) {
            toast.success('Arazi başarıyla silindi');
            showDeleteDialog.value = false;
        } else {
            toast.error('Arazi silinirken bir hata oluştu');
        }
    } finally {
        isDeleting.value = false;
    }
}

function formatArea(area: number, unit: string) {
    const formatted = area.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const unitLabels: Record<string, string> = { donum: 'dönüm', dekar: 'dekar', m2: 'm²' };
    return `${formatted} ${unitLabels[unit] || unit}`;
}

function formatTotalArea(area: number) {
    if (area >= 10000) {
        return `${(area / 10000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ha`;
    }
    return `${area.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m²`;
}

function displayName(field: Field) {
    return field.name?.trim() || 'İsimsiz Arazi';
}

function getFieldInitial(field: Field) {
    const n = field.name?.trim();
    if (n) return n.charAt(0).toUpperCase();
    return field.parcelNo ? field.parcelNo.charAt(0) : '?';
}

/** "Ada 142 / Parsel 11" — cadastral identifiers from the Çaykur/TKGM record. */
function parcelAdaLabel(field: Field) {
    const parts: string[] = [];
    if (field.adaNo) parts.push(`Ada ${field.adaNo}`);
    if (field.parcelNo) parts.push(`Parsel ${field.parcelNo}`);
    return parts.join(' / ');
}

function isUnnamed(field: Field) {
    return !field.name?.trim();
}
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <PageHeader title="Arazilerim" description="Çaykur cüzdan numaranıza kayıtlı araziler otomatik olarak listelenir.">
                <template #meta>
                    <Badge variant="secondary">{{ fieldsStore.fieldCount }} arazi</Badge>
                    <Badge v-if="totalArea > 0" variant="secondary">{{ formatTotalArea(totalArea) }} toplam</Badge>
                </template>
                <template #actions>
                    <Badge variant="outline" class="h-9 gap-1.5 px-3 text-xs font-medium text-muted-foreground">
                        <RefreshCw aria-hidden="true" />
                        Çaykur cüzdanından yüklendi
                    </Badge>
                </template>
            </PageHeader>

            <ListToolbar>
                <SearchInput v-model="searchQuery" placeholder="Arazi, ada veya parsel ara" />
                <template #filters>
                    <Select v-model="provinceFilter">
                        <SelectTrigger class="w-40" aria-label="İl filtresi">
                            <SelectValue placeholder="İl seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="ALL_PROVINCES">Tüm iller</SelectItem>
                            <SelectItem v-for="province in provinces" :key="province" :value="province">{{ province }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <ToggleGroup v-model="viewMode" type="single" aria-label="Görünüm" class="hidden md:inline-flex">
                        <ToggleGroupItem value="grid" aria-label="Kart görünümü">
                            <LayoutGrid aria-hidden="true" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" aria-label="Liste görünümü">
                            <List aria-hidden="true" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </template>
            </ListToolbar>

            <LoadingState v-if="fieldsStore.isLoading" text="Araziler yükleniyor..." />

            <Alert v-else-if="fieldsStore.error" variant="destructive">
                <AlertDescription>{{ fieldsStore.error }}</AlertDescription>
            </Alert>

            <EmptyState
                v-else-if="filteredFields.length === 0"
                :icon="MapPin"
                :title="searchQuery || provinceFilter !== ALL_PROVINCES ? 'Filtreye uyan arazi yok' : 'Henüz arazi bulunamadı'"
                :description="
                    searchQuery || provinceFilter !== ALL_PROVINCES
                        ? 'Arama veya il filtresini değiştirerek tekrar deneyin.'
                        : 'Çaykur cüzdan numaranıza kayıtlı araziler burada otomatik olarak listelenir.'
                "
            >
                <Button v-if="searchQuery || provinceFilter !== ALL_PROVINCES" variant="outline" class="h-11 md:h-9" @click="searchQuery = ''; provinceFilter = ALL_PROVINCES">
                    Filtreleri temizle
                </Button>
            </EmptyState>

            <!-- Card view (always on mobile) -->
            <div v-else-if="viewMode === 'grid'" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card
                    v-for="field in filteredFields"
                    :key="field.id"
                    class="cursor-pointer gap-4 py-4 transition-colors hover:border-input focus-visible:ring-3 focus-visible:ring-ring/50"
                    role="link"
                    tabindex="0"
                    @click="navigateToField(field.id)"
                    @keydown.enter="navigateToField(field.id)"
                >
                    <CardContent class="flex flex-col gap-4 px-4">
                        <div class="flex items-start gap-3">
                            <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-base font-bold text-primary" aria-hidden="true">
                                {{ getFieldInitial(field) }}
                            </span>
                            <div class="min-w-0 flex-1">
                                <h3 class="truncate text-base font-semibold" :class="isUnnamed(field) ? 'text-muted-foreground italic' : 'text-foreground'">
                                    {{ displayName(field) }}
                                </h3>
                                <p class="flex items-center gap-1 truncate text-sm text-muted-foreground">
                                    <MapPin class="size-3.5 shrink-0" aria-hidden="true" />
                                    {{ field.province }} / {{ field.district }}
                                </p>
                            </div>
                            <span class="shrink-0 text-sm font-semibold text-foreground tabular-nums">{{ formatArea(field.area, field.areaUnit) }}</span>
                        </div>

                        <dl class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <div v-if="parcelAdaLabel(field)" class="flex items-center gap-1">
                                <Map class="size-3.5" aria-hidden="true" />
                                <dd>{{ parcelAdaLabel(field) }}</dd>
                            </div>
                            <div v-if="field.neighborhood" class="flex items-center gap-1">
                                <dd>{{ field.neighborhood }}</dd>
                            </div>
                            <div v-if="field.partnerCount > 1" class="flex items-center gap-1">
                                <Users class="size-3.5" aria-hidden="true" />
                                <dd>{{ field.partnerCount }} ortak</dd>
                            </div>
                        </dl>

                        <div class="flex items-center gap-2 border-t pt-3">
                            <Button variant="outline" class="h-11 flex-1 md:h-9" @click.stop="openRenameDialog(field)">
                                <Pencil aria-hidden="true" />
                                {{ isUnnamed(field) ? 'Arazimi isimlendir' : 'Adı düzenle' }}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="size-11 text-muted-foreground hover:text-destructive md:size-9"
                                :aria-label="`${displayName(field)} arazisini sil`"
                                @click.stop="openDeleteDialog(field)"
                            >
                                <Trash2 aria-hidden="true" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <!-- Table view (desktop) -->
            <div v-else class="overflow-hidden rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow class="hover:bg-transparent">
                            <TableHead class="pl-4">Arazi</TableHead>
                            <TableHead>Konum</TableHead>
                            <TableHead>Ada / Parsel</TableHead>
                            <TableHead class="text-right">Alan</TableHead>
                            <TableHead class="pr-4 text-right"><span class="sr-only">İşlemler</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow
                            v-for="field in filteredFields"
                            :key="field.id"
                            class="cursor-pointer"
                            tabindex="0"
                            @click="navigateToField(field.id)"
                            @keydown.enter="navigateToField(field.id)"
                        >
                            <TableCell class="pl-4">
                                <div class="flex items-center gap-3">
                                    <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary" aria-hidden="true">
                                        {{ getFieldInitial(field) }}
                                    </span>
                                    <span class="font-medium" :class="isUnnamed(field) ? 'text-muted-foreground italic' : 'text-foreground'">
                                        {{ displayName(field) }}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span class="block text-foreground">{{ field.province }} / {{ field.district }}</span>
                                <span class="block text-xs text-muted-foreground">{{ field.neighborhood }}</span>
                            </TableCell>
                            <TableCell class="text-muted-foreground">{{ parcelAdaLabel(field) || '—' }}</TableCell>
                            <TableCell class="text-right font-semibold text-foreground tabular-nums">{{ formatArea(field.area, field.areaUnit) }}</TableCell>
                            <TableCell class="pr-4 text-right">
                                <div class="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" class="size-9" :aria-label="`${displayName(field)} adını düzenle`" @click.stop="openRenameDialog(field)">
                                        <Pencil aria-hidden="true" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="size-9 text-muted-foreground hover:text-destructive" :aria-label="`${displayName(field)} arazisini sil`" @click.stop="openDeleteDialog(field)">
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <p v-if="!fieldsStore.isLoading && searchQuery && filteredFields.length > 0" class="text-sm text-muted-foreground">
                "{{ searchQuery }}" için {{ filteredFields.length }} sonuç bulundu
            </p>
        </PageContainer>

        <ConfirmDialog
            v-model:open="showDeleteDialog"
            title="Araziyi sil"
            :description="`${fieldToDelete ? displayName(fieldToDelete) : ''} arazinizi silmek istediğinize emin misiniz? Bu işlem geri alınamaz; araziye ait hasat kayıtları etkilenebilir.`"
            confirm-text="Evet, sil"
            :loading="isDeleting"
            @confirm="confirmDelete"
        >
            <template v-if="fieldsStore.error" #body>
                <Alert variant="destructive">
                    <AlertDescription>{{ fieldsStore.error }}</AlertDescription>
                </Alert>
            </template>
        </ConfirmDialog>

        <Dialog v-model:open="showRenameDialog">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Arazimi isimlendir</DialogTitle>
                    <DialogDescription>
                        <strong class="text-foreground">{{ fieldToRename ? parcelAdaLabel(fieldToRename) || fieldToRename.district : '' }}</strong>
                        arazinize tanıyabileceğiniz bir isim verin.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <Label for="field-rename-input">Arazi adı</Label>
                    <Input
                        id="field-rename-input"
                        v-model="renameValue"
                        maxlength="50"
                        placeholder="Örn: Evin Yanı, Üst Tarla"
                        class="h-11 md:h-9"
                        autofocus
                        @keydown.enter="confirmRename"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" :disabled="isRenaming" @click="showRenameDialog = false">İptal</Button>
                    <Button class="h-11 md:h-9" :disabled="isRenaming" @click="confirmRename">
                        <Spinner v-if="isRenaming" />
                        {{ isRenaming ? 'Kaydediliyor...' : 'Kaydet' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </TeaBusinessLayout>
</template>
