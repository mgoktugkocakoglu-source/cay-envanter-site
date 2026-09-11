<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Calendar, CircleAlert, FileText, LandPlot, Map, MapPin, Square, Users } from '@lucide/vue';
import { useFieldsStore } from '@/stores/fieldsStore';
import type { FieldPartner } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { EmptyState, LoadingState, PageContainer, PageHeader, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const route = useRoute();
const router = useRouter();
const fieldsStore = useFieldsStore();

// Map state
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let fieldLayer: L.GeoJSON | null = null;

// Get field ID from route
const fieldId = computed(() => route.params.id as string);

const fieldDisplayName = computed(() => fieldsStore.currentField?.name?.trim() || 'İsimsiz Arazi');

// Load field data
onMounted(async () => {
    await fieldsStore.fetchField(fieldId.value);
    await nextTick();
    initializeMap();
});

onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
    }
});

function initializeMap() {
    if (!mapContainer.value) return;

    map = L.map(mapContainer.value, {
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        zoomControl: false,
        attributionControl: false,
        boxZoom: false,
        keyboard: false,
        dragging: true,
    }).setView([39.0, 35.0], 6);

    // Satellite imagery tile layer (Google Satellite — sharper, free, no API key)
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Display field coordinates if available
    const field = fieldsStore.currentField;
    if (field && field.coordinates && field.coordinates.length > 0) {
        displayFieldOnMap(field.coordinates);
    }
}

function getCssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function displayFieldOnMap(coordinates: number[][][]) {
    if (!map) return;

    const geoJson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: coordinates,
        },
    };

    fieldLayer = L.geoJSON(geoJson, {
        style: {
            color: getCssVar('--primary', '#059669'),
            weight: 3,
            fillOpacity: 0.2,
            fillColor: getCssVar('--primary', '#10b981'),
        },
    }).addTo(map);

    // Zoom to field bounds
    map.fitBounds(fieldLayer.getBounds(), { padding: [50, 50] });
}

function formatArea(area: number, unit: string) {
    const formatted = area.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const unitLabels: Record<string, string> = {
        donum: 'dönüm',
        dekar: 'dekar',
        m2: 'm²',
    };
    return `${formatted} ${unitLabels[unit] || unit}`;
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function partnerStatusLabel(partner: FieldPartner): string {
    if (partner.invitationStatus === 'accepted') return 'Onaylandı';
    if (partner.invitationStatus === 'rejected') return 'Reddedildi';
    return 'Onay Bekliyor';
}

function partnerStatusVariant(partner: FieldPartner): 'success' | 'danger' | 'warning' {
    if (partner.invitationStatus === 'accepted') return 'success';
    if (partner.invitationStatus === 'rejected') return 'danger';
    return 'warning';
}

function goBack() {
    router.push('/tea/fields');
}
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <LoadingState v-if="fieldsStore.isLoading" text="Arazi bilgileri yükleniyor..." />

            <EmptyState v-else-if="fieldsStore.error" :icon="CircleAlert" title="Bir hata oluştu" :description="fieldsStore.error">
                <Button variant="outline" class="h-11 md:h-9" @click="goBack">
                    <ArrowLeft aria-hidden="true" />
                    Geri Dön
                </Button>
            </EmptyState>

            <template v-else-if="fieldsStore.currentField">
                <PageHeader
                    :title="fieldDisplayName"
                    :description="`${fieldsStore.currentField.province}, ${fieldsStore.currentField.district}`"
                    back-to="/tea/fields"
                    back-label="Araziler"
                >
                    <template #meta>
                        <Badge v-if="fieldsStore.currentField.area" variant="secondary">
                            {{ formatArea(fieldsStore.currentField.area, fieldsStore.currentField.areaUnit) }}
                        </Badge>
                        <Badge v-if="fieldsStore.currentField.adaNo || fieldsStore.currentField.parcelNo" variant="outline">
                            Ada {{ fieldsStore.currentField.adaNo || '—' }} / Parsel {{ fieldsStore.currentField.parcelNo || '—' }}
                        </Badge>
                        <Badge v-if="fieldsStore.currentField.partners?.length" variant="outline">
                            <Users aria-hidden="true" />
                            {{ fieldsStore.currentField.partners.length }} ortak
                        </Badge>
                    </template>
                </PageHeader>

                <!-- Map -->
                <Card class="gap-0 overflow-hidden py-0">
                    <div ref="mapContainer" class="relative z-0 h-70 w-full md:h-96" role="img" :aria-label="`${fieldDisplayName} arazisinin uydu haritası`"></div>
                </Card>

                <!-- Stats -->
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Toplam Alan" :value="formatArea(fieldsStore.currentField.area, fieldsStore.currentField.areaUnit)" :icon="Square" />
                    <StatCard v-if="fieldsStore.currentField.partners?.length" label="Ortak Sayısı" :value="fieldsStore.currentField.partners.length" :icon="Users" />
                    <StatCard
                        v-if="fieldsStore.currentField.adaNo || fieldsStore.currentField.parcelNo"
                        label="Ada / Parsel No"
                        :value="`${fieldsStore.currentField.adaNo || '—'} / ${fieldsStore.currentField.parcelNo || '—'}`"
                        :icon="LandPlot"
                    />
                    <StatCard label="Kayıt Tarihi" :value="formatDate(fieldsStore.currentField.createdAt)" :icon="Calendar" class="[&_p:first-of-type]:text-lg" />
                </div>

                <!-- Detail cards -->
                <div class="grid gap-4 md:grid-cols-2">
                    <!-- Location -->
                    <Card>
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <MapPin class="size-4 text-muted-foreground" aria-hidden="true" />
                                Konum Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                <div>
                                    <dt class="text-muted-foreground">İl</dt>
                                    <dd class="font-medium text-foreground">{{ fieldsStore.currentField.province }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">İlçe</dt>
                                    <dd class="font-medium text-foreground">{{ fieldsStore.currentField.district }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">Mahalle</dt>
                                    <dd class="font-medium text-foreground">{{ fieldsStore.currentField.neighborhood || '—' }}</dd>
                                </div>
                                <div v-if="fieldsStore.currentField.road">
                                    <dt class="text-muted-foreground">Yol</dt>
                                    <dd class="font-medium text-foreground">{{ fieldsStore.currentField.road }}</dd>
                                </div>
                                <div v-if="fieldsStore.currentField.adaNo">
                                    <dt class="text-muted-foreground">Ada No</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ fieldsStore.currentField.adaNo }}</dd>
                                </div>
                                <div v-if="fieldsStore.currentField.parcelNo">
                                    <dt class="text-muted-foreground">Parsel No</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ fieldsStore.currentField.parcelNo }}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <!-- Record metadata -->
                    <Card>
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <Calendar class="size-4 text-muted-foreground" aria-hidden="true" />
                                Kayıt Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                <div>
                                    <dt class="text-muted-foreground">Oluşturulma</dt>
                                    <dd class="font-medium text-foreground">{{ formatDate(fieldsStore.currentField.createdAt) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">Son Güncelleme</dt>
                                    <dd class="font-medium text-foreground">{{ formatDate(fieldsStore.currentField.updatedAt) }}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <!-- Notes -->
                    <Card v-if="fieldsStore.currentField.notes">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <FileText class="size-4 text-muted-foreground" aria-hidden="true" />
                                Notlar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p class="text-sm leading-relaxed whitespace-pre-line text-foreground">{{ fieldsStore.currentField.notes }}</p>
                        </CardContent>
                    </Card>

                    <!-- Partners -->
                    <Card v-if="fieldsStore.currentField.partners && fieldsStore.currentField.partners.length > 0" class="gap-4 overflow-hidden pb-0 md:col-span-2">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <Users class="size-4 text-muted-foreground" aria-hidden="true" />
                                Ortaklar
                            </CardTitle>
                        </CardHeader>
                        <div class="border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow class="hover:bg-transparent">
                                        <TableHead class="pl-5">Ortak</TableHead>
                                        <TableHead class="hidden md:table-cell">İletişim</TableHead>
                                        <TableHead class="hidden md:table-cell">Durum</TableHead>
                                        <TableHead class="pr-5 text-right">Pay</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="partner in fieldsStore.currentField.partners" :key="partner.id">
                                        <TableCell class="pl-5">
                                            <div class="flex items-center gap-3">
                                                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">
                                                    {{ partner.partnerName.charAt(0).toUpperCase() }}
                                                </span>
                                                <div class="min-w-0">
                                                    <span class="block truncate font-medium text-foreground">{{ partner.partnerName }}</span>
                                                    <span v-if="partner.partnerPhone" class="block text-xs text-muted-foreground md:hidden">{{ partner.partnerPhone }}</span>
                                                    <Badge :variant="partnerStatusVariant(partner)" class="mt-1 md:hidden">{{ partnerStatusLabel(partner) }}</Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell class="hidden md:table-cell">
                                            <span class="block text-foreground">{{ partner.partnerPhone || '—' }}</span>
                                            <span v-if="partner.partnerIdentityNumber" class="block text-xs text-muted-foreground">TC: {{ partner.partnerIdentityNumber }}</span>
                                        </TableCell>
                                        <TableCell class="hidden md:table-cell">
                                            <Badge :variant="partnerStatusVariant(partner)">{{ partnerStatusLabel(partner) }}</Badge>
                                        </TableCell>
                                        <TableCell class="pr-5 text-right">
                                            <div class="flex items-center justify-end gap-3">
                                                <Progress :model-value="partner.sharePercentage" class="hidden w-16 md:block" :aria-label="`${partner.partnerName} payı`" />
                                                <span class="font-semibold text-foreground tabular-nums">%{{ partner.sharePercentage }}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </template>
            <EmptyState v-else :icon="MapPin" title="Arazi bulunamadı" description="Bu arazi silinmiş veya size ait olmayabilir.">
                <Button variant="outline" class="h-11 md:h-9" @click="goBack">Arazilerime dön</Button>
            </EmptyState>
        </PageContainer>
    </TeaBusinessLayout>
</template>
