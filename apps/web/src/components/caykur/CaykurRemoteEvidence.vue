<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { api, type RemoteParcelEvidence } from '@/services/api';
import { LoadingState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const props = defineProps<{ areaId: string; block: string; parcel: string }>();
const data = ref<RemoteParcelEvidence | null>(null);
const loading = ref(false);
const error = ref('');
const year = ref('');
let requestId = 0;
const months = computed(() => data.value?.monthly?.months ?? []);
const values = computed(() => data.value?.monthly?.ndvi[Number(year.value)] ?? []);
// Null observations split the path; missing evidence is never interpolated.
const paths = computed(() => {
    const segments: string[] = [];
    let segment = '';
    months.value.forEach((_, i) => {
        const value = values.value[i];
        if (value == null || !Number.isFinite(value)) { if (segment) segments.push(segment); segment = ''; return; }
        segment += `${segment ? ' L' : 'M'}${30 + i * 420 / Math.max(1, months.value.length - 1)},${130 - value * 100}`;
    });
    if (segment) segments.push(segment);
    return segments;
});
async function load(): Promise<void> {
    const current = ++requestId;
    loading.value = true;
    data.value = null;
    error.value = '';
    const result = await api.getRemoteParcelEvidence(props.areaId, props.block, props.parcel);
    if (current !== requestId) return;
    loading.value = false;
    if (!result.data) { error.value = result.error?.message ?? 'Zaman serisi alınamadı.'; return; }
    data.value = result.data;
    const years = result.data.monthly?.years ?? [];
    const droneYear = Number(result.data.drone?.capturedAt.slice(0, 4));
    year.value = String(years.includes(droneYear) ? droneYear : years[years.length - 1] ?? '');
}
watch(() => [props.areaId, props.block, props.parcel], () => void load(), { immediate: true });
onBeforeUnmount(() => requestId++);
</script>

<template>
    <section class="space-y-3 rounded-lg border p-3" aria-label="Uzaktan algılama zaman serisi">
        <h3 class="font-medium">Uzaktan algılama · zaman serisi</h3>
        <p class="text-xs text-muted-foreground">NDVI bitki örtüsü göstergesidir; tek başına çayı tanımaz, ruhsat varlığını veya ihlali kanıtlamaz. Düşüş budama, gölge veya görüntü koşullarından kaynaklanabilir. Ön değerlendirmedir.</p>
        <LoadingState v-if="loading" text="Kayıtlı gözlemler yükleniyor…" />
        <div v-else-if="error" role="alert"><p class="text-sm">{{ error }}</p><Button variant="outline" class="min-h-11" @click="load">Yeniden dene</Button></div>
        <template v-else-if="data">
            <p v-if="data.drone" class="text-sm">Drone: {{ data.drone.capturedAt }} · {{ data.drone.capturedAtNote }} {{ data.drone.verified ? 'Kayıt doğrulanmış olarak işaretli.' : 'Görüntü okuması doğrulanmış ölçüm değildir.' }}</p>
            <p v-else class="text-sm text-muted-foreground">Bu parselde drone okuması yok.</p>
            <p v-if="data.fullPixels < 6" class="text-sm text-warning">Parsel uydu ızgarası için küçük ({{ data.fullPixels }} tam piksel); komşu örtü etkisi nedeniyle güçlü sonuç çıkarılamaz.</p>
            <template v-if="data.monthly?.years.length">
                <Label for="remote-evidence-year">Sentinel-2 aylık NDVI · yıl</Label>
                <Select v-model="year"><SelectTrigger id="remote-evidence-year" class="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="value in data.monthly.years" :key="value" :value="String(value)">{{ value }}</SelectItem></SelectContent></Select>
                <svg viewBox="0 0 480 250" class="w-full text-info" role="img" :aria-label="`${year} aylık NDVI; sayısal değerler aşağıda`">
                    <line x1="30" y1="30" x2="450" y2="30" stroke="var(--border)" /><line x1="30" y1="130" x2="450" y2="130" stroke="var(--border)" /><line x1="30" y1="230" x2="450" y2="230" stroke="var(--border)" />
                    <text x="0" y="34" fill="var(--muted-foreground)" font-size="12">1</text><text x="0" y="134" fill="var(--muted-foreground)" font-size="12">0</text><text x="0" y="234" fill="var(--muted-foreground)" font-size="12">−1</text>
                    <path v-for="(path, i) in paths" :key="i" :d="path" fill="none" stroke="currentColor" stroke-width="2" />
                    <template v-for="(month, i) in months" :key="month"><circle v-if="values[i] != null" :cx="30 + i * 420 / Math.max(1, months.length - 1)" :cy="130 - values[i]! * 100" r="4" fill="currentColor" /><text :x="30 + i * 420 / Math.max(1, months.length - 1)" y="247" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">{{ month }}. ay</text></template>
                </svg>
                <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div v-for="(month, i) in months" :key="month" class="rounded border p-2">{{ month }}. ay: <strong>{{ values[i] == null ? 'Gözlem yok' : values[i]!.toFixed(3) }}</strong></div></div>
                <p class="text-xs text-muted-foreground">Eksik gözlemler doldurulmaz. Yalnız arşivdeki aylar gösterilir; aynı uydunun tekrarları ikinci bağımsız kaynak değildir.</p>
            </template>
            <p v-else class="text-sm text-muted-foreground">Bu parsel için kayıtlı aylık seri yok. Başka bir parselin verisi yerine kullanılmadı.</p>
            <details v-if="data.annual?.years.length" class="text-sm"><summary class="min-h-11 cursor-pointer py-3">Landsat yıllık yaz serisi · 30 m · {{ data.annual.years[0] }}–{{ data.annual.years[data.annual.years.length - 1] }}</summary><div class="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4"><div v-for="(value, i) in data.annual.years" :key="value">{{ value }}: {{ data.annual.ndvi[i] == null ? 'Gözlem yok' : data.annual.ndvi[i]!.toFixed(3) }}</div></div></details>
        </template>
    </section>
</template>
