import type { TaskAnalysisResult } from '../taskAnalysis/taskTypes';
import type { HardwareAnalysisResult } from '../hardwareAnalysis/hardwareTypes';
import type { ModelCapabilityProfile } from '../modelRegistry/modelTypes';
import { MODEL_CAPABILITY_PROFILES } from '../modelRegistry/modelCapabilities';
import type { IRAMRResult, HardwareFitLevel, ModelAlternativeScore } from './iramrTypes';
import { IRAMR_CONFIG, getCapabilityKeyForTask } from './iramrConfig';

/**
 * Calculates Hardware Fit score (0 - 100) and Hardware Fit Level
 * Dynamically utilizes detected RAM, VRAM, GPU availability, and model requirements.
 */
export function calculateHardwareFit(
    model: ModelCapabilityProfile,
    hardware: HardwareAnalysisResult | null
): { score: number; fitLevel: HardwareFitLevel } {
    if (!hardware) {
        // Fallback if hardware analysis is unavailable: baseline CPU fallback
        return { score: 70, fitLevel: "Good" };
    }

    const reqVram = model.resourceRequirements.estimatedVramGB;
    const reqRam = model.resourceRequirements.estimatedRamGB;

    const hasGpu = hardware.gpuAvailable && hardware.vramTotalGB !== null && hardware.vramTotalGB > 0;
    const vramTotal = hardware.vramTotalGB || 0;
    const ramAvail = hardware.ramAvailableGB;
    const ramTotal = hardware.ramTotalGB;

    // Check GPU route first
    if (hasGpu) {
        if (vramTotal >= reqVram + 1.0) {
            // VRAM has comfortable headroom
            const ramHeadroom = ramAvail >= reqRam ? 100 : 85;
            return { score: ramHeadroom, fitLevel: "Excellent" };
        } else if (vramTotal >= reqVram) {
            // Fits VRAM with normal tolerance
            return { score: 85, fitLevel: "Good" };
        } else if (vramTotal > 0 && ramAvail >= reqRam) {
            // VRAM is tight or lower than model requirement, but local CPU/RAM offloading is available
            return { score: 65, fitLevel: "Limited" };
        }
    }

    // CPU-only execution path
    if (ramAvail >= reqRam * 1.5) {
        return { score: 75, fitLevel: "Good" };
    } else if (ramAvail >= reqRam) {
        return { score: 60, fitLevel: "Limited" };
    } else if (ramTotal >= reqRam) {
        // System has enough total RAM, but currently low available RAM
        return { score: 40, fitLevel: "Limited" };
    } else {
        return { score: 0, fitLevel: "Unsupported" };
    }
}

/**
 * Calculates Resource Availability Score (0 - 100) based on dynamic system state
 * Heavily penalizes heavier models when resources are constrained.
 */
export function calculateResourceAvailability(
    model: ModelCapabilityProfile,
    hardware: HardwareAnalysisResult | null
): number {
    if (!hardware) return 70;

    const status = hardware.resourceStatus;
    const reqRam = model.resourceRequirements.estimatedRamGB;
    const isHeavy = reqRam >= 3.0;

    if (status === "Healthy") {
        return 95;
    } else if (status === "Moderate") {
        return isHeavy ? 75 : 85;
    } else {
        // Constrained
        return isHeavy ? 40 : 70;
    }
}

/**
 * Calculates Task Capability Score (0 - 100) considering task type and complexity
 */
export function calculateTaskCapability(
    model: ModelCapabilityProfile,
    taskAnalysis: TaskAnalysisResult
): number {
    const capabilityKey = getCapabilityKeyForTask(taskAnalysis.taskType);
    let baseScore = model.capabilities[capabilityKey] || 70;

    // Adjust for task complexity
    if (taskAnalysis.complexity === "Simple") {
        // For simple tasks, lightweight model provides sufficient capability with high efficiency
        if (model.parameterClass === "1.1B") {
            baseScore = Math.min(100, baseScore + IRAMR_CONFIG.complexityModifiers.Simple.lightweightBonus);
        }
    } else if (taskAnalysis.complexity === "Complex") {
        // For complex tasks, higher capability profile receives a slight advantage
        if (model.parameterClass !== "1.1B") {
            baseScore = Math.min(100, baseScore + 2);
        }
    }

    return Math.round(baseScore * 10) / 10;
}

/**
 * Generates an explainable human-readable reason for model routing
 * Deterministic without calling an external LLM
 */
function generateRoutingReason(
    winner: ModelAlternativeScore,
    taskAnalysis: TaskAnalysisResult,
    hardware: HardwareAnalysisResult | null,
    alternatives: ModelAlternativeScore[]
): string {
    const taskType = taskAnalysis.taskType;
    const isQwen = winner.modelId.includes("Qwen");
    const runnerUp = alternatives.find(a => a.modelId !== winner.modelId);

    const capabilityKey = getCapabilityKeyForTask(taskType);
    const readableCapName = capabilityKey.replace(/([A-Z])/g, ' $1').toLowerCase();

    if (isQwen) {
        if (taskAnalysis.complexity === "Complex") {
            return `Stronger ${readableCapName} capability on complex workload while comfortably fitting available system resources.`;
        }
        return `Stronger ${readableCapName} capability (${winner.taskCapabilityScore} vs ${runnerUp?.taskCapabilityScore ?? 'baseline'}) and optimal resource fit.`;
    } else {
        if (hardware?.resourceStatus === "Constrained") {
            return `Lightweight execution efficiency chosen while system resources are constrained.`;
        }
        if (taskAnalysis.complexity === "Simple") {
            return `Provides sufficient capability for this simple ${taskType.toLowerCase()} task while requiring fewer resources.`;
        }
        return `Efficient resource footprint and solid ${readableCapName} match (${winner.taskCapabilityScore}%).`;
    }
}

/**
 * Primary IRAMR Model Selection Function
 * Combines: Task Analysis + Hardware Analysis + Model Capability Profiles
 */
export function selectBestModel(
    taskAnalysis: TaskAnalysisResult,
    hardwareAnalysis: HardwareAnalysisResult | null
): IRAMRResult {
    const weights = IRAMR_CONFIG.weights;
    const profiles = MODEL_CAPABILITY_PROFILES;

    const scoredModels: ModelAlternativeScore[] = profiles.map(profile => {
        const taskCapabilityScore = calculateTaskCapability(profile, taskAnalysis);
        const { score: hardwareFitScore, fitLevel: hardwareFit } = calculateHardwareFit(profile, hardwareAnalysis);
        const resourceAvailabilityScore = calculateResourceAvailability(profile, hardwareAnalysis);

        const rawFinalScore = 
            (taskCapabilityScore * weights.taskCapability) +
            (hardwareFitScore * weights.hardwareFit) +
            (resourceAvailabilityScore * weights.resourceAvailability);

        const finalScore = Math.round(rawFinalScore * 10) / 10;

        return {
            modelId: profile.modelId,
            modelName: profile.modelName,
            taskCapabilityScore,
            hardwareFitScore,
            resourceAvailabilityScore,
            finalScore,
            hardwareFit
        };
    });

    // Filter out completely unsupported models if any
    const supportedModels = scoredModels.filter(m => m.hardwareFit !== "Unsupported");
    
    // Sort descending by finalScore
    const candidateList = supportedModels.length > 0 ? supportedModels : scoredModels;
    candidateList.sort((a, b) => b.finalScore - a.finalScore);

    const winner = candidateList[0];

    const reason = generateRoutingReason(
        winner,
        taskAnalysis,
        hardwareAnalysis,
        scoredModels
    );

    return {
        selectedModelId: winner.modelId,
        selectedModelName: winner.modelName,
        taskType: taskAnalysis.taskType,
        complexity: taskAnalysis.complexity,
        taskCapabilityScore: winner.taskCapabilityScore,
        hardwareFitScore: winner.hardwareFitScore,
        resourceAvailabilityScore: winner.resourceAvailabilityScore,
        finalScore: winner.finalScore,
        hardwareFit: winner.hardwareFit as HardwareFitLevel,
        reason,
        toolRequirements: {
            ocr: taskAnalysis.ocrRequired,
            rag: taskAnalysis.ragRequired,
            vision: taskAnalysis.visionRequired
        },
        alternatives: scoredModels
    };
}
