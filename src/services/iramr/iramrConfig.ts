import type { CapabilityScores } from '../modelRegistry/modelTypes';
import type { IRAMRWeights } from './iramrTypes';

export const IRAMR_CONFIG = {
    weights: {
        taskCapability: 0.55,
        hardwareFit: 0.30,
        resourceAvailability: 0.15
    } as IRAMRWeights,

    // Task Type to Capability mapping
    taskCapabilityMap: {
        "Question Answering": "questionAnswering",
        "General Question": "questionAnswering",
        "Summarization": "summarization",
        "Coding": "coding",
        "Code Debugging": "codeDebugging",
        "Translation": "translation",
        "Data Analysis": "dataAnalysis",
        "Information Extraction": "informationExtraction",
        "Document Analysis": "documentAnalysis",
        "Document Analysis + Report Generation": "documentAnalysis",
        "Report Generation": "structuredGeneration",
        "General Analysis": "reasoning"
    } as Record<string, keyof CapabilityScores>,

    // Complexity multiplier / adjustment
    complexityModifiers: {
        Simple: {
            // Under simple tasks, lightweight model gets efficiency advantage
            lightweightBonus: 12
        },
        Medium: {
            lightweightBonus: 0
        },
        Complex: {
            // Under complex tasks, higher capability models are favored
            capabilityWeightBoost: 1.0
        }
    }
};

export function getCapabilityKeyForTask(taskType: string): keyof CapabilityScores {
    return IRAMR_CONFIG.taskCapabilityMap[taskType] || "questionAnswering";
}
