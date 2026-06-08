import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    PRODUCERS,
    SEASON_LABEL,
    buildOverview,
    flaggedProducers,
    getProducer,
    type Producer,
} from '@/services/caykurData';
import {
    PERSONAS,
    personaForRole,
    canAccess,
    roleDef,
    type CaykurRole,
    type ModuleKey,
    type Persona,
} from '@/services/caykur/roles';
import { opsSnapshot } from '@/services/caykur';

/**
 * Çaykur command-center store.
 *
 * Sourced from the local deterministic demo dataset (services/caykur). This is
 * the single seam to swap for real API aggregation endpoints later: replace the
 * initializers with fetches and keep the computed getters intact.
 *
 * Also holds the demo *persona* — the current institutional role — which gates
 * the panel navigation and page access (Faz 1). Swapping persona lets a pitch
 * walk through each role's view without re-authenticating.
 */
export const useCaykurStore = defineStore('caykur', () => {
    const producers = ref<Producer[]>(PRODUCERS);
    const season = ref(SEASON_LABEL);

    const overview = computed(() => buildOverview(producers.value));
    const flagged = computed(() => flaggedProducers(producers.value));
    const ops = computed(() => opsSnapshot());

    function producerById(id: string): Producer | undefined {
        return getProducer(id);
    }

    // ── Persona / role-based access (Faz 1) ──
    const role = ref<CaykurRole>('kurum_admin');
    const persona = computed<Persona>(() => personaForRole(role.value));
    const personas = ref<Persona[]>(PERSONAS);

    function setRole(next: CaykurRole): void {
        role.value = next;
    }

    function can(moduleKey: ModuleKey): boolean {
        return canAccess(role.value, moduleKey);
    }

    const currentRoleDef = computed(() => roleDef(role.value));

    return {
        producers,
        season,
        overview,
        flagged,
        ops,
        producerById,
        // persona / access
        role,
        persona,
        personas,
        currentRoleDef,
        setRole,
        can,
    };
});
