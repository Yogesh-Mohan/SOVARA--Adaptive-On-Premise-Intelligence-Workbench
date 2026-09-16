export interface HardwareAnalysisResult {
    cpuName: string;
    cpuCores: number;
    cpuUtilization: number;

    ramTotalGB: number;
    ramUsedGB: number;
    ramAvailableGB: number;
    ramUtilization: number;

    gpuAvailable: boolean;
    gpuName: string | null;
    gpuVendor: string | null;
    vramTotalGB: number | null;
    gpuUtilization: number | null;

    osName: string;
    osVersion: string;

    computeProfile: "CPU Only" | "GPU Available";
    memoryProfile: "Low" | "Medium" | "High";
    vramProfile: "None" | "Low" | "Medium" | "High";
    resourceStatus: "Healthy" | "Moderate" | "Constrained";
}

export interface IRAMRHardwareInput {
    cpuCores: number;
    ramTotalGB: number;
    ramAvailableGB: number;
    gpuAvailable: boolean;
    vramTotalGB: number | null;
    gpuUtilization: number | null;
    resourceStatus: "Healthy" | "Moderate" | "Constrained";
}
