<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { api, type DroneVerificationDetail } from '@/services/api';
import { LoadingState } from '@/components/shared';
import { Button } from '@/components/ui/button';
const props = defineProps<{ areaId: string; block: string; parcel: string }>();
const detail = ref<DroneVerificationDetail | null>(null);
const loading = ref(false);
const error = ref('');
const imageFailed = ref(false);
const index = ref(0);
let requestId = 0;
const frames = computed(() => detail.value?.drone?.frames ?? []);
const frame = computed(() => frames.value[index.value]);
const safeUrl = computed(() => { const url = frame.value?.frameUrl; return url?.startsWith('/inventory-imagery/') && !url.includes('..') ? url : null; });
const label: Record<string, string> = { tea_present: 'Çay mevcut', tea_not_found: 'Çay bulunamadı', partial: 'Kısmen çay', uncertain: 'Belirsiz' };
async function load(): Promise<void> {
    const current = ++requestId; loading.value = true; error.value = ''; detail.value = null; index.value = 0; imageFailed.value = false;
    const result = await api.getDroneVerificationParcel(props.areaId, props.block, props.parcel);
    if (current !== requestId) return;
    loading.value = false;
    if (!result.data) { error.value = result.error?.message ?? 'Drone kanıtı alınamadı'; return; }
    detail.value = result.data;
    const reference = frames.value.findIndex((f) => f.isReference); index.value = Math.max(0, reference);
}
watch(index, () => imageFailed.value = false);
watch(() => [props.areaId, props.block, props.parcel], () => void load(), { immediate: true });
onBeforeUnmount(() => requestId++);
</script>
<template>
    <section class="space-y-3 rounded-lg border p-3" aria-label="Parsel drone kanıtı">
        <h3 class="font-medium">Özgün drone karesi · {{ block }}/{{ parcel }}</h3>
        <LoadingState v-if="loading" text="Parselin kayıtlı drone kareleri yükleniyor…" />
        <div v-else-if="error" role="alert"><p class="text-sm">{{ error }}</p><Button variant="outline" class="min-h-11" @click="load">Yeniden dene</Button></div>
        <template v-else-if="detail?.drone">
            <p class="text-sm">{{ detail.drone.sourceTitle }} · {{ label[detail.drone.class] ?? 'Belirsiz' }}. {{ detail.drone.review?.verified ? 'Kayıt doğrulanmış olarak işaretli.' : 'Görüntü okuması doğrulanmamıştır.' }}</p>
            <template v-if="frame && safeUrl">
                <p v-if="imageFailed" role="alert" class="text-sm">Kare dosyası yüklenemedi; başka kareyi seçin.</p>
                <img v-else :key="safeUrl" :src="safeUrl" :alt="`${block}/${parcel}, videonun ${frame.t.toFixed(2)}. saniyesindeki özgün parsel kırpımı`" class="max-h-[28rem] w-full rounded border object-contain" @error="imageFailed = true" />
                <div class="flex flex-wrap items-center gap-2"><Button variant="outline" class="min-h-11" :disabled="index === 0" @click="index--">Önceki kare</Button><span class="text-sm">{{ index + 1 }}/{{ frames.length }} · {{ frame.t.toFixed(2) }} sn</span><Button variant="outline" class="min-h-11" :disabled="index >= frames.length - 1" @click="index++">Sonraki kare</Button></div>
            </template>
            <p v-else class="text-sm">Bu okuma için yerel kare dosyası yok.</p>
            <p class="text-xs text-muted-foreground">Özgün çözünürlükteki parsel kırpımıdır; renklendirilmiş sınıflandırma görseli değildir. Yaklaşık parsel eşleştirmesi sınır/alan ölçümü sayılmaz. Ön değerlendirmedir, idari karar değildir.</p>
        </template>
        <p v-else class="text-sm text-muted-foreground">Bu parsel için drone okuması yok; başka parselin karesi gösterilmedi.</p>
    </section>
</template>
