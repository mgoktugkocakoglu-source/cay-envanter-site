import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    SEASON_LABEL,
    buildOverview,
    flaggedProducers,
    type Producer,
} from '@/services/caykurData';
import { api } from '@/services/api';
import {
    PERSONAS,
    personaForRole,
    canAccess,
    roleDef,
    type CaykurRole,
    type ModuleKey,
    type Persona,
} from '@/services/caykur/roles';
import { useAuthStore } from '@/stores/authStore';

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
    // Producer registry — loaded from the database (no mock data).
    const producers = ref<Producer[]>([]);
    const producersLoaded = ref(false);
    const producersLoading = ref(false);
    const season = ref(SEASON_LABEL);

    const overview = computed(() => buildOverview(producers.value));
    const flagged = computed(() => flaggedProducers(producers.value));

    async function loadProducers(force = false): Promise<void> {
        if (producersLoading.value || (producersLoaded.value && !force)) {
            return;
        }
        producersLoading.value = true;
        try {
            const res = await api.getCaykurPanelProducers();
            if (res.data) {
                producers.value = res.data as unknown as Producer[];
                producersLoaded.value = true;
            }
        } finally {
            producersLoading.value = false;
        }
    }

    // Kick off the initial load when the store is first used (panel mount).
    void loadProducers();

    function producerById(id: string): Producer | undefined {
        return producers.value.find((p) => p.id === id);
    }

    // ── Persona / role-based access ──
    // The active role is the authenticated user's real caykurRole. Admins may
    // override it to demo "what each persona sees" without re-authenticating;
    // real staff are locked to their assigned role.
    const auth = useAuthStore();
    const demoOverride = ref<CaykurRole | null>(null);
    const canSwitchPersona = computed(() => auth.user?.role === 'admin');

    const role = computed<CaykurRole>(() => {
        if (canSwitchPersona.value && demoOverride.value) {
            return demoOverride.value;
        }
        return (auth.user?.caykurRole as CaykurRole | undefined) ?? 'kurum_admin';
    });
    const persona = computed<Persona>(() => personaForRole(role.value));
    const personas = ref<Persona[]>(PERSONAS);

    function setRole(next: CaykurRole): void {
        // Only admins can switch personas (demo); ignored for real staff.
        if (canSwitchPersona.value) {
            demoOverride.value = next;
        }
    }

    function can(moduleKey: ModuleKey): boolean {
        return canAccess(role.value, moduleKey);
    }

    const currentRoleDef = computed(() => roleDef(role.value));

    return {
        producers,
        producersLoaded,
        producersLoading,
        loadProducers,
        season,
        overview,
        flagged,
        producerById,
        // persona / access
        role,
        persona,
        personas,
        currentRoleDef,
        canSwitchPersona,
        setRole,
        can,
    };
});
