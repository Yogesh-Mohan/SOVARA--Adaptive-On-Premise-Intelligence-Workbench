import { invoke } from '@tauri-apps/api/core';
import type { RuntimeDetectionResult, BenchmarkResult, RuntimeConfig, RuntimeState } from './runtimeTypes';
import { getLockedConfig, saveLockedConfig } from './runtimeStore';

class RuntimeManager {
    private state: RuntimeState = {
        isReady: false,
        cudaAvailable: false,
        activeConfig: null,
        status: 'Ready',
        errorMsg: null,
        currentSpeed: null
    };

    private listeners: ((state: RuntimeState) => void)[] = [];

    private notify() {
        this.listeners.forEach(l => l({ ...this.state }));
    }

    public subscribe(listener: (state: RuntimeState) => void) {
        this.listeners.push(listener);
        listener({ ...this.state });
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public getState(): RuntimeState {
        return { ...this.state };
    }

    public updateStatus(status: RuntimeState['status'], currentSpeed: number | null = null) {
        this.state.status = status;
        this.state.currentSpeed = currentSpeed;
        this.notify();
    }

    public async initialize() {
        try {
            const result: RuntimeDetectionResult = await invoke('detect_runtime');
            this.state.isReady = !!result.cli_path && !!result.server_path;
            this.state.cudaAvailable = result.cuda_available;
            this.notify();
        } catch (e) {
            console.error("Failed to detect runtime", e);
            this.state.isReady = false;
            this.notify();
        }
    }

    public async prepareModelRuntime(modelId: string): Promise<RuntimeConfig | null> {
        let config = getLockedConfig(modelId);
        
        if (!config) {
            console.log(`No locked configuration for ${modelId}, starting benchmark...`);
            config = await this.runBenchmarkSuite(modelId);
            if (config) {
                saveLockedConfig(config);
            }
        }
        
        if (config) {
            this.state.activeConfig = config;
            this.state.status = 'Ready';
            this.state.errorMsg = null;
            this.notify();
        }

        return config;
    }

    public async forceBenchmark(modelId: string): Promise<RuntimeConfig | null> {
        const config = await this.runBenchmarkSuite(modelId);
        if (config) {
            saveLockedConfig(config);
            this.state.activeConfig = config;
            this.notify();
        }
        return config;
    }

    private async runBenchmarkSuite(modelId: string): Promise<RuntimeConfig | null> {
        this.state.status = 'Loading';
        this.notify();

        try {
            const variants: string[] = await invoke('scan_local_models', { modelId });
            
            if (variants.length === 0) {
                this.state.status = 'Error';
                this.state.errorMsg = `No GGUF models found in models/${modelId}`;
                this.notify();
                return null;
            }

            // Test variants starting from largest/highest quality usually if available,
            // but for simplicity we'll just evaluate them and pick the first one that successfully loads
            // and performs best. 
            // In a real app we might sort variants by name Q8 -> Q2
            
            let bestConfig: RuntimeConfig | null = null;
            let bestScore = -1;
            const variantErrors: Record<string, string> = {};

            for (const variant of variants) {
                // Test GPU first if CUDA available
                const nglToTest = this.state.cudaAvailable ? [999, 0] : [0];
                
                for (const ngl of nglToTest) {
                    console.log(`Benchmarking ${variant} with ngl=${ngl}`);
                    try {
                        const result: BenchmarkResult = await invoke('run_benchmark', { 
                            modelId, 
                            variant, 
                            ngl 
                        });

                        if (result.load_success) {
                            // Can proceed without generation speed if it loaded
                            const score = result.generation_speed || 1.0;
                            if (score > bestScore) {
                                bestScore = score;
                                bestConfig = {
                                    modelId,
                                    selectedVariant: variant,
                                    gpuOffloadLayers: ngl,
                                    promptSpeed: result.prompt_speed,
                                    generationSpeed: result.generation_speed
                                };
                            }
                            
                            // If GPU succeeds and gives acceptable speed, break early
                            if (ngl > 0 && score > 5.0) {
                                break;
                            }
                        } else {
                            variantErrors[variant] = result.error_msg || "CPU_INFERENCE_FAILED";
                        }
                    } catch (e: any) {
                        console.warn(`Benchmark failed for ${variant} with ngl=${ngl}`, e);
                        variantErrors[variant] = typeof e === 'string' ? e : (e.message || "PROCESS_EXECUTION_FAILED");
                    }
                }
            }

            if (!bestConfig) {
                this.state.status = 'Error';
                const errorReasons = Object.entries(variantErrors).map(([v, e]) => `${v}: ${e}`).join(', ');
                this.state.errorMsg = errorReasons.length > 0 ? errorReasons : 'No variants could be loaded successfully. They might be corrupted.';
                this.notify();
                return null;
            }

            this.state.status = 'Ready';
            this.state.errorMsg = null;
            this.notify();
            return bestConfig;

        } catch (e: any) {
            this.state.status = 'Error';
            this.state.errorMsg = `Benchmark suite failed: ${e.message || e}`;
            this.notify();
            return null;
        }
    }
}

export const runtimeManager = new RuntimeManager();
