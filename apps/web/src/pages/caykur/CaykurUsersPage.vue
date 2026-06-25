<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import { api, type CaykurStaff, type CaykurStaffRole, type CreateCaykurStaffPayload } from '@/services/api';
import {
    ROLE_DEFS,
    roleLabel,
    canAccess,
    MODULE_LABELS,
    ALL_MODULES,
    formatNumber,
    formatDate,
    type CaykurRole,
} from '@/services/caykur';

type View = 'staff' | 'roles';
const view = ref<View>('staff');
const search = ref('');
const roleFilter = ref<'all' | CaykurRole>('all');

const staff = ref<CaykurStaff[]>([]);
const loading = ref(false);
const loadError = ref('');

const PROVINCES = ['Rize', 'Trabzon', 'Artvin', 'Giresun', 'Ordu'];

const roleOptions = computed<Array<{ value: 'all' | CaykurRole; label: string }>>(() => [
    { value: 'all', label: 'Tüm roller' },
    ...ROLE_DEFS.map((r) => ({ value: r.id, label: r.short })),
]);

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return staff.value.filter((s) => {
        if (roleFilter.value !== 'all' && s.caykurRole !== roleFilter.value) return false;
        if (q && !`${s.fullName} ${s.caykurScope ?? ''} ${s.email}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

const activeCount = computed(() => staff.value.filter((s) => s.active).length);
const roleCount = (role: CaykurRole) => staff.value.filter((s) => s.caykurRole === role).length;

async function loadStaff() {
    loading.value = true;
    loadError.value = '';
    const res = await api.getCaykurStaff({ limit: 100 });
    loading.value = false;
    if (res.error) {
        loadError.value = res.error.message;
        return;
    }
    staff.value = res.data?.data ?? [];
}

onMounted(loadStaff);

// ── Create staff ──
const showForm = ref(false);
const submitting = ref(false);
const formError = ref('');
const createdNotice = ref<{ name: string; tempPassword: string } | null>(null);

const form = reactive<CreateCaykurStaffPayload>({
    fullName: '',
    email: '',
    phone: '',
    province: 'Rize',
    district: '',
    caykurRole: 'saha_personeli',
    caykurScope: '',
});

function openForm() {
    formError.value = '';
    createdNotice.value = null;
    Object.assign(form, {
        fullName: '', email: '', phone: '', province: 'Rize', district: '',
        caykurRole: 'saha_personeli' as CaykurStaffRole, caykurScope: '',
    });
    showForm.value = true;
}

async function submitForm() {
    formError.value = '';
    submitting.value = true;
    const res = await api.createCaykurStaff({ ...form, caykurScope: form.caykurScope || undefined });
    submitting.value = false;
    if (res.error) {
        formError.value = res.error.message;
        return;
    }
    showForm.value = false;
    createdNotice.value = { name: res.data!.fullName, tempPassword: res.data!.tempPassword };
    await loadStaff();
}
</script>

<template>
    <CaykurPage title="Kullanıcılar & Roller" :sub="`${formatNumber(staff.length)} personel · ${formatNumber(ROLE_DEFS.length)} rol`">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-primary" @click="openForm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Personel ekle
            </button>
        </template>

        <div v-if="createdNotice" class="ck-note ck-note-success">
            <strong>{{ createdNotice.name }}</strong> eklendi. Hesabını etkinleştirmesi için davet e-postası gönderildi.
            <span class="ck-note-pw">Geçici şifre: <code>{{ createdNotice.tempPassword }}</code></span>
        </div>
        <div v-if="loadError" class="ck-note ck-note-error">{{ loadError }}</div>

        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam personel" :value="formatNumber(staff.length)" sub="kurum kullanıcısı" />
            <CaykurStatCard label="Aktif" :value="formatNumber(activeCount)" sub="erişimi açık" />
            <CaykurStatCard label="Rol sayısı" :value="formatNumber(ROLE_DEFS.length)" sub="yetki seviyesi" />
            <CaykurStatCard label="Saha personeli" :value="formatNumber(roleCount('saha_personeli'))" sub="budama ölçümü" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'staff' }" @click="view = 'staff'">Personel</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'roles' }" @click="view = 'roles'">Roller & yetkiler</button>
        </div>

        <template v-if="view === 'staff'">
            <div class="ck-toolbar">
                <div class="ck-search-wrap">
                    <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input v-model="search" type="text" class="ck-search-input" placeholder="Personel ara…" />
                </div>
                <div class="ck-seg" role="group" aria-label="Rol filtresi">
                    <button v-for="opt in roleOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': roleFilter === opt.value }" @click="roleFilter = opt.value">{{ opt.label }}</button>
                </div>
            </div>

            <CaykurPanel>
                <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} personel</span></template>
                <div v-if="loading" class="ck-empty"><p class="ck-empty-sub">Yükleniyor…</p></div>
                <div v-else-if="filtered.length" class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr>
                                <th>Personel</th>
                                <th>Rol</th>
                                <th>Kapsam</th>
                                <th>Eklenme</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="s in filtered" :key="s.id">
                                <td>
                                    <div class="ck-name-cell">
                                        <span class="ck-avatar">{{ s.fullName.charAt(0) }}</span>
                                        <div class="ck-name-main">
                                            <span class="ck-name-top">{{ s.fullName }}</span>
                                            <span class="ck-name-sub">{{ s.email }}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>{{ roleLabel(s.caykurRole) }}</td>
                                <td>{{ s.caykurScope ?? '—' }}</td>
                                <td style="white-space:nowrap">{{ formatDate(s.createdAt) }}</td>
                                <td><StatusPill :label="s.active ? 'Aktif' : 'Pasif'" :tone="s.active ? 'success' : 'muted'" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="ck-empty">
                    <p class="ck-empty-title">Personel yok</p>
                    <p class="ck-empty-sub">Bu görünümde personel bulunmuyor. Sağ üstten yeni personel ekleyebilirsiniz.</p>
                </div>
            </CaykurPanel>
        </template>

        <div v-else class="roles-grid">
            <CaykurPanel v-for="r in ROLE_DEFS" :key="r.id">
                <div class="role-card">
                    <div class="role-head">
                        <h3 class="role-name">{{ r.label }}</h3>
                        <span class="role-count">{{ formatNumber(roleCount(r.id)) }} kişi</span>
                    </div>
                    <p class="role-desc">{{ r.description }}</p>
                    <div class="role-access">
                        <span class="role-access-label">Erişebildiği modüller</span>
                        <div class="role-chips">
                            <span
                                v-for="m in ALL_MODULES.filter(mk => canAccess(r.id, mk))"
                                :key="m"
                                class="role-chip"
                            >{{ MODULE_LABELS[m] }}</span>
                        </div>
                    </div>
                </div>
            </CaykurPanel>
        </div>

        <!-- Add staff modal -->
        <div v-if="showForm" class="ck-modal-overlay" @click.self="showForm = false">
            <div class="ck-modal" role="dialog" aria-modal="true" aria-label="Personel ekle">
                <div class="ck-modal-head">
                    <h2 class="ck-modal-title">Personel ekle</h2>
                    <button type="button" class="ck-modal-close" aria-label="Kapat" @click="showForm = false">×</button>
                </div>
                <form class="ck-form" @submit.prevent="submitForm">
                    <div v-if="formError" class="ck-note ck-note-error">{{ formError }}</div>
                    <label class="ck-field">
                        <span class="ck-field-label">Ad Soyad</span>
                        <input v-model="form.fullName" class="ck-input" type="text" required placeholder="Davut Şahin" />
                    </label>
                    <label class="ck-field">
                        <span class="ck-field-label">E-posta</span>
                        <input v-model="form.email" class="ck-input" type="email" required placeholder="davut.sahin@caykur.gov.tr" />
                    </label>
                    <div class="ck-field-row">
                        <label class="ck-field">
                            <span class="ck-field-label">Telefon</span>
                            <input v-model="form.phone" class="ck-input" type="tel" required placeholder="5XXXXXXXXX" />
                        </label>
                        <label class="ck-field">
                            <span class="ck-field-label">Rol</span>
                            <select v-model="form.caykurRole" class="ck-input">
                                <option v-for="r in ROLE_DEFS" :key="r.id" :value="r.id">{{ r.label }}</option>
                            </select>
                        </label>
                    </div>
                    <div class="ck-field-row">
                        <label class="ck-field">
                            <span class="ck-field-label">İl</span>
                            <select v-model="form.province" class="ck-input">
                                <option v-for="p in PROVINCES" :key="p" :value="p">{{ p }}</option>
                            </select>
                        </label>
                        <label class="ck-field">
                            <span class="ck-field-label">İlçe</span>
                            <input v-model="form.district" class="ck-input" type="text" required placeholder="Çayeli" />
                        </label>
                    </div>
                    <label class="ck-field">
                        <span class="ck-field-label">Kapsam <span class="ck-field-opt">(opsiyonel)</span></span>
                        <input v-model="form.caykurScope" class="ck-input" type="text" placeholder="Rize / Çayeli" />
                    </label>
                    <div class="ck-modal-actions">
                        <button type="button" class="ck-btn ck-btn-ghost" @click="showForm = false">Vazgeç</button>
                        <button type="submit" class="ck-btn ck-btn-primary" :disabled="submitting">
                            {{ submitting ? 'Ekleniyor…' : 'Personel ekle' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </CaykurPage>
</template>

<style scoped>
.roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
}
.role-card { padding: var(--space-5); }
.role-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.role-name { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.role-count {
    font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary); background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border); padding: 2px 8px; border-radius: var(--radius-full); white-space: nowrap;
}
.role-desc { margin: var(--space-2) 0 var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; }
.role-access-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.role-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-2); }
.role-chip {
    font-size: var(--font-size-xs); font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary); background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border); padding: 2px 8px; border-radius: var(--radius-sm);
}

.ck-note {
    margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md); font-size: var(--font-size-sm); line-height: 1.5;
}
.ck-note-success { background: color-mix(in srgb, var(--color-primary) 10%, transparent); border: 1px solid var(--color-primary); color: var(--color-text-primary); }
.ck-note-error { background: color-mix(in srgb, var(--color-danger) 10%, transparent); border: 1px solid var(--color-danger); color: var(--color-danger); }
.ck-note-pw { display: block; margin-top: 4px; color: var(--color-text-secondary); }
.ck-note-pw code { font-family: ui-monospace, monospace; color: var(--color-text-primary); }

.ck-modal-overlay {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
    display: flex; align-items: center; justify-content: center; padding: var(--space-4); z-index: 100;
}
.ck-modal {
    width: 100%; max-width: 520px; background: var(--color-bg-secondary);
    border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    box-shadow: 0 8px 18px -6px rgba(15, 23, 42, 0.14); max-height: 90vh; overflow: auto;
}
.ck-modal-head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
.ck-modal-title { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.ck-modal-close { background: none; border: none; font-size: 24px; line-height: 1; color: var(--color-text-muted); cursor: pointer; padding: 0 4px; }
.ck-form { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
.ck-field { display: flex; flex-direction: column; gap: 6px; }
.ck-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.ck-field-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.ck-field-opt { font-weight: 400; color: var(--color-text-muted); }
.ck-input {
    height: 40px; padding: 0 12px; background: var(--color-bg-primary);
    border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
    color: var(--color-text-primary); font-size: var(--font-size-sm); width: 100%;
}
.ck-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent); }
.ck-modal-actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2); }
.ck-btn-ghost { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary); }
@media (max-width: 520px) { .ck-field-row { grid-template-columns: 1fr; } }
</style>
