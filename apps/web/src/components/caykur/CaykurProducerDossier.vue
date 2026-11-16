<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { LicensingProducerProfile } from '@/services/api';
import CaykurRemoteEvidence from '@/components/caykur/CaykurRemoteEvidence.vue';
import { Button } from '@/components/ui/button';
import { MATCH_LEVEL_META } from '@/services/caykur/teaInventory';
const props = defineProps<{ areaId: string; profile: LicensingProducerProfile; generatedAt: string | null }>();
const selected = ref('');
const garden = computed(() => props.profile.gardens.find(g => g.code === selected.value));
watch(() => [props.areaId, props.profile.code], () => { selected.value = ''; });
const unmatched = computed(() => props.profile.licenses.filter(l => l.matchLevel !== 'exact').length);
</script>

<template>
    <section class="space-y-3 rounded-lg border p-4" aria-label="Üretici kayıt ve kanıt dosyası">
        <h3 class="font-medium">Kayıt ve kanıt dosyası</h3>
        <p class="text-sm">Ruhsat ve üretici kayıtları DEMO'dur. Kayıt eşleşmesi, arazide çay bulunduğunu doğrulamaz. Ön değerlendirmedir; idari karar değildir.</p>
        <p class="text-xs text-muted-foreground">İçe aktarılan sicil paketinin tarihi: {{ generatedAt ? new Date(generatedAt).toLocaleDateString('tr-TR') : 'Kayıtlı değil' }}. Bu tarih son görüntü veya resmî kayıt güncelleme tarihi değildir.</p>
        <div class="space-y-2 text-sm">
            <p v-if="!profile.licenses.length">Sonraki inceleme: gerçek ruhsat listesinde üretici kaydını ve parsel bağlantısını kontrol edin.</p>
            <p v-else-if="unmatched">Sonraki inceleme: {{ unmatched }} ruhsatın tarihsel, olası veya eksik parsel eşleştirmesini belge üzerinden çözümleyin.</p>
            <p v-else>Sonraki inceleme: birebir ada/parsel eşleşmesinin dayandığı kaydı ve görüntü tarihlerini kontrol edin.</p>
            <p v-if="profile.conflicts.length">{{ profile.conflicts.length }} sınır ihtilafı kayıtlı; önerilen sınırları ve dayanaklarını karşılaştırın.</p>
            <p>Eksik kanıt: gerçek ÇAYKUR ruhsat listesi henüz yok. Güncel resmî kayıt tarihi bu dosyada ayrıca doğrulanmış değil.</p>
        </div>
        <div v-for="license in profile.licenses" :key="license.code" class="rounded border p-3 text-sm">
            <strong>{{ license.code }}</strong> · {{ MATCH_LEVEL_META[license.matchLevel].label }}
            <p>Kayıtlı referans: {{ license.recordedParcelRefs.join(', ') || 'Referans yok' }}</p>
            <p>Eşleşen parseller: {{ license.matchedParcelKeys.map(k => k.split('/').slice(1).join('/')).join(', ') || 'Eşleşme yok' }}</p>
            <p v-if="license.candidateParcelKeys.length">Adaylar: {{ license.candidateParcelKeys.map(k => k.split('/').slice(1).join('/')).join(', ') }}; henüz doğrulanmış bağlantı değildir.</p>
            <p class="text-xs text-muted-foreground">Eşleştirme dayanağı: {{ MATCH_LEVEL_META[license.matchLevel].description }} Belge ve tarihsel bağlantı ayrıntıları aşağıdaki ruhsat kaydındadır.</p>
        </div>
        <p class="text-sm">Bir bahçe seçerek kayıtlı görüntü dönemi ve NDVI gözlem eksiklerini inceleyin:</p>
        <div class="flex flex-wrap gap-2"><Button v-for="g in profile.gardens" :key="g.code" variant="outline" class="min-h-11" :aria-pressed="selected === g.code" @click="selected = g.code">{{ g.block }}/{{ g.parcel }} · {{ g.code }}</Button></div>
        <p v-if="!profile.gardens.length" class="text-sm">Bağlı bahçe yok; başka parselin kanıtı yerine kullanılmaz.</p>
        <CaykurRemoteEvidence v-if="garden" :area-id="areaId" :block="garden.block" :parcel="garden.parcel" />
    </section>
</template>
