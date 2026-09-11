<script setup lang="ts">
import { computed, ref } from 'vue';
import { UserRound } from '@lucide/vue';
import CaykurPruningMeasure from '@/components/caykur/CaykurPruningMeasure.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { MeasurementPoint, PruningCoOwner } from '@/services/api';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';

/**
 * Ruhsatlandırma ölçümü: on a hisseli parcel the authorized person picks
 * which registered owner's slice is being measured, then captures it with the
 * same map / laser+IMU techniques as the pruning measurement.
 */
const props = defineProps<{
    /** Registered owners of the parcel (from the request's coOwners). */
    owners: PruningCoOwner[];
    /** [lng, lat] ring to outline the cadastral parcel on the map. */
    parcelPolygon?: number[][];
    /** Owners who already have a measurement on this request (shown as a hint). */
    measuredOwnerIds?: string[];
    busy?: boolean;
}>();

const emit = defineEmits<{
    (e: 'complete', result: {
        ownerId: string;
        notes?: string;
        measuredAreaM2: number;
        points: MeasurementPoint[];
        accuracyLevel: AccuracyLevel | null;
        method: MeasurementMethod;
    }): void;
    (e: 'cancel'): void;
}>();

const ownerId = ref('');
const notes = ref('');

const selectedOwner = computed(() => props.owners.find((o) => o.userId === ownerId.value) ?? null);
const alreadyMeasured = computed(() => !!ownerId.value && (props.measuredOwnerIds ?? []).includes(ownerId.value));

function ownerLabel(o: PruningCoOwner): string {
    return o.cuzdanNo ? `${o.fullName} · Cüzdan ${o.cuzdanNo}` : o.fullName;
}
function formatNumber(n: number): string {
    return Math.round(n).toLocaleString('tr-TR');
}

function onMeasured(result: {
    measuredAreaM2: number;
    points: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    method: MeasurementMethod;
}): void {
    if (!ownerId.value) return;
    emit('complete', {
        ownerId: ownerId.value,
        notes: notes.value.trim() || undefined,
        ...result,
    });
}
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
                <Label for="licensing-owner">Ölçülen sahip</Label>
                <Select v-model="ownerId">
                    <SelectTrigger id="licensing-owner" class="h-11 w-full md:h-9" aria-label="Ölçülen sahibi seçin">
                        <SelectValue placeholder="Sistemdeki kayıtlı sahiplerden seçin" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="o in props.owners" :key="o.userId" :value="o.userId">
                            {{ ownerLabel(o) }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">
                    Bu ada/parseli sisteme kaydetmiş kişiler listelenir. Ölçüm, seçilen kişinin payı olarak kaydedilir.
                </p>
            </div>

            <div class="space-y-2">
                <Label for="licensing-notes">Not (isteğe bağlı)</Label>
                <Textarea id="licensing-notes" v-model="notes" rows="3" placeholder="Örn. batı sınırı yol kenarındaki taş duvar" />
            </div>
        </div>

        <div v-if="selectedOwner" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <UserRound class="size-4 text-muted-foreground" aria-hidden="true" />
            <span class="font-medium text-foreground">{{ selectedOwner.fullName }}</span>
            <Badge v-if="selectedOwner.cuzdanNo" variant="secondary">Cüzdan {{ selectedOwner.cuzdanNo }}</Badge>
            <Badge v-if="selectedOwner.ruhsatNo" variant="outline">Ruhsat {{ selectedOwner.ruhsatNo }}</Badge>
            <span class="text-muted-foreground">Beyan ettiği alan: <strong class="text-foreground tabular-nums">{{ formatNumber(selectedOwner.areaM2) }} m²</strong></span>
        </div>

        <Alert v-if="alreadyMeasured" variant="warning">
            <AlertTitle>Bu sahip için daha önce ölçüm kaydedildi</AlertTitle>
            <AlertDescription>Yeni bir ölçüm kaydederseniz diğer sahiplere yeniden onay talebi gönderilir.</AlertDescription>
        </Alert>

        <Alert v-if="!ownerId" variant="info">
            <AlertTitle>Önce sahibi seçin</AlertTitle>
            <AlertDescription>Ölçüm araçları, ölçülen sahip seçildikten sonra açılır.</AlertDescription>
        </Alert>

        <CaykurPruningMeasure
            v-else
            :parcel-polygon="props.parcelPolygon"
            @complete="onMeasured"
            @cancel="emit('cancel')"
        />

        <div v-if="!ownerId" class="flex justify-end">
            <Button variant="outline" class="h-11 md:h-9" :disabled="props.busy" @click="emit('cancel')">Vazgeç</Button>
        </div>
    </div>
</template>
