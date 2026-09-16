export interface IRAMRWeights {
    taskCapability: number;
    hardwareFit: number;
    resourceAvailability: number;
}

export const IRAMR_DEFAULT_WEIGHTS: IRAMRWeights = {
    taskCapability: 0.55,
    hardwareFit: 0.30,
    resourceAvailability: 0.15
};

export type HardwareFitLevel = "Excellent" | "Good" | "Limited" | "Unsupported";

export interface ToolRequirements {
    ocr: boolean;
    rag: boolean;
    vision: boolean;
}

export interface ModelAlternativeScore {
    modelId: string;
    modelName: string;
    taskCapabilityScore: number;
    hardwareFitScore: number;
    resourceAvailabilityScore: number;
    finalScore: number;
    hardwareFit: string;
}

export interface IRAMRResult {
    selectedModelId: string;
    selectedModelName: string;

    taskType: string;
    complexity: string;

    taskCapabilityScore: number;
    hardwareFitScore: number;
    resourceAvailabilityScore: number;

    finalScore: number;

    hardwareFit: HardwareFitLevel;

    reason: string;

    toolRequirements: ToolRequirements;

    alternatives: ModelAlternativeScore[];
}
