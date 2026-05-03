import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.cayhesabim.app',
    appName: 'Çay Hesabım',
    webDir: 'dist',
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#f8f9fa',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
        },
        StatusBar: {
            style: 'DEFAULT',
            backgroundColor: '#16a34a',
        },
        Keyboard: {
            resize: 'body',
            style: 'DARK',
            resizeOnFullScreen: true,
        },
    },
    ios: {
        contentInset: 'always',
        backgroundColor: '#16a34a',
        overrideUserInterfaceStyle: 'automatic',
        scrollEnabled: true,
        limitsNavigationsToAppBoundDomains: false,
        preferredContentMode: 'mobile',
        handleApplicationNotifications: true,
        webContentsDebuggingEnabled: false,
    },
    android: {
        backgroundColor: '#16a34a',
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false,
    },
};

export default config;
