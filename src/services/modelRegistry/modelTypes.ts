export interface CapabilityScores {
    questionAnswering: number;
    summarization: number;
    coding: number;
    codeDebugging: number;
    translation: number;
    dataAnalysis: number;
    informationExtraction: number;
    documentAnalysis: number;
    reasoning: number;
    structuredGeneration: number;
}

export interface ResourceRequirements {
    estimatedRamGB: number;
    estimatedVramGB: number;
}

export interface ModelCapabilityProfile {
    modelId: string;
    modelName: string;
    parameterClass: string;
    capabilities: CapabilityScores;
    resourceRequirements: ResourceRequirements;
    strengths: string[];
}
