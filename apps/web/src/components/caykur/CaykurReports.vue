<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Download, FileSpreadsheet, FileText, FolderArchive, Landmark, Plus, Trash2 } from '@lucide/vue';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toneVariant } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/authStore';
import { api, saveBlob, type FusionDecision, type FusionSummary, type MinistryMatchBy, type MinistryRequestDetail, type MinistryRequestRow } from '@/services/api';
import { FUSION_DECISION_META, FUSION_DECISION_ORDER, formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Official outputs of a season: the report (Excel with every list, PDF summary for signature)
 * and the "request → answer" flow for the Ministry: paste the list, the system matches each
 * line to the register, snapshots the purchase decision and hands back the answer sheet plus
 * one evidence PDF per producer in a ZIP.
 */
const props = defineProps<{ areaId: string }>();

const MATCH_LABEL: Record<MinistryMatchBy, string> = { wallet_no: 'Cüzdan no', license_no: 'Ruhsat no', producer_code: 'Müstahsil no', name: 'Ad soyad', none: 'Eşleşmedi' };
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const toast = useToast();
const auth = useAuthStore();
const summary = ref<FusionSummary | null>(null);
const season = ref('');
const isLoading = ref(true);
const error = ref<string | null>(null);
const busy = ref<string | null>(null);

const requests = ref<MinistryRequestRow[]>([]);
const isLoadingRequests = ref(false);
const createOpen = ref(false);
const isCreating = ref(false);
const form = ref({ title: '', source: 'Tarım ve Orman Bakanlığı İl Müdürlüğü', reference: '', requestedAt: new Date().toISOString().slice(0, 10), note: '', text: '' });
const detailOpen = ref(false);
const detail = ref<MinistryRequestDetail | null>(null);
const isLoadingDetail = ref(false);

const canWrite = computed(() => auth.isAdmin || ['kurum_admin', 'fabrika_sorumlusu', 'denetci'].includes(auth.caykurRole ?? ''));
const canDelete = computed(() => auth.isAdmin || auth.caykurRole === 'kurum_admin');
const lineCount = computed(() => form.value.text.split(/\r?\n/).filter((l) => l.trim()).length);

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    const iso = d.slice(0, 10);
    return `${Number(iso.slice(8, 10))} ${MONTHS_TR[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
function seasonLabel(s: string): string {
    const [a, b] = s.split('-');
    return b ? `${a}–20${b}` : s;
}
function decisionMeta(d: string | null) {
    return FUSION_DECISION_META[(d ?? 'no_data') as FusionDecision] ?? FUSION_DECISION_META.no_data;
}

async function loadSummary(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    const res = await api.getFusionSummary(props.areaId, season.value || undefined);
    isLoading.value = false;
    if (!res.data) {
        error.value = res.error?.message ?? 'Sezon bilgisi yüklenemedi';
        return;
    }
    summary.value = res.data;
    season.value = res.data.season;
    await loadRequests();
}

async function loadRequests(): Promise<void> {
    isLoadingRequests.value = true;
    const res = await api.getMinistryRequests(props.areaId, season.value || undefined);
    isLoadingRequests.value = false;
    if (res.data) requests.value = res.data;
    else toast.error(res.error?.message ?? 'Talepler yüklenemedi');
}

function onSeason(v: unknown): void {
    if (typeof v === 'string' && v) {
        season.value = v;
        void loadSummary();
    }
}

async function download(key: string, run: () => Promise<{ blob?: Blob; filename?: string; error?: string }>, fallback: string): Promise<void> {
    busy.value = key;
    try {
        const res = await run();
        if (!res.blob) {
            toast.error(res.error ?? 'İndirilemedi');
            return;
        }
        saveBlob(res.blob, res.filename ?? fallback);
    } finally {
        busy.value = null;
    }
}

function onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const text = String(reader.result ?? '');
        form.value.text = form.value.text ? `${form.value.text.trimEnd()}\n${text}` : text;
        if (!form.value.title) form.value.title = file.name.replace(/\.[a-z0-9]+$/i, '');
    };
    reader.readAsText(file, 'utf-8');
    input.value = '';
}

async function create(): Promise<void> {
    if (!form.value.title.trim() || lineCount.value === 0) {
        toast.error('Başlık ve en az bir müstahsil satırı gerekli');
        return;
    }
    isCreating.value = true;
    const res = await api.createMinistryRequest(props.areaId, {
        title: form.value.title.trim(),
        source: form.value.source.trim() || undefined,
        reference: form.value.reference.trim() || undefined,
        requestedAt: form.value.requestedAt,
        season: season.value || undefined,
        note: form.value.note.trim() || undefined,
        text: form.value.text,
    });
    isCreating.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Talep kaydedilemedi');
        return;
    }
    createOpen.value = false;
    form.value = { title: '', source: form.value.source, reference: '', requestedAt: new Date().toISOString().slice(0, 10), note: '', text: '' };
    toast.success(`${res.data.itemCount} satır cevaplandı: ${res.data.matchedCount} eşleşti, ${res.data.unmatchedCount} eşleşmedi`);
    await loadRequests();
    detail.value = res.data;
    detailOpen.value = true;
}

async function open(id: string): Promise<void> {
    detailOpen.value = true;
    isLoadingDetail.value = true;
    detail.value = null;
    const res = await api.getMinistryRequest(props.areaId, id);
    isLoadingDetail.value = false;
    if (res.data) detail.value = res.data;
    else toast.error(res.error?.message ?? 'Talep yüklenemedi');
}

async function remove(r: MinistryRequestRow): Promise<void> {
    if (!window.confirm(`"${r.title}" talebi silinsin mi? Cevap kaydı ve eşleşmeler kaybolur.`)) return;
    const res = await api.deleteMinistryRequest(props.areaId, r.id);
    if (res.error) {
        toast.error(res.error);
        return;
    }
    toast.success('Talep silindi');
    if (detail.value?.id === r.id) detailOpen.value = false;
    await loadRequests();
}

onMounted(loadSummary);
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading && !summary" text="Sezon yükleniyor…" />
        <Alert v-else-if="error" variant="destructive">
            <AlertTitle>Raporlar yüklenemedi</AlertTitle>
            <AlertDescription class="flex flex-wrap items-center gap-3">{{ error }} <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button></AlertDescription>
        </Alert>
        <template v-else-if="summary">
            <div class="flex flex-wrap items-center gap-3">
                <span class="text-sm text-muted-foreground">Budama sezonu</span>
                <Select :model-value="season" @update:model-value="onSeason">
                    <SelectTrigger class="h-11 w-40 md:h-9" aria-label="Sezon"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="s in summary.seasons" :key="s" :value="s">{{ seasonLabel(s) }}</SelectItem>
                    </SelectContent>
                </Select>
                <Badge :variant="summary.calibrated ? 'success' : 'warning'">{{ summary.calibrated ? 'Kalibre edildi' : 'Kalibre edilmedi · idari ön değerlendirme' }}</Badge>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Müstahsil" :value="formatNumber(summary.producers.total)" :hint="`${summary.gardens.total} bahçe · ${summary.timeline.length} tarama`" :icon="Landmark" />
                <StatCard label="Alım açık" :value="formatNumber(summary.producers.byDecision.auto_open)" hint="otomatik · çay satabilir" :icon="FileText" />
                <StatCard label="Bekleyen / eksik" :value="formatNumber((summary.producers.byDecision.auto_pending ?? 0) + (summary.producers.byDecision.auto_short ?? 0))" hint="hedef dolmadı" :icon="FileSpreadsheet" />
                <StatCard label="Eksper (anomali)" :value="formatNumber(summary.producers.byDecision.expert_anomaly)" :hint="`ruhsat yok: ${summary.producers.byDecision.no_license ?? 0}`" :icon="FolderArchive" />
            </div>

            <!-- ── Season report ── -->
            <Card>
                <CardHeader>
                    <CardTitle>Sezon raporu · {{ seasonLabel(season) }}</CardTitle>
                    <CardDescription>Fabrika / mahalle bazında resmî çıktı: uyum, budama yapanlar, hedefi dolmayanlar, anomaliler, serbest çay yamaları ve ruhsat uyuşmazlıkları. Excel her satırı, PDF imzaya hazır özeti içerir.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap gap-3">
                    <Button class="h-11 md:h-9" :disabled="busy === 'xlsx'" @click="download('xlsx', () => api.downloadSeasonReport(areaId, 'xlsx', season), `sezon-raporu-${season}.xlsx`)"><FileSpreadsheet aria-hidden="true" />Excel · tüm listeler</Button>
                    <Button variant="outline" class="h-11 md:h-9" :disabled="busy === 'pdf'" @click="download('pdf', () => api.downloadSeasonReport(areaId, 'pdf', season), `sezon-raporu-${season}.pdf`)"><FileText aria-hidden="true" />PDF · özet (imza için)</Button>
                    <Button variant="outline" class="h-11 md:h-9" :disabled="busy === 'csv'" @click="download('csv', () => api.downloadFusionProducersCsv(areaId, season), `budama-yapan-mustahsiller-${season}.csv`)"><Download aria-hidden="true" />CSV · müstahsil listesi</Button>
                </CardContent>
            </Card>

            <!-- ── Ministry requests ── -->
            <Card>
                <CardHeader>
                    <CardTitle>Bakanlık / denetim talepleri</CardTitle>
                    <CardDescription>Gelen listeyi yapıştırın; sistem her satırı cüzdan, ruhsat veya müstahsil numarasıyla (yoksa ad soyadla) kütükle eşleştirir, alım kararını o anki haliyle kaydeder ve cevap listesi + müstahsil başına kanıt PDF'i paketini üretir.</CardDescription>
                    <CardAction v-if="canWrite">
                        <Button class="h-11 md:h-9" @click="createOpen = true"><Plus aria-hidden="true" />Yeni talep</Button>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <LoadingState v-if="isLoadingRequests && requests.length === 0" text="Talepler yükleniyor…" />
                    <EmptyState v-else-if="requests.length === 0" :icon="Landmark" title="Henüz talep yok" description="Bakanlık veya denetim listesi geldiğinde 'Yeni talep' ile yükleyin; cevap ve kanıt paketi dakikalar içinde hazır olur.">
                        <Button v-if="canWrite" class="h-11 md:h-9" @click="createOpen = true"><Plus aria-hidden="true" />Yeni talep</Button>
                    </EmptyState>
                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Talep</TableHead>
                                    <TableHead class="hidden md:table-cell">Satır / eşleşme</TableHead>
                                    <TableHead class="hidden lg:table-cell">Kararlar</TableHead>
                                    <TableHead class="text-right">Çıktılar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in requests" :key="r.id" class="cursor-pointer" tabindex="0" role="button" :aria-label="`${r.title} talebini aç`" @click="open(r.id)" @keydown.enter.prevent="open(r.id)">
                                    <TableCell>
                                        <div class="font-medium text-foreground">{{ r.title }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.source || '—' }}<span v-if="r.reference"> · {{ r.reference }}</span> · talep {{ fmtDate(r.requestedAt) }} · cevap {{ fmtDate(r.answeredAt) }} · {{ r.createdByName }}</div>
                                        <div class="mt-1 text-xs text-muted-foreground md:hidden">{{ r.itemCount }} satır · {{ r.matchedCount }} eşleşti<span v-if="r.unmatchedCount"> · {{ r.unmatchedCount }} eşleşmedi</span></div>
                                    </TableCell>
                                    <TableCell class="hidden md:table-cell">
                                        <div class="tabular-nums">{{ r.itemCount }} satır</div>
                                        <div class="text-xs text-muted-foreground">{{ r.matchedCount }} eşleşti<span v-if="r.unmatchedCount" class="text-destructive"> · {{ r.unmatchedCount }} eşleşmedi</span></div>
                                    </TableCell>
                                    <TableCell class="hidden lg:table-cell">
                                        <div class="flex flex-wrap gap-1">
                                            <Badge v-for="d in FUSION_DECISION_ORDER.filter((k) => r.byDecision[k])" :key="d" :variant="toneVariant(FUSION_DECISION_META[d].tone)" class="text-[10px]">{{ FUSION_DECISION_META[d].label }} · {{ r.byDecision[d] }}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell class="text-right" @click.stop>
                                        <div class="flex justify-end gap-1">
                                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="busy === `x-${r.id}`" aria-label="Cevap listesi (Excel)" title="Cevap listesi (Excel)" @click="download(`x-${r.id}`, () => api.downloadMinistryAnswer(areaId, r.id), `bakanlik-cevap-${r.season}.xlsx`)"><FileSpreadsheet aria-hidden="true" /></Button>
                                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="busy === `z-${r.id}`" aria-label="Kanıt paketi (ZIP)" title="Cevap + kanıt PDF'leri (ZIP)" @click="download(`z-${r.id}`, () => api.downloadMinistryEvidenceZip(areaId, r.id), `bakanlik-paketi-${r.season}.zip`)"><FolderArchive aria-hidden="true" /></Button>
                                            <Button v-if="canDelete" variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Talebi sil" title="Sil" @click="remove(r)"><Trash2 aria-hidden="true" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </template>

        <!-- ── New request dialog ── -->
        <Dialog v-model:open="createOpen">
            <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Yeni Bakanlık / denetim talebi</DialogTitle>
                    <DialogDescription>Her satırda bir müstahsil: cüzdan no, ruhsat no, müstahsil no ve/veya ad soyad; alanlar noktalı virgül, virgül veya sekmeyle ayrılabilir. Bir CSV/TXT dosyası da yükleyebilirsiniz.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="space-y-2 md:col-span-2">
                        <Label for="mr-title">Başlık</Label>
                        <Input id="mr-title" v-model="form.title" class="h-11 md:h-9" placeholder="Örn. İl Müdürlüğü budama tespit talebi — Mart 2026" />
                    </div>
                    <div class="space-y-2">
                        <Label for="mr-source">Talep eden</Label>
                        <Input id="mr-source" v-model="form.source" class="h-11 md:h-9" />
                    </div>
                    <div class="space-y-2">
                        <Label for="mr-ref">Yazı / referans no</Label>
                        <Input id="mr-ref" v-model="form.reference" class="h-11 md:h-9" placeholder="E-12345678-…" />
                    </div>
                    <div class="space-y-2">
                        <Label for="mr-date">Talep tarihi</Label>
                        <Input id="mr-date" v-model="form.requestedAt" type="date" class="h-11 md:h-9" />
                    </div>
                    <div class="space-y-2">
                        <Label for="mr-file">Liste dosyası (isteğe bağlı)</Label>
                        <Input id="mr-file" type="file" accept=".csv,.txt,text/csv,text/plain" class="h-11 md:h-9" @change="onFile" />
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <Label for="mr-text">Müstahsil listesi <span class="text-muted-foreground">({{ lineCount }} satır)</span></Label>
                        <Textarea id="mr-text" v-model="form.text" rows="8" class="font-mono text-xs" placeholder="DEMO-C-70055; Murat Haliloğlu&#10;DEMO-R-9106&#10;Ayşe Tuna" />
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <Label for="mr-note">Not</Label>
                        <Textarea id="mr-note" v-model="form.note" rows="2" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" @click="createOpen = false">Vazgeç</Button>
                    <Button class="h-11 md:h-9" :disabled="isCreating" @click="create">{{ isCreating ? 'Cevaplanıyor…' : 'Kaydet ve cevapla' }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- ── Request detail sheet ── -->
        <Sheet v-model:open="detailOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-4xl">
                <LoadingState v-if="isLoadingDetail || !detail" text="Talep yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.title }}</SheetTitle>
                        <SheetDescription>{{ detail.source || '—' }}<span v-if="detail.reference"> · {{ detail.reference }}</span> · talep {{ fmtDate(detail.requestedAt) }} · cevap {{ fmtDate(detail.answeredAt) }} · {{ detail.createdByName }} · sezon {{ seasonLabel(detail.season) }}</SheetDescription>
                        <div class="flex flex-wrap gap-2 pt-1">
                            <Button class="h-11 md:h-9" :disabled="busy === `x-${detail.id}`" @click="download(`x-${detail.id}`, () => api.downloadMinistryAnswer(areaId, detail!.id), `bakanlik-cevap-${detail.season}.xlsx`)"><FileSpreadsheet aria-hidden="true" />Cevap listesi (Excel)</Button>
                            <Button variant="outline" class="h-11 md:h-9" :disabled="busy === `z-${detail.id}`" @click="download(`z-${detail.id}`, () => api.downloadMinistryEvidenceZip(areaId, detail!.id), `bakanlik-paketi-${detail.season}.zip`)"><FolderArchive aria-hidden="true" />Kanıt paketi (ZIP · {{ detail.matchedCount }} PDF)</Button>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-4 p-4 md:p-6">
                        <div class="grid gap-3 sm:grid-cols-3">
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Satır</div><div class="font-semibold tabular-nums text-foreground">{{ detail.itemCount }}</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Eşleşen</div><div class="font-semibold tabular-nums text-foreground">{{ detail.matchedCount }}</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Eşleşmeyen</div><div class="font-semibold tabular-nums" :class="detail.unmatchedCount ? 'text-destructive' : 'text-foreground'">{{ detail.unmatchedCount }}</div></div>
                        </div>
                        <p v-if="detail.note" class="text-sm text-muted-foreground">{{ detail.note }}</p>
                        <div class="overflow-hidden rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Talepteki satır</TableHead>
                                        <TableHead>Kütük</TableHead>
                                        <TableHead>Alım kararı</TableHead>
                                        <TableHead class="hidden md:table-cell text-right">Sayılan / hedef</TableHead>
                                        <TableHead class="hidden lg:table-cell">Gerekçe</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="(i, n) in detail.items" :key="n">
                                        <TableCell>
                                            <div class="font-medium text-foreground">{{ i.name || i.walletNo || i.licenseNo || i.producerCode }}</div>
                                            <div class="text-xs text-muted-foreground">{{ [i.walletNo, i.licenseNo, i.producerCode].filter(Boolean).join(' · ') || '—' }}</div>
                                        </TableCell>
                                        <TableCell>
                                            <template v-if="i.matchedCode">
                                                <div class="text-foreground">{{ i.matchedName }}</div>
                                                <div class="text-xs text-muted-foreground">{{ i.matchedCode }} · {{ MATCH_LABEL[i.matchBy] }}</div>
                                            </template>
                                            <Badge v-else variant="danger">Eşleşmedi</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge :variant="i.matchedCode ? toneVariant(decisionMeta(i.decision).tone) : 'outline'">{{ i.decisionLabel }}</Badge>
                                            <div v-if="i.anomalies.length" class="mt-1 flex flex-wrap gap-1"><Badge v-for="a in i.anomalies" :key="a" variant="outline" class="text-[10px]">{{ a }}</Badge></div>
                                        </TableCell>
                                        <TableCell class="hidden md:table-cell text-right tabular-nums">
                                            <template v-if="i.matchedCode">{{ formatM2(i.countedM2) }} / {{ formatM2(i.requiredM2) }}<div v-if="i.shortfallM2" class="text-xs text-destructive">eksik {{ formatM2(i.shortfallM2) }}</div><div v-if="i.reusedM2" class="text-xs text-warning">tekrar {{ formatM2(i.reusedM2) }}</div></template>
                                            <span v-else>—</span>
                                        </TableCell>
                                        <TableCell class="hidden lg:table-cell text-xs text-muted-foreground">{{ i.reason }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
