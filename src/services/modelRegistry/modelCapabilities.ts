import type { ModelCapabilityProfile } from './modelTypes';

/**
 * Locked Model Registry containing the exactly allowed local models:
 * 1. TinyLlama/TinyLlama-1.1B-Chat-v1.0
 * 2. Qwen/Qwen2.5-1.5B-Instruct
 * 
 * Note: These capability scores are initial prototype baselines (0-100)
 * structured cleanly to allow future updates from empirical benchmark runs.
 */
export const MODEL_CAPABILITY_PROFILES: ModelCapabilityProfile[] = [
    {
        modelId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        modelName: "TinyLlama 1.1B",
        parameterClass: "1.1B",
        capabilities: {
            questionAnswering: 75,
            summarization: 72,
            coding: 55,
            codeDebugging: 50,
            translation: 60,
            dataAnalysis: 45,
            informationExtraction: 65,
            documentAnalysis: 55,
            reasoning: 50,
            structuredGeneration: 60
        },
        resourceRequirements: {
            estimatedRamGB: 2.0,
            estimatedVramGB: 1.5
        },
        strengths: [
            "Ultra-lightweight footprint",
            "Fast CPU-only execution",
            "Low RAM/VRAM consumption",
            "General Q&A and short summarization"
        ]
    },
    {
        modelId: "Qwen/Qwen2.5-1.5B-Instruct",
        modelName: "Qwen2.5 1.5B",
        parameterClass: "1.5B",
        capabilities: {
            questionAnswering: 85,
            summarization: 80,
            coding: 80,
            codeDebugging: 75,
            translation: 75,
            dataAnalysis: 60,
            informationExtraction: 78,
            documentAnalysis: 72,
            reasoning: 78,
            structuredGeneration: 82
        },
        resourceRequirements: {
            estimatedRamGB: 3.0,
            estimatedVramGB: 2.0
        },
        strengths: [
            "Strong code generation and debugging",
            "Superior multi-step reasoning",
            "Structured JSON/Markdown output",
            "High-accuracy document analysis"
        ]
    }
];

export function getModelProfiles(): ModelCapabilityProfile[] {
    return MODEL_CAPABILITY_PROFILES;
}

export function getModelProfileById(modelId: string): ModelCapabilityProfile | undefined {
    return MODEL_CAPABILITY_PROFILES.find(m => m.modelId === modelId);
}
