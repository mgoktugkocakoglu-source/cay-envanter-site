<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import { useFieldsStore } from '@/stores/fieldsStore';
import type { Field } from '@/services/api';

type MeasurementMethod = 'map' | 'gps' | 'assisted';

interface MethodOption {
  id: MeasurementMethod;
  title: string;
  description: string;
  badge: string;
}

interface ChecklistItem {
  label: string;
  status: 'done' | 'warning' | 'pending';
}

const selectedMethod = ref<MeasurementMethod>('map');
const selectedFieldId = ref<string | number | null>(null);
const fieldsStore = useFieldsStore();

const methods: MethodOption[] = [
  {
    id: 'map',
    title: 'Haritadan işaretleme',
    description: 'Açık arazide budanan bölüm uydu görüntüsü üzerinden çizilir.',
    badge: 'Açık arazi',
  },
  {
    id: 'gps',
    title: 'GPS ile saha ölçümü',
    description: 'Personel alan çevresinde yürür veya köşe noktalarını işaretler.',
    badge: 'Ağaç altı',
  },
  {
    id: 'assisted',
    title: 'Kontrollü kayıt',
    description: 'Düşük doğrulukta fotoğraf, not ve ek onay zorunlu tutulur.',
    badge: 'Şüpheli ölçüm',
  },
];

const checklist = computed<ChecklistItem[]>(() => [
  {
    label: selectedField.value
      ? `${selectedField.value.name} seçildi`
      : 'Ölçüm yapılacak tarla seçilecek',
    status: selectedField.value ? 'done' : 'pending',
  },
  {
    label: selectedField.value?.parcelNo
      ? `Parsel: ${selectedField.value.parcelNo}`
      : 'Ada/parsel bilgisi eksikse ölçüm öncesi tamamlanacak',
    status: selectedField.value?.parcelNo ? 'done' : 'warning',
  },
  {
    label:
      selectedMethod.value === 'gps'
        ? 'GPS doğruluğu 2.8 metre'
        : 'Harita çizimi saha kontrolü bekliyor',
    status: selectedMethod.value === 'gps' ? 'done' : 'warning',
  },
  { label: 'Üretici onayı alınacak', status: 'pending' },
]);

const selectedMethodLabel = computed(
  () => methods.find((method) => method.id === selectedMethod.value)?.title ?? '',
);

const fieldOptions = computed(() =>
  fieldsStore.fields.map((field) => ({
    value: field.id,
    label: `${field.name}${field.parcelNo ? ` · ${field.parcelNo}` : ''}`,
  })),
);

const selectedField = computed<Field | null>(() =>
  fieldsStore.fields.find((field) => field.id === selectedFieldId.value) ?? null,
);

const hasFields = computed(() => fieldsStore.fields.length > 0);

const selectedFieldAreaM2 = computed(() => {
  if (!selectedField.value) return 0;
  return toSquareMeters(selectedField.value.area, selectedField.value.areaUnit);
});

const targetPruningArea = computed(() => selectedFieldAreaM2.value / 10);

const fieldPolygonPoints = computed(() => {
  const ring = selectedField.value?.coordinates?.[0] ?? [];
  if (ring.length < 3) return '';

  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngSpan = maxLng - minLng || 1;
  const latSpan = maxLat - minLat || 1;

  return ring
    .map(([lng, lat]) => {
      const x = 10 + ((lng - minLng) / lngSpan) * 80;
      const y = 90 - ((lat - minLat) / latSpan) * 80;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
});

const fieldLocation = computed(() => {
  if (!selectedField.value) return 'Tarla seçilmedi';
  return [
    selectedField.value.province,
    selectedField.value.district,
    selectedField.value.neighborhood,
  ].filter(Boolean).join(' / ');
});

function toSquareMeters(area: number, unit: Field['areaUnit']): number {
  if (unit === 'm2') return Number(area);
  return Number(area) * 1000;
}

function formatArea(area: number, unit: Field['areaUnit']): string {
  const formatted = Number(area).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
  });
  const unitLabels: Record<Field['areaUnit'], string> = {
    donum: 'dönüm',
    dekar: 'dekar',
    m2: 'm²',
  };
  return `${formatted} ${unitLabels[unit]}`;
}

function formatSquareMeters(area: number): string {
  return `${area.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m²`;
}

function selectFirstFieldIfNeeded(): void {
  if (!selectedFieldId.value && fieldsStore.fields[0]) {
    selectedFieldId.value = fieldsStore.fields[0].id;
  }
}

onMounted(async () => {
  await fieldsStore.fetchFields();
  selectFirstFieldIfNeeded();
});

watch(
  () => fieldsStore.fields,
  () => {
    const stillExists = fieldsStore.fields.some((field) => field.id === selectedFieldId.value);
    if (!stillExists) {
      selectedFieldId.value = null;
      selectFirstFieldIfNeeded();
    }
  },
);
</script>

<template>
  <TeaBusinessLayout>
    <div class="pruning-page">
      <header class="page-header">
        <div>
          <p class="page-kicker">Çay İşleri</p>
          <h1>Budama ölçümü</h1>
          <p class="page-intro">
            Budanan alanı ada/parsel içinde konumuyla kaydet, ölçüm yöntemini belirt
            ve onay sürecini tek ekranda tamamla.
          </p>
        </div>
        <button class="primary-action" type="button" :disabled="!selectedField">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Yeni ölçüm başlat
        </button>
      </header>

      <section class="summary-strip" aria-label="Budama kaydı özeti">
        <div class="summary-item">
          <span>Seçilen tarla</span>
          <strong>{{ selectedField?.name ?? 'Seçilmedi' }}</strong>
        </div>
        <div class="summary-item">
          <span>Parsel</span>
          <strong>{{ selectedField?.parcelNo ?? 'Eksik' }}</strong>
        </div>
        <div class="summary-item">
          <span>Toplam alan</span>
          <strong>{{ selectedField ? formatArea(selectedField.area, selectedField.areaUnit) : '-' }}</strong>
        </div>
        <div class="summary-item">
          <span>1/10 hedef</span>
          <strong>{{ selectedField ? formatSquareMeters(targetPruningArea) : '-' }}</strong>
        </div>
      </section>

      <section class="field-selector" aria-label="Ölçüm yapılacak tarla seçimi">
        <AppSelect
          v-model="selectedFieldId"
          :options="fieldOptions"
          label="Ölçüm yapılacak tarla"
          placeholder="Tarla seçin"
          :searchable="true"
          :disabled="fieldsStore.isLoading || !hasFields"
          :helper-text="selectedField ? fieldLocation : 'Budama ölçümü için önce kayıtlı bir tarla seçin.'"
        />
        <div class="selector-state">
          <span v-if="fieldsStore.isLoading">Tarlalar yükleniyor...</span>
          <span v-else-if="fieldsStore.error">{{ fieldsStore.error }}</span>
          <span v-else-if="!hasFields">Kayıtlı tarla bulunamadı. Önce Tarlalarım ekranından tarla ekleyin.</span>
          <span v-else>{{ fieldsStore.fields.length }} kayıtlı tarla arasından seçim yapılıyor.</span>
        </div>
      </section>

      <div class="workbench">
        <section class="map-panel" aria-label="Parsel üzerinde budama alanı">
          <div class="map-toolbar">
            <div>
              <h2>{{ selectedField?.name ?? 'Tarla konumu' }}</h2>
              <p>{{ selectedField ? fieldLocation : 'Tarla seçildiğinde parsel geometrisi burada gösterilir.' }}</p>
            </div>
            <span class="method-pill">{{ selectedMethodLabel }}</span>
          </div>

          <div class="map-canvas" aria-label="Seçilen tarla parsel haritası">
            <svg
              v-if="selectedField && fieldPolygonPoints"
              class="parcel-svg"
              viewBox="0 0 100 100"
              role="img"
              :aria-label="`${selectedField.name} parsel sınırı`"
            >
              <polygon class="parcel-polygon" :points="fieldPolygonPoints" />
            </svg>
            <div v-if="selectedField && fieldPolygonPoints" class="map-empty-note">
              Budanan alan henüz çizilmedi.
            </div>
            <div v-else class="map-empty-note">
              {{ selectedField ? 'Bu tarlada koordinat bilgisi bulunamadı.' : 'Harita için bir tarla seçin.' }}
            </div>
            <span v-if="selectedField" class="parcel-label">{{ selectedField.parcelNo ?? selectedField.name }}</span>
            <span v-if="selectedField" class="area-label">{{ formatArea(selectedField.area, selectedField.areaUnit) }}</span>
            <div class="map-grid" aria-hidden="true"></div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Ölçüm seçenekleri">
          <section class="panel-section">
            <h2>Ölçüm yöntemi</h2>
            <div class="method-list">
              <button
                v-for="method in methods"
                :key="method.id"
                class="method-option"
                :class="{ 'is-selected': selectedMethod === method.id }"
                type="button"
                @click="selectedMethod = method.id"
              >
                <span class="method-badge">{{ method.badge }}</span>
                <strong>{{ method.title }}</strong>
                <span>{{ method.description }}</span>
              </button>
            </div>
          </section>

          <section class="panel-section">
            <h2>Kayıt kontrolü</h2>
            <ul class="checklist">
              <li
                v-for="item in checklist"
                :key="item.label"
                :class="`is-${item.status}`"
              >
                <span class="status-dot" aria-hidden="true"></span>
                <span>{{ item.label }}</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <section class="process-section" aria-label="Personel işlem akışı">
        <h2>Personel işlem akışı</h2>
        <div class="process-list">
          <div class="process-item">
            <span>1</span>
            <p>Personel girişi yapılır, üretici ve ada/parsel seçilir.</p>
          </div>
          <div class="process-item">
            <span>2</span>
            <p>Parsel haritada açılır, açık arazi veya ağaç altı yöntemi belirlenir.</p>
          </div>
          <div class="process-item">
            <span>3</span>
            <p>Budanan alan çizilir ya da GPS noktalarıyla oluşturulur.</p>
          </div>
          <div class="process-item">
            <span>4</span>
            <p>Alan, oran, doğruluk ve önceki kayıt çakışmaları kontrol edilir.</p>
          </div>
          <div class="process-item">
            <span>5</span>
            <p>Fotoğraf, üretici onayı ve personel onayıyla kayıt tamamlanır.</p>
          </div>
        </div>
      </section>
    </div>
  </TeaBusinessLayout>
</template>

<style scoped>
.pruning-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: var(--space-8);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
}

.page-kicker {
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.page-header h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-3xl);
  line-height: var(--line-height-tight);
  text-wrap: balance;
}

.page-intro {
  max-width: 68ch;
  margin-top: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.primary-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-5);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.primary-action:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}

.summary-item {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.summary-item span {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.summary-item strong {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.field-selector {
  display: grid;
  grid-template-columns: minmax(280px, 460px) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: end;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.selector-state {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: var(--space-5);
  align-items: start;
}

.map-panel,
.side-panel,
.process-section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.map-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.map-toolbar h2,
.panel-section h2,
.process-section h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.map-toolbar p {
  margin-top: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.method-pill,
.method-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.map-canvas {
  position: relative;
  min-height: 430px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(21, 128, 61, 0.08), transparent 42%),
    var(--color-bg-tertiary);
}

.map-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.55;
}

.parcel-svg {
  position: absolute;
  inset: 38px 52px;
  z-index: 1;
}

.parcel-polygon {
  fill: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-secondary));
  stroke: var(--color-primary);
  stroke-width: 1.4;
  vector-effect: non-scaling-stroke;
}

.map-empty-note {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  max-width: min(340px, calc(100% - 48px));
  transform: translate(-50%, -50%);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-secondary) 94%, transparent);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.parcel-label,
.area-label {
  position: absolute;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-sm);
}

.parcel-label {
  right: var(--space-5);
  top: var(--space-5);
}

.area-label {
  left: var(--space-5);
  bottom: var(--space-5);
}

.side-panel {
  display: flex;
  flex-direction: column;
}

.panel-section {
  padding: var(--space-5);
}

.panel-section + .panel-section {
  border-top: 1px solid var(--color-border);
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.method-option {
  display: flex;
  min-height: 116px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  text-align: left;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.method-option:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-strong);
}

.method-option.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.method-option strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.method-option span:last-child {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.checklist li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.status-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex: 0 0 auto;
}

.checklist li.is-done .status-dot {
  background: var(--color-success);
}

.checklist li.is-warning .status-dot {
  background: var(--color-warning);
}

.checklist li.is-pending .status-dot {
  background: var(--color-border-strong);
}

.process-section {
  padding: var(--space-5);
}

.process-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.process-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 150px;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-tertiary);
}

.process-item span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.process-item p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

@media (max-width: 1180px) {
  .process-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .workbench {
    grid-template-columns: 1fr;
  }

  .field-selector {
    grid-template-columns: 1fr;
  }

  .map-canvas {
    min-height: 360px;
  }
}

@media (max-width: 768px) {
  .pruning-page {
    padding: var(--space-5) var(--space-4);
  }

  .page-header {
    flex-direction: column;
  }

  .primary-action {
    width: 100%;
  }

  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .map-toolbar {
    flex-direction: column;
  }

  .map-canvas {
    min-height: 300px;
  }

  .parcel-svg {
    inset: 28px 18px;
  }

  .process-list {
    grid-template-columns: 1fr;
  }

  .process-item {
    min-height: auto;
  }
}

@media (max-width: 420px) {
  .summary-strip {
    grid-template-columns: 1fr;
  }
}
</style>
