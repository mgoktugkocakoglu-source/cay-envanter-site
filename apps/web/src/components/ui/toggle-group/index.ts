import type { Ref } from 'vue';
import type { ToggleVariants } from '@/components/ui/toggle';

export { default as ToggleGroup } from './ToggleGroup.vue';
export { default as ToggleGroupItem } from './ToggleGroupItem.vue';

export interface ToggleGroupContext {
    variant: Ref<ToggleVariants['variant']>;
    size: Ref<ToggleVariants['size']>;
}
