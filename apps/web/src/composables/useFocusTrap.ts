import { watch, onScopeDispose, type Ref } from 'vue';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Keep keyboard focus inside `containerRef` while `active` is true, and restore
 * focus to the previously focused element when it turns false.
 *
 * Pairs with a modal that already moves focus into the container on open
 * (e.g. a `watch(show, () => container.focus())`); this adds the Tab/Shift+Tab
 * cycling so keyboard and screen-reader users can't tab out to the page behind.
 */
export function useFocusTrap(active: Ref<boolean>, containerRef: Ref<HTMLElement | null>) {
    let previouslyFocused: HTMLElement | null = null;

    function onKeydown(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;
        const container = containerRef.value;
        if (!container) return;

        const focusable = Array.from(
            container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.getClientRects().length > 0);

        // Nothing focusable inside: keep focus on the container itself.
        if (focusable.length === 0) {
            e.preventDefault();
            container.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
            if (current === first || current === container || !container.contains(current)) {
                e.preventDefault();
                last.focus();
            }
        } else if (current === last || !container.contains(current)) {
            e.preventDefault();
            first.focus();
        }
    }

    watch(active, (val) => {
        if (val) {
            previouslyFocused = document.activeElement as HTMLElement | null;
            document.addEventListener('keydown', onKeydown, true);
        } else {
            document.removeEventListener('keydown', onKeydown, true);
            previouslyFocused?.focus?.();
            previouslyFocused = null;
        }
    });

    onScopeDispose(() => {
        document.removeEventListener('keydown', onKeydown, true);
    });
}
