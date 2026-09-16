export type TaskComplexity = "Simple" | "Medium" | "Complex";

export interface TaskAnalysisResult {
    taskType: string;
    complexity: TaskComplexity;
    fileAttached: boolean;
    fileRequired: boolean;
    fileType: string | null;
    fileName: string | null;
    inputType: string;
    outputType: string;
    ocrRequired: boolean;
    ragRequired: boolean;
    visionRequired: boolean;
    confidence: number;
}
