import type { SystemHardware } from '../../hooks/useSystemHardware';
import type { HardwareAnalysisResult, IRAMRHardwareInput } from './hardwareTypes';
import { HARDWARE_THRESHOLDS } from './hardwareThresholds';

export function analyzeHardware(hardware: SystemHardware | null): HardwareAnalysisResult | null {
    if (!hardware) return null;

    const { cpu, ram, gpu, os } = hardware;

    // Compute Profile
    const computeProfile = gpu.available ? "GPU Available" : "CPU Only";

    // Memory Profile
    let memoryProfile: "Low" | "Medium" | "High" = "Low";
    if (ram.available_gb >= HARDWARE_THRESHOLDS.MEMORY.HIGH_AVAILABLE_GB) {
        memoryProfile = "High";
    } else if (ram.available_gb >= HARDWARE_THRESHOLDS.MEMORY.MEDIUM_AVAILABLE_GB) {
        memoryProfile = "Medium";
    }

    // VRAM Profile
    let vramProfile: "None" | "Low" | "Medium" | "High" = "None";
    if (gpu.available && gpu.vram_total_gb !== null) {
        if (gpu.vram_total_gb >= HARDWARE_THRESHOLDS.VRAM.HIGH_GB) {
            vramProfile = "High";
        } else if (gpu.vram_total_gb >= HARDWARE_THRESHOLDS.VRAM.MEDIUM_GB) {
            vramProfile = "Medium";
        } else {
            vramProfile = "Low";
        }
    }

    // Resource Status
    let resourceStatus: "Healthy" | "Moderate" | "Constrained" = "Healthy";
    const maxUtilization = Math.max(
        cpu.utilization,
        ram.utilization,
        gpu.available && gpu.utilization !== null ? gpu.utilization : 0
    );

    if (maxUtilization >= HARDWARE_THRESHOLDS.RESOURCE_STATUS.CONSTRAINED_UTILIZATION_PERCENT) {
        resourceStatus = "Constrained";
    } else if (maxUtilization >= HARDWARE_THRESHOLDS.RESOURCE_STATUS.MODERATE_UTILIZATION_PERCENT) {
        resourceStatus = "Moderate";
    }

    return {
        cpuName: cpu.name,
        cpuCores: cpu.cores,
        cpuUtilization: cpu.utilization,
        
        ramTotalGB: ram.total_gb,
        ramUsedGB: ram.used_gb,
        ramAvailableGB: ram.available_gb,
        ramUtilization: ram.utilization,
        
        gpuAvailable: gpu.available,
        gpuName: gpu.name,
        gpuVendor: gpu.vendor,
        vramTotalGB: gpu.vram_total_gb,
        gpuUtilization: gpu.utilization,
        
        osName: os.name,
        osVersion: os.version,

        computeProfile,
        memoryProfile,
        vramProfile,
        resourceStatus
    };
}

export function extractIRAMRInput(analysis: HardwareAnalysisResult | null): IRAMRHardwareInput | null {
    if (!analysis) return null;

    return {
        cpuCores: analysis.cpuCores,
        ramTotalGB: analysis.ramTotalGB,
        ramAvailableGB: analysis.ramAvailableGB,
        gpuAvailable: analysis.gpuAvailable,
        vramTotalGB: analysis.vramTotalGB,
        gpuUtilization: analysis.gpuUtilization,
        resourceStatus: analysis.resourceStatus
    };
}
