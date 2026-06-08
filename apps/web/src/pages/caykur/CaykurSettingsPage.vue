<script setup lang="ts">
import { ref } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    SEASON_LABEL,
    BASE_PRICE_PER_KG,
    ORGANIC_PREMIUM_PER_KG,
    BUDAMA_TARGET_PCT,
    formatTRY,
    formatNumber,
} from '@/services/caykur';

const channels = ref({ sms: true, email: true, push: true });

const integrations = [
    { name: 'SMS sağlayıcı', status: 'connected' as const, detail: 'NetGSM' },
    { name: 'E-posta (Resend)', status: 'connected' as const, detail: 'Aktif' },
    { name: 'Banka ödeme dosyası', status: 'connected' as const, detail: 'Ziraat · EFT' },
    { name: 'Tartım sistemi', status: 'pending' as const, detail: 'Entegrasyon planlandı' },
    { name: 'Kadastro / TKGM', status: 'pending' as const, detail: 'Entegrasyon planlandı' },
    { name: 'Muhasebe / ERP', status: 'disconnected' as const, detail: 'Bağlı değil' },
];

const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
    connected: { label: 'Bağlı', tone: 'success' },
    pending: { label: 'Planlandı', tone: 'warning' },
    disconnected: { label: 'Bağlı değil', tone: 'muted' },
};
</script>

<template>
    <CaykurPage title="Sistem Ayarları" sub="Kampanya, fiyat, kota ve entegrasyon ayarları">
        <div class="ck-grid-2">
            <div>
                <CaykurPanel title="Kampanya">
                    <dl class="ck-dl">
                        <div class="ck-dl-item"><span class="ck-dl-term">Aktif sezon</span><span class="ck-dl-val">{{ SEASON_LABEL }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Kampanya durumu</span><span class="ck-dl-val">Açık</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Sürgün dönemi</span><span class="ck-dl-val">3. Sürgün</span></div>
                    </dl>
                </CaykurPanel>

                <CaykurPanel title="Fiyatlandırma">
                    <dl class="ck-dl">
                        <div class="ck-dl-item"><span class="ck-dl-term">Taban fiyat</span><span class="ck-dl-val">{{ formatTRY(BASE_PRICE_PER_KG, 2) }}/kg</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Organik primi</span><span class="ck-dl-val">+{{ formatTRY(ORGANIC_PREMIUM_PER_KG, 2) }}/kg</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Stopaj</span><span class="ck-dl-val">%2</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">SGK prim</span><span class="ck-dl-val">%1</span></div>
                    </dl>
                </CaykurPanel>

                <CaykurPanel title="Kota & budama kuralları">
                    <dl class="ck-dl">
                        <div class="ck-dl-item"><span class="ck-dl-term">Kota (konvansiyonel)</span><span class="ck-dl-val">2.000 kg/da</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Kota (organik)</span><span class="ck-dl-val">1.500 kg/da</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Budama rotasyonu</span><span class="ck-dl-val">1/7 (%{{ formatNumber(BUDAMA_TARGET_PCT, 1) }})</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Uyum bandı</span><span class="ck-dl-val">%11 – %20</span></div>
                    </dl>
                </CaykurPanel>
            </div>

            <div>
                <CaykurPanel title="Bildirim kanalları">
                    <div class="ck-panel-body toggles">
                        <label class="toggle-row">
                            <span>
                                <span class="toggle-name">SMS bildirimleri</span>
                                <span class="toggle-desc">Müstahsillere SMS gönderimi</span>
                            </span>
                            <input type="checkbox" v-model="channels.sms" class="toggle" />
                        </label>
                        <label class="toggle-row">
                            <span>
                                <span class="toggle-name">E-posta bildirimleri</span>
                                <span class="toggle-desc">Duyuru ve ekstre e-postaları</span>
                            </span>
                            <input type="checkbox" v-model="channels.email" class="toggle" />
                        </label>
                        <label class="toggle-row">
                            <span>
                                <span class="toggle-name">Mobil bildirimler</span>
                                <span class="toggle-desc">Uygulama push bildirimleri</span>
                            </span>
                            <input type="checkbox" v-model="channels.push" class="toggle" />
                        </label>
                    </div>
                </CaykurPanel>

                <CaykurPanel title="Entegrasyonlar">
                    <ul class="integration-list">
                        <li v-for="it in integrations" :key="it.name" class="integration-row">
                            <div class="integration-main">
                                <span class="integration-name">{{ it.name }}</span>
                                <span class="integration-detail">{{ it.detail }}</span>
                            </div>
                            <StatusPill :label="statusMeta[it.status].label" :tone="statusMeta[it.status].tone" />
                        </li>
                    </ul>
                </CaykurPanel>
            </div>
        </div>
    </CaykurPage>
</template>

<style scoped>
.toggles { display: flex; flex-direction: column; gap: var(--space-2); }
.toggle-row {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
}
.toggle-row:last-child { border-bottom: none; }
.toggle-name { display: block; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.toggle-desc { display: block; font-size: var(--font-size-xs); color: var(--color-text-muted); }
.toggle { width: 18px; height: 18px; accent-color: var(--color-primary); cursor: pointer; }
.integration-list { list-style: none; margin: 0; padding: 0; }
.integration-row {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-border);
}
.integration-row:first-child { border-top: none; }
.integration-main { display: flex; flex-direction: column; gap: 1px; }
.integration-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.integration-detail { font-size: var(--font-size-xs); color: var(--color-text-muted); }
</style>
