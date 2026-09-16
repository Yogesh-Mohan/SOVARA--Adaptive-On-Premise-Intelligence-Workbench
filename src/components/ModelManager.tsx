import { useState, useEffect } from 'react';
import { Database, Download, Trash2, CheckCircle2, Box, Cpu, AlertCircle, X, Play, Lock, Unlock, Activity, Monitor, HardDrive, Zap, Check } from 'lucide-react';
import { getModelProfiles } from '../services/modelRegistry/modelCapabilities';
import { getDownloadConfig } from '../services/modelRegistry/modelDownloadConfig';
import { useModelDownload } from '../hooks/useModelDownload';
import ModelDownloadModal from './ModelDownloadModal';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
import { runtimeManager } from '../services/runtimeManager/runtimeManager';
import { getLockedConfig, saveLockedConfig, removeLockedConfig } from '../services/runtimeManager/runtimeStore';
import type { RuntimeState, RuntimeConfig, RuntimeDetectionResult, BenchmarkResult } from '../services/runtimeManager/runtimeTypes';

export default function ModelManager() {
    const profiles = getModelProfiles();
    
    // Global Runtime State
    const [runtimeState, setRuntimeState] = useState<RuntimeState>(runtimeManager.getState());
    const [detection, setDetection] = useState<RuntimeDetectionResult | null>(null);

    useEffect(() => {
        const unsubscribe = runtimeManager.subscribe(setRuntimeState);
        invoke<RuntimeDetectionResult>('detect_runtime').then(setDetection).catch(console.error);
        return unsubscribe;
    }, []);

    return (
        <div className="flex-1 flex flex-col bg-bg-main overflow-hidden">
            <div className="p-6 border-b border-border-subtle bg-bg-panel shrink-0">
                <h1 className="text-2xl font-bold text-text-main flex items-center gap-3">
                    <Database className="text-primary" size={28} />
                    Model Manager
                </h1>
                <p className="text-text-muted mt-2 max-w-2xl text-sm leading-relaxed">
                    Manage and benchmark local AI models required for Sovereign AI Workbench. Verify quantization variants and lock your preferred runtime configurations.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                
                {/* Global Runtime Status Section */}
                <div className="max-w-5xl mx-auto mb-8">
                    <div className="bg-bg-panel border border-border-subtle rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                                <Activity className="text-primary" size={20} /> Local LLM Runtime Status
                            </h2>
                            <div className="flex items-center gap-2 text-xs font-mono">
                                {detection?.cli_path && detection?.server_path ? (
                                    <span className="px-2 py-1 bg-security/10 text-security border border-security/30 rounded-md flex items-center gap-1.5"><Check size={14}/> llama.cpp detected</span>
                                ) : (
                                    <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-md">llama.cpp missing</span>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-bg-main border border-border-subtle p-3 rounded-xl">
                                <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Runtime Engine</div>
                                <div className="text-sm text-text-main font-medium">llama.cpp</div>
                            </div>
                            <div className="bg-bg-main border border-border-subtle p-3 rounded-xl">
                                <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">CUDA Toolkit</div>
                                <div className={cn("text-sm font-medium", detection?.cuda_available ? "text-security" : "text-text-muted")}>
                                    {detection?.cuda_available ? "Available" : "Unavailable"}
                                </div>
                            </div>
                            <div className="bg-bg-main border border-border-subtle p-3 rounded-xl">
                                <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Current Status</div>
                                <div className={cn("text-sm font-medium", 
                                    runtimeState.status === 'Ready' ? 'text-security' : 
                                    runtimeState.status === 'Error' ? 'text-red-400' : 'text-primary'
                                )}>
                                    {runtimeState.status}
                                </div>
                            </div>
                            <div className="bg-bg-main border border-border-subtle p-3 rounded-xl">
                                <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Active Model</div>
                                <div className="text-sm text-text-main font-medium truncate">
                                    {runtimeState.activeConfig ? runtimeState.activeConfig.selectedVariant : "None"}
                                </div>
                            </div>
                        </div>
                        
                        {runtimeState.errorMsg && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-start gap-2">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <div className="font-mono text-xs overflow-hidden break-words">{runtimeState.errorMsg}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="max-w-5xl mx-auto space-y-6">
                    {profiles.map(profile => (
                        <ModelCard key={profile.modelId} profile={profile} detection={detection} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ModelCard({ profile, detection }: { profile: any, detection: RuntimeDetectionResult | null }) {
    const config = getDownloadConfig(profile.modelId);
    if (!config) return null;

    // Map HF model ID to local directory name (matches how llama_server and runtimeManager expect it)
    const localModelId = profile.modelId.toLowerCase().includes('tinyllama') ? 'tinyllama' : 'qwen2.5-1.5b';

    const { status, progress, error, startDownload, cancelDownload, deleteModel } = useModelDownload(localModelId, config.ggufFilename);
    const [variants, setVariants] = useState<string[]>([]);
    const [lockedConfig, setLockedConfig] = useState<RuntimeConfig | null>(getLockedConfig(localModelId));
    
    // Benchmark State
    const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
    const [isBenchmarking, setIsBenchmarking] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState<(BenchmarkResult & { variant: string, layers: number }) | null>(null);

    useEffect(() => {
        if (status === 'Downloaded' || lockedConfig) {
            invoke<string[]>('scan_local_models', { modelId: localModelId }).then(v => {
                setVariants(v);
                if (v.length > 0 && !selectedVariant) {
                    setSelectedVariant(lockedConfig ? lockedConfig.selectedVariant : v[0]);
                }
            }).catch(console.error);
        } else {
            setVariants([]);
        }
    }, [status, localModelId, lockedConfig]);

    const handleRunBenchmark = async () => {
        if (!selectedVariant) return;
        setIsBenchmarking(true);
        setBenchmarkResult(null);

        // Run GPU first if CUDA available, else 0 layers
        const ngl = detection?.cuda_available ? 999 : 0;
        
        try {
            const result: BenchmarkResult = await invoke('run_benchmark', { 
                modelId: localModelId, 
                variant: selectedVariant, 
                ngl 
            });
            setBenchmarkResult({ ...result, variant: selectedVariant, layers: ngl });
        } catch (e: any) {
            setBenchmarkResult({ 
                load_success: false, 
                prompt_speed: null, 
                generation_speed: null, 
                error_msg: e.message || e.toString(),
                variant: selectedVariant,
                layers: ngl
            });
        } finally {
            setIsBenchmarking(false);
        }
    };

    const handleLockConfig = () => {
        if (benchmarkResult && benchmarkResult.load_success) {
            const newConfig: RuntimeConfig = {
                modelId: localModelId,
                selectedVariant: benchmarkResult.variant,
                gpuOffloadLayers: benchmarkResult.layers,
                promptSpeed: benchmarkResult.prompt_speed,
                generationSpeed: benchmarkResult.generation_speed
            };
            saveLockedConfig(newConfig);
            setLockedConfig(newConfig);
        }
    };

    const handleUnlockConfig = () => {
        removeLockedConfig(localModelId);
        setLockedConfig(null);
    };

    const hasGguf = variants.length > 0;

    return (
        <div className="bg-bg-panel border border-border-subtle rounded-2xl p-6 relative overflow-hidden transition-colors">
            
            {/* Status Indicator Stripe */}
            <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                lockedConfig ? 'bg-security' : 
                hasGguf ? 'bg-primary' : 
                status === 'Downloading' ? 'bg-blue-400' : 'bg-border-subtle'
            )}></div>

            {/* Top Row: Info & Basic Actions */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-text-main">{profile.modelName}</h3>
                        <span className="px-2 py-0.5 bg-bg-main border border-border-subtle rounded-md text-[10px] font-bold text-text-muted uppercase tracking-widest">
                            {profile.parameterClass}
                        </span>
                        {lockedConfig ? (
                            <span className="px-2 py-0.5 bg-security/10 border border-security/30 text-security rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 size={12} /> Config Locked
                            </span>
                        ) : hasGguf ? (
                            <span className="px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <Box size={12} /> GGUF Detected
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 bg-bg-main border border-border-subtle text-text-muted rounded-md text-[10px] font-bold uppercase tracking-widest">
                                Not Found
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-text-muted flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Cpu size={14}/> {profile.resourceRequirements.estimatedRamGB} GB RAM Required</span>
                        <span className="flex items-center gap-1.5"><HardDrive size={14}/> ~{config.estimatedSizeGB} GB Disk</span>
                    </div>
                </div>

                <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                    {!hasGguf && status !== 'Downloading' && (
                        <button 
                            onClick={() => startDownload(config.ggufRepo)}
                            className="w-full py-2 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download
                        </button>
                    )}
                    {status === 'Downloading' && progress && (
                        <button 
                            onClick={cancelDownload}
                            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <X size={16} /> Cancel Download ({progress.percentage.toFixed(1)}%)
                        </button>
                    )}
                    {hasGguf && (
                        <button 
                            onClick={deleteModel}
                            className="w-full py-2 bg-bg-main hover:bg-red-500/10 border border-border-subtle hover:border-red-500/30 text-text-muted hover:text-red-400 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Trash2 size={14} /> Remove Local Model
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Dashboard Sections (Only if GGUFs exist) */}
            {hasGguf && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-border-subtle pt-6 mt-4">
                    
                    {/* Left Col: Variants & Benchmark Controls */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                            <Box className="text-primary" size={16} /> Quantization Variants
                        </h4>
                        
                        <div className="space-y-2">
                            {variants.map(v => (
                                <button 
                                    key={v}
                                    onClick={() => setSelectedVariant(v)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between",
                                        selectedVariant === v 
                                            ? "bg-primary/10 border-primary shadow-sm" 
                                            : "bg-bg-main border-border-subtle hover:border-primary/50 text-text-muted hover:text-text-main"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-3 h-3 rounded-full border-2", selectedVariant === v ? "border-primary bg-primary/20" : "border-border-subtle")} />
                                        <span className="font-mono text-sm">{v}</span>
                                    </div>
                                    {lockedConfig?.selectedVariant === v && (
                                        <span className="text-[10px] font-bold text-security bg-security/10 px-2 py-0.5 rounded-md uppercase tracking-wide">Locked</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleRunBenchmark}
                                disabled={isBenchmarking || !selectedVariant}
                                className={cn(
                                    "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm",
                                    isBenchmarking 
                                        ? "bg-bg-main border border-border-subtle text-text-muted cursor-wait" 
                                        : "bg-text-main hover:bg-white text-bg-main border border-transparent"
                                )}
                            >
                                {isBenchmarking ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
                                        Running Llama.cpp Benchmark...
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} /> Run Benchmark on {selectedVariant?.split('.')[0] || 'Selected'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Right Col: Benchmark Results & Locked Config */}
                    <div className="space-y-6">
                        
                        {/* Current Benchmark Result */}
                        {(benchmarkResult || isBenchmarking) && (
                            <div className="bg-bg-main border border-border-subtle rounded-xl p-4">
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity size={14} /> Benchmark Results
                                </h4>
                                
                                {isBenchmarking ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                                        <Monitor size={32} className="mb-3 opacity-20 animate-pulse" />
                                        <div className="text-sm font-medium">Executing local runtime tests...</div>
                                        <div className="text-xs mt-1">This validates model integrity and measures CPU/GPU speed.</div>
                                    </div>
                                ) : benchmarkResult ? (
                                    benchmarkResult.load_success ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg">
                                                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Execution</div>
                                                    <div className="text-sm text-text-main font-bold flex items-center gap-1.5">
                                                        {benchmarkResult.layers > 0 ? <><Zap size={14} className="text-yellow-500"/> GPU Offload</> : <><Cpu size={14}/> CPU Only</>}
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg">
                                                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Generation Speed</div>
                                                    <div className="text-sm text-security font-bold font-mono">
                                                        {benchmarkResult.generation_speed?.toFixed(1) || 'N/A'} t/s
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg">
                                                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Prompt Processing</div>
                                                    <div className="text-sm text-text-main font-bold font-mono">
                                                        {benchmarkResult.prompt_speed?.toFixed(1) || 'N/A'} t/s
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg">
                                                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Model Integrity</div>
                                                    <div className="text-sm text-security font-bold">PASS</div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={handleLockConfig}
                                                className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Lock size={16} /> Lock This Configuration
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <div className="text-red-400 font-bold text-sm flex items-center gap-2 mb-2">
                                                <AlertCircle size={16} /> Benchmark Failed
                                            </div>
                                            <div className="text-xs font-mono text-red-400/80 break-words">
                                                {benchmarkResult.error_msg}
                                            </div>
                                            <div className="mt-3 text-xs text-text-muted">
                                                The GGUF file might be corrupted or missing. Try deleting and re-downloading it.
                                            </div>
                                        </div>
                                    )
                                ) : null}
                            </div>
                        )}

                        {/* Locked Configuration Card */}
                        <div className={cn(
                            "border rounded-xl p-4 transition-all",
                            lockedConfig ? "bg-security/5 border-security/30" : "bg-bg-main border-border-subtle opacity-50"
                        )}>
                            <h4 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
                                <span className={cn("flex items-center gap-2", lockedConfig ? "text-security" : "text-text-muted")}>
                                    <Lock size={14} /> Locked Configuration
                                </span>
                                {lockedConfig && (
                                    <button onClick={handleUnlockConfig} className="text-text-muted hover:text-red-400 transition-colors p-1" title="Unlock Configuration">
                                        <Unlock size={14} />
                                    </button>
                                )}
                            </h4>
                            
                            {lockedConfig ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm border-b border-border-subtle pb-2">
                                        <span className="text-text-muted">Variant</span>
                                        <span className="font-mono text-text-main">{lockedConfig.selectedVariant}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-border-subtle pb-2">
                                        <span className="text-text-muted">Execution Mode</span>
                                        <span className="text-text-main flex items-center gap-1.5">
                                            {lockedConfig.gpuOffloadLayers > 0 ? <Zap size={14} className="text-yellow-500"/> : <Cpu size={14}/>}
                                            {lockedConfig.gpuOffloadLayers > 0 ? `GPU (${lockedConfig.gpuOffloadLayers} layers)` : 'CPU Only'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-text-muted">Expected Speed</span>
                                        <span className="font-mono text-security">{lockedConfig.generationSpeed?.toFixed(1) || 'N/A'} t/s</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-sm text-text-muted">
                                    No configuration locked.<br/>Run a benchmark to validate and lock a configuration.
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* Download Modal (If actively downloading a fresh model) */}
            {status === 'Downloading' && progress && (
                <ModelDownloadModal 
                    modelName={profile.modelName}
                    repoId={config.ggufRepo}
                    progress={progress}
                    onCancel={cancelDownload}
                />
            )}
        </div>
    );
}
