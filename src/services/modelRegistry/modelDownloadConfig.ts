export interface ModelDownloadInfo {
    modelId: string;
    ggufRepo: string;
    ggufFilename: string;
    estimatedSizeGB: number;
}

export const MODEL_DOWNLOAD_CONFIG: ModelDownloadInfo[] = [
    {
        modelId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        ggufRepo: "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
        ggufFilename: "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        estimatedSizeGB: 0.67,
    },
    {
        modelId: "Qwen/Qwen2.5-1.5B-Instruct",
        ggufRepo: "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
        ggufFilename: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        estimatedSizeGB: 1.0,
    }
];

export function getDownloadConfig(modelId: string): ModelDownloadInfo | undefined {
    return MODEL_DOWNLOAD_CONFIG.find(m => m.modelId === modelId);
}
