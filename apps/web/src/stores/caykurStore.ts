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

/**
 * Çaykur command-center store.
 *
 * Currently sourced from the local demo dataset (caykurData). This is the
 * single seam to swap for real API aggregation endpoints later: replace the
 * `producers` initializer with a fetch and keep the computed getters intact.
 */
export const useCaykurStore = defineStore('caykur', () => {
    const producers = ref<Producer[]>(PRODUCERS);
    const season = ref(SEASON_LABEL);

    const overview = computed(() => buildOverview(producers.value));
    const flagged = computed(() => flaggedProducers(producers.value));

    function producerById(id: string): Producer | undefined {
        return getProducer(id);
    }

    return { producers, season, overview, flagged, producerById };
});
