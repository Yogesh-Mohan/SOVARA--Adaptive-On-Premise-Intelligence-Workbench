import type { RuntimeConfig } from './runtimeTypes';

const STORE_KEY = 'sovereign_ai_runtime_configs';

export function getLockedConfig(modelId: string): RuntimeConfig | null {
    try {
        const stored = localStorage.getItem(STORE_KEY);
        if (!stored) return null;
        
        const configs: Record<string, RuntimeConfig> = JSON.parse(stored);
        return configs[modelId] || null;
    } catch (e) {
        console.error("Failed to read runtime config from local storage", e);
        return null;
    }
}

export function saveLockedConfig(config: RuntimeConfig) {
    try {
        const stored = localStorage.getItem(STORE_KEY);
        const configs: Record<string, RuntimeConfig> = stored ? JSON.parse(stored) : {};
        
        configs[config.modelId] = config;
        localStorage.setItem(STORE_KEY, JSON.stringify(configs));
    } catch (e) {
        console.error("Failed to save runtime config to local storage", e);
    }
}

export function removeLockedConfig(modelId: string) {
    try {
        const stored = localStorage.getItem(STORE_KEY);
        if (!stored) return;
        
        const configs: Record<string, RuntimeConfig> = JSON.parse(stored);
        delete configs[modelId];
        localStorage.setItem(STORE_KEY, JSON.stringify(configs));
    } catch (e) {
        console.error("Failed to remove runtime config from local storage", e);
    }
}
