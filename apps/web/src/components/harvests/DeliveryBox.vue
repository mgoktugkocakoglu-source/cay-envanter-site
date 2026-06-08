<script setup lang="ts">
import { computed } from 'vue';
import type { Payment } from '@/services/api';
import { getFirmLogo, getFirmInitials } from '@/utils/tariff';

const props = defineProps<{ delivery: Payment }>();
const emit = defineEmits<{ (e: 'assign', deliveryId: string): void }>();

const firmName = computed(() => props.delivery.firm?.name ?? props.delivery.brokerFirm?.firmName ?? 'Çay Firması');
const logo = computed(() => getFirmLogo({ name: firmName.value, logoUrl: props.delivery.firm?.logoUrl ?? null }));

function formatKg(kg: number) {
    return Number(kg).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(price);
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}
</script>

<template>
    <div class="delivery-box" :class="{ 'delivery-box--unassigned': !delivery.assigned }">
        <div class="delivery-head">
            <div class="delivery-firm">
                <span class="firm-logo" :class="{ 'firm-logo--img': logo }">
                    <img v-if="logo" :src="logo" :alt="`${firmName} logosu`" />
                    <span v-else>{{ getFirmInitials(firmName) }}</span>
                </span>
                <span class="firm-name">{{ firmName }}</span>
            </div>
            <span class="status-badge" :class="delivery.paymentStatus === 'received' ? 'status-badge--received' : 'status-badge--pending'">
                {{ delivery.paymentStatus === 'received' ? 'Ödendi' : 'Bekliyor' }}
            </span>
        </div>

        <div class="delivery-body">
            <div class="delivery-cell">
                <span class="cell-label">Miktar</span>
                <span class="cell-value cell-value--strong">{{ formatKg(delivery.totalAmountKg) }}</span>
            </div>
            <div class="delivery-cell">
                <span class="cell-label">Tarife</span>
                <span class="cell-value">{{ delivery.tariffLabel || 'Peşin Ödeme' }}</span>
            </div>
            <div class="delivery-cell">
                <span class="cell-label">Tutar</span>
                <span class="cell-value cell-value--strong">{{ formatPrice(delivery.totalPrice) }}</span>
            </div>
            <div class="delivery-cell">
                <span class="cell-label">Tarih</span>
                <span class="cell-value">{{ formatDate(delivery.paymentDate) }}</span>
            </div>
        </div>

        <div class="delivery-footer">
            <div v-if="delivery.assigned" class="assigned-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Arazi: {{ delivery.assignedField?.name?.trim() || 'İsimsiz Arazi' }}
            </div>
            <button v-else class="btn-assign" @click="emit('assign', delivery.id)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Arazi ekle
            </button>
        </div>
    </div>
</template>

<style scoped>
.delivery-box {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.delivery-box:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
}
.delivery-box--unassigned {
    border-style: dashed;
    border-color: var(--color-primary);
}

.delivery-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.delivery-firm {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}
.firm-logo {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #fff;
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    font-weight: 800;
    font-size: 13px;
    color: var(--color-primary);
}
.firm-logo img { width: 100%; height: 100%; object-fit: contain; padding: 5px; box-sizing: border-box; }
.firm-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
}
.status-badge--received { background: rgba(34, 197, 94, 0.15); color: var(--color-success); }
.status-badge--pending { background: rgba(245, 158, 11, 0.15); color: var(--color-warning); }

.delivery-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
    padding: 14px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}
.delivery-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cell-label { font-size: 11px; color: var(--color-text-muted); font-weight: 600; }
.cell-value {
    font-size: 14px;
    color: var(--color-text-primary);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.cell-value--strong { font-weight: 700; }

.delivery-footer { display: flex; }
.btn-assign {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background var(--transition-fast);
}
.btn-assign:hover { background: var(--color-primary-hover); }
.assigned-chip {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
}
</style>
