<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    parcelById,
    VERIFICATION_META,
    formatNumber,
    formatKg,
    formatDate,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

const parcel = computed(() => parcelById(String(route.params.id)));

function dekar(m2: number): string {
    return `${formatNumber(m2 / 1000, 1)} da`;
}

const maxYield = computed(() => {
    if (!parcel.value) return 1;
    return Math.max(...parcel.value.yieldHistory.map((y) => y.kg), 1);
});

/** Normalise the [lng,lat] ring to a 0..100 viewBox for the map placeholder. */
const polygonPoints = computed(() => {
    const ring = parcel.value?.polygon ?? [];
    if (ring.length === 0) return '';
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    return ring
        .map((p) => {
            const x = 12 + ((p[0] - minX) / spanX) * 76;
            const y = 88 - ((p[1] - minY) / spanY) * 76; // flip Y (north up)
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
});

function openProducer(): void {
    if (parcel.value) router.push(`/caykur/producers/${parcel.value.producerId}`);
}
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/parcels')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Parseller
        </button>

        <template v-if="parcel">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">Ada {{ parcel.ada }} / Parsel {{ parcel.parsel }}</h1>
                    <p class="ck-page-sub">
                        {{ parcel.neighborhood }}, {{ parcel.district }} · {{ parcel.region }}
                    </p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="VERIFICATION_META[parcel.verification].label" :tone="VERIFICATION_META[parcel.verification].tone" />
                    <span v-if="parcel.organic" class="ck-tag">Organik</span>
                </div>
            </header>

            <div v-if="parcel.hasOpenCorrection" class="correction-note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Bu parsel için açık bir düzeltme talebi bulunuyor.
            </div>

            <div class="ck-grid-2">
                <div>
                    <CaykurPanel title="Parsel bilgileri">
                        <dl class="ck-dl">
                            <div class="ck-dl-item">
                                <span class="ck-dl-term">Müstahsil</span>
                                <button type="button" class="link-val" @click="openProducer">{{ parcel.producerName }}</button>
                            </div>
                            <div class="ck-dl-item">
                                <span class="ck-dl-term">Bölge / İlçe</span>
                                <span class="ck-dl-val">{{ parcel.region }} / {{ parcel.district }}</span>
                            </div>
                            <div class="ck-dl-item">
                                <span class="ck-dl-term">Mahalle / Köy</span>
                                <span class="ck-dl-val">{{ parcel.neighborhood }}</span>
                            </div>
                            <div class="ck-dl-item">
                                <span class="ck-dl-term">Alan</span>
                                <span class="ck-dl-val">{{ formatNumber(parcel.areaM2) }} m² · {{ dekar(parcel.areaM2) }}</span>
                            </div>
                            <div class="ck-dl-item">
                                <span class="ck-dl-term">Doğrulama</span>
                                <span class="ck-dl-val">{{ parcel.verifiedAt ? formatDate(parcel.verifiedAt) : '—' }}</span>
                            </div>
                            <div class="ck-dl-item">
                                <span class="ck-dl-term">Fotoğraf</span>
                                <span class="ck-dl-val">{{ formatNumber(parcel.photoCount) }} adet</span>
                            </div>
                        </dl>
                    </CaykurPanel>

                    <CaykurPanel title="Parsel verim geçmişi" meta="son 5 sezon">
                        <div class="ck-panel-body">
                            <div class="yield-list">
                                <div v-for="y in parcel.yieldHistory" :key="y.year" class="yield-row">
                                    <span class="yield-year">{{ y.year }}</span>
                                    <div class="yield-track">
                                        <div class="yield-fill" :style="{ width: `${(y.kg / maxYield) * 100}%` }"></div>
                                    </div>
                                    <span class="yield-kg">{{ formatKg(y.kg) }}</span>
                                </div>
                            </div>
                        </div>
                    </CaykurPanel>
                </div>

                <CaykurPanel title="Harita görünümü">
                    <div class="ck-panel-body">
                        <div class="map-box" role="img" aria-label="Parsel sınırı haritası">
                            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                                <defs>
                                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--color-border)" stroke-width="0.5" />
                                    </pattern>
                                </defs>
                                <rect width="100" height="100" fill="url(#grid)" />
                                <polygon :points="polygonPoints" fill="color-mix(in srgb, var(--color-primary) 18%, transparent)" stroke="var(--color-primary)" stroke-width="1.2" stroke-linejoin="round" />
                            </svg>
                            <span class="map-coord">{{ parcel.polygon[0]?.[1]?.toFixed(4) }}, {{ parcel.polygon[0]?.[0]?.toFixed(4) }}</span>
                        </div>
                        <p class="map-note">Parsel sınırı kadastro verisinden türetilmiştir. Saha doğrulamasında GPS ile güncellenir.</p>
                        <div class="verify-actions" v-if="parcel.verification === 'pending' || parcel.verification === 'unverified'">
                            <button type="button" class="ck-btn ck-btn-primary">Doğrula</button>
                            <button type="button" class="ck-btn">Düzeltme iste</button>
                        </div>
                    </div>
                </CaykurPanel>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Parsel bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/parcels')">Parsellere dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.correction-note {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-4);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-warning);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
}
.link-val {
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    color: var(--color-secondary);
    font-family: inherit;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
}
.link-val:hover {
    text-decoration: underline;
}
.yield-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}
.yield-row {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 90px;
    align-items: center;
    gap: var(--space-3);
}
.yield-year {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
}
.yield-track {
    height: 10px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
}
.yield-fill {
    height: 100%;
    background: var(--color-secondary);
    border-radius: var(--radius-full);
}
.yield-kg {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
}
.map-box {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: 320px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
}
.map-box svg {
    width: 100%;
    height: 100%;
    display: block;
}
.map-coord {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    background: color-mix(in srgb, var(--color-bg-secondary) 80%, transparent);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
}
.map-note {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.5;
}
.verify-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-4);
}
</style>
