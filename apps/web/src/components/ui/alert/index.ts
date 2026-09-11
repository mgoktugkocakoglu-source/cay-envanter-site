import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

export { default as Alert } from './Alert.vue';
export { default as AlertDescription } from './AlertDescription.vue';
export { default as AlertTitle } from './AlertTitle.vue';

export const alertVariants = cva(
    'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
    {
        variants: {
            variant: {
                default: 'bg-card text-card-foreground',
                destructive: 'border-destructive/40 bg-destructive/5 text-destructive *:data-[slot=alert-description]:text-destructive/90',
                success: 'border-success/40 bg-success/5 text-success *:data-[slot=alert-description]:text-success/90',
                warning: 'border-warning/40 bg-warning/5 text-warning *:data-[slot=alert-description]:text-warning/90',
                info: 'border-info/40 bg-info/5 text-info *:data-[slot=alert-description]:text-info/90',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
