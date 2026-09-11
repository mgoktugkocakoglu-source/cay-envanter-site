<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Bell, Check, MapPinned, Ruler, UserRound, X } from '@lucide/vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { ConfirmDialog, EmptyState, LoadingState, PageContainer, PageHeader } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useToast } from '@/composables/useToast';
import type { LicensingApproval, LicensingApprovalStatus } from '@/services/api';

/**
 * Bildirimler — ruhsatlandırma onay talepleri. A co-owner of a hisseli parcel
 * sees the slice Çaykur staff measured for another registered owner and
 * approves or rejects it; the measurement is final only when every co-owner
 * approved.
 */
const store = useNotificationsStore();
const toast = useToast();

const busyId = ref<string | null>(null);

// ── Approve (confirm) ──
const approveTarget = ref<LicensingApproval | null>(null);
const approveOpen = computed({
    get: () => approveTarget.value !== null,
    set: (v: boolean) => { if (!v) approveTarget.value = null; },
});
async function confirmApprove(): Promise<void> {
    const target = approveTarget.value;
    if (!target) return;
    busyId.value = target.id;
    const result = await store.decide(target.id, 'approved');
    busyId.value = null;
    approveTarget.value = null;
    if (result) toast.success('Ölçüm onaylandı.');
    else toast.error(store.error ?? 'Onay kaydedilemedi.');
}

// ── Reject (reason dialog) ──
const rejectTarget = ref<LicensingApproval | null>(null);
const rejectReason = ref('');
const rejectOpen = computed({
    get: () => rejectTarget.value !== null,
    set: (v: boolean) => { if (!v) { rejectTarget.value = null; rejectReason.value = ''; } },
});
function openReject(a: LicensingApproval): void {
    rejectReason.value = '';
    rejectTarget.value = a;
}
async function confirmReject(): Promise<void> {
    const target = rejectTarget.value;
    if (!target) return;
    busyId.value = target.id;
    const result = await store.decide(target.id, 'rejected', rejectReason.value.trim() || undefined);
    busyId.value = null;
    rejectOpen.value = false;
    if (result) toast.info('İtirazınız kaydedildi.');
    else toast.error(store.error ?? 'İtiraz kaydedilemedi.');
}

const STATUS_META: Record<LicensingApprovalStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
    pending: { label: 'Onayınız bekleniyor', variant: 'warning' },
    approved: { label: 'Onayladınız', variant: 'success' },
    rejected: { label: 'İtiraz ettiniz', variant: 'danger' },
};

function formatNumber(n: number): string {
    return Math.round(n).toLocaleString('tr-TR');
}
function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function methodLabel(method: string | null | undefined): string {
    if (method === 'gps') return 'GPS';
    if (method === 'map') return 'Harita';
    if (method === 'imu') return 'Lazer + IMU';
    if (method === 'assisted') return 'Destekli';
    return '—';
}
function parcelLabel(a: LicensingApproval): string {
    const m = a.measurement;
    return m ? `${m.il} / ${m.ilce} · Ada ${m.ada} / Parsel ${m.parsel}` : 'Parsel bilgisi yok';
}

onMounted(() => store.fetchApprovals());
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer size="narrow">
            <PageHeader
                title="Bildirimler"
                description="Ortak sahibi olduğunuz arazilerde yapılan ruhsatlandırma ölçümleri onayınızı bekler."
            >
                <template #meta>
                    <Badge v-if="store.pendingApprovals.length" variant="warning">{{ store.pendingApprovals.length }} bekleyen onay</Badge>
                    <Badge v-else variant="secondary">Bekleyen onay yok</Badge>
                </template>
            </PageHeader>

            <LoadingState v-if="store.isLoading && !store.approvals.length" text="Bildirimler yükleniyor..." />

            <Alert v-else-if="store.error && !store.approvals.length" variant="destructive">
                <AlertDescription>{{ store.error }}</AlertDescription>
            </Alert>

            <EmptyState
                v-else-if="!store.approvals.length"
                :icon="Bell"
                title="Bildiriminiz yok"
                description="Ortak sahibi olduğunuz bir arazide ruhsatlandırma ölçümü yapıldığında burada onayınıza sunulur."
            />

            <template v-else>
                <section v-if="store.pendingApprovals.length" class="flex flex-col gap-4">
                    <h2 class="text-base font-semibold text-foreground">Onayınızı bekleyenler</h2>
                    <Card v-for="a in store.pendingApprovals" :key="a.id" class="gap-4 py-4">
                        <CardHeader class="px-4">
                            <div class="flex flex-wrap items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <CardTitle class="flex items-center gap-2">
                                        <Ruler class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        Ruhsatlandırma ölçümü
                                    </CardTitle>
                                    <CardDescription class="mt-1 flex items-center gap-1">
                                        <MapPinned class="size-3.5 shrink-0" aria-hidden="true" />
                                        {{ parcelLabel(a) }}
                                    </CardDescription>
                                </div>
                                <Badge :variant="STATUS_META[a.status].variant">{{ STATUS_META[a.status].label }}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent class="flex flex-col gap-4 px-4">
                            <p class="text-sm text-muted-foreground">
                                Çaykur yetkili personeli <strong class="text-foreground">{{ a.measurement?.measuredByName ?? '—' }}</strong>,
                                bu arazide <strong class="text-foreground">{{ a.measurement?.ownerName ?? '—' }}</strong> adına kayıtlı alanı ölçtü.
                                Ölçümün kesinleşmesi için onayınız gerekiyor.
                            </p>

                            <dl class="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                                <div class="flex items-start gap-2">
                                    <UserRound class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    <div class="min-w-0">
                                        <dt class="text-xs text-muted-foreground">Ölçülen sahip</dt>
                                        <dd class="font-medium text-foreground">
                                            {{ a.measurement?.ownerName ?? '—' }}
                                            <span v-if="a.measurement?.ownerCuzdanNo" class="text-xs font-normal text-muted-foreground">· Cüzdan {{ a.measurement.ownerCuzdanNo }}</span>
                                        </dd>
                                    </div>
                                </div>
                                <div>
                                    <dt class="text-xs text-muted-foreground">Ölçülen alan</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ formatNumber(a.measurement?.measuredAreaM2 ?? 0) }} m²</dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-muted-foreground">Yöntem</dt>
                                    <dd class="text-foreground">{{ methodLabel(a.measurement?.method) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-muted-foreground">Ölçüm tarihi</dt>
                                    <dd class="text-foreground">{{ formatDateTime(a.measurement?.measuredAt) }}</dd>
                                </div>
                            </dl>

                            <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" class="h-11 md:h-9" :disabled="busyId === a.id" @click="openReject(a)">
                                    <X aria-hidden="true" />
                                    İtiraz et
                                </Button>
                                <Button class="h-11 md:h-9" :disabled="busyId === a.id" @click="approveTarget = a">
                                    <Check aria-hidden="true" />
                                    Onayla
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section v-if="store.decidedApprovals.length" class="flex flex-col gap-4">
                    <h2 class="text-base font-semibold text-foreground">Karara bağlananlar</h2>
                    <div class="overflow-hidden rounded-lg border bg-card">
                        <ul class="divide-y">
                            <li v-for="a in store.decidedApprovals" :key="a.id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                <div class="min-w-0">
                                    <p class="font-medium text-foreground">{{ a.measurement?.ownerName ?? '—' }} · {{ formatNumber(a.measurement?.measuredAreaM2 ?? 0) }} m²</p>
                                    <p class="truncate text-xs text-muted-foreground">{{ parcelLabel(a) }} · {{ formatDateTime(a.decidedAt) }}</p>
                                    <p v-if="a.reason" class="mt-1 text-xs text-muted-foreground">Gerekçe: {{ a.reason }}</p>
                                </div>
                                <Badge :variant="STATUS_META[a.status].variant">{{ STATUS_META[a.status].label }}</Badge>
                            </li>
                        </ul>
                    </div>
                </section>
            </template>
        </PageContainer>

        <ConfirmDialog
            v-model:open="approveOpen"
            variant="primary"
            title="Ölçümü onaylıyor musunuz?"
            :description="approveTarget ? `${approveTarget.measurement?.ownerName ?? 'Sahip'} adına ölçülen ${formatNumber(approveTarget.measurement?.measuredAreaM2 ?? 0)} m² alanı onaylamış olacaksınız.` : ''"
            confirm-text="Onayla"
            :loading="busyId !== null"
            @confirm="confirmApprove"
        />

        <Dialog v-model:open="rejectOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ölçüme itiraz et</DialogTitle>
                    <DialogDescription>
                        İtirazınız ölçümü durdurur; Çaykur personeli yeniden ölçüm yapabilir. Gerekçenizi yazmanız incelemeyi hızlandırır.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <Label for="reject-reason">Gerekçe</Label>
                    <Textarea id="reject-reason" v-model="rejectReason" rows="4" placeholder="Örn. ölçülen alan benim payıma giriyor" />
                </div>
                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" @click="rejectOpen = false">Vazgeç</Button>
                    <Button variant="destructive" class="h-11 md:h-9" :disabled="busyId !== null" @click="confirmReject">İtiraz et</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </TeaBusinessLayout>
</template>
