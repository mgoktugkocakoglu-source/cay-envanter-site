import { computed } from 'vue';
import { PRODUCERS, kotaUsagePct, type Producer } from '@/services/caykur';

/**
 * The demo "logged-in producer" for the Çaykur pitch surfaces (producer portal
 * and the producer pruning page). Deterministically picks a producer with a
 * healthy, complete story so screenshots stay stable. Shared so a request
 * created on one surface ties to the same müstahsil everywhere.
 */
export function useDemoProducer() {
    const producer = computed<Producer>(() => {
        const healthy = PRODUCERS.find((p) => {
            const u = kotaUsagePct(p);
            return u >= 70 && u <= 96;
        });
        return healthy ?? PRODUCERS[0];
    });

    return { producer };
}
