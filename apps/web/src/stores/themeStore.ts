import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'cayhesabim-theme';

function getInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'light';
}

/**
 * Applies the theme to <html>.
 * - `data-theme` keeps legacy attribute selectors working (see tailwind.css dark variant).
 * - the `dark` class drives Tailwind / shadcn-vue `dark:` utilities.
 * Both are kept in sync so legacy and new components agree.
 */
function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
}

export const useThemeStore = defineStore('theme', () => {
    const theme = ref<Theme>(getInitialTheme());

    function setTheme(newTheme: Theme) {
        theme.value = newTheme;
    }

    function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
    }

    function initialize() {
        applyTheme(theme.value);
    }

    watch(theme, (newTheme) => {
        localStorage.setItem(STORAGE_KEY, newTheme);
        applyTheme(newTheme);
    });

    return {
        theme,
        setTheme,
        toggleTheme,
        initialize,
    };
});
