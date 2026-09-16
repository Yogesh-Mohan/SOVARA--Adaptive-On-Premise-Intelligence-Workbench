export interface RuntimeDetectionResult {
    cli_path: string | null;
    server_path: string | null;
    cuda_available: boolean;
}

export interface BenchmarkResult {
    load_success: boolean;
    prompt_speed: number | null;
    generation_speed: number | null;
    error_msg: string | null;
}

export interface RuntimeConfig {
    modelId: string;
    selectedVariant: string;
    gpuOffloadLayers: number;
    promptSpeed: number | null;
    generationSpeed: number | null;
}

export interface RuntimeState {
    isReady: boolean;
    cudaAvailable: boolean;
    activeConfig: RuntimeConfig | null;
    status: 'Ready' | 'Loading' | 'Generating' | 'Error';
    errorMsg: string | null;
    currentSpeed: number | null;
}
