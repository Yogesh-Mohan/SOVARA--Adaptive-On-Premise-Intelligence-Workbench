import { useEffect, useState } from 'react';
import { Cpu, Zap, Server, AlertCircle, RefreshCw } from 'lucide-react';
import { runtimeManager } from '../services/runtimeManager/runtimeManager';
import type { RuntimeState } from '../services/runtimeManager/runtimeTypes';

interface Props {
    modelId: string | null;
}

export default function RuntimeStatusPanel({ modelId }: Props) {
    const [state, setState] = useState<RuntimeState>(runtimeManager.getState());
    const [isBenchmarking, setIsBenchmarking] = useState(false);

    useEffect(() => {
        runtimeManager.initialize();
        const unsubscribe = runtimeManager.subscribe(setState);
        return () => unsubscribe();
    }, []);

    const handleBenchmark = async () => {
        if (!modelId) return;
        setIsBenchmarking(true);
        await runtimeManager.forceBenchmark(modelId);
        setIsBenchmarking(false);
    };

    if (!modelId) return null;

    const { isReady, cudaAvailable, activeConfig, status, errorMsg, currentSpeed } = state;

    return (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3 flex flex-col gap-3 text-xs shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="font-bold text-text-muted flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Server size={12} className="text-primary" />
                    LOCAL LLM RUNTIME
                </span>
                <span className="flex items-center gap-1">
                    {status === 'Loading' ? (
                        <RefreshCw size={12} className="animate-spin text-text-muted" />
                    ) : status === 'Generating' ? (
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    ) : status === 'Error' ? (
                        <AlertCircle size={12} className="text-red-400" />
                    ) : (
                        <span className="w-2 h-2 rounded-full bg-security" />
                    )}
                    <span className={`font-semibold ${status === 'Error' ? 'text-red-400' : 'text-text-main'}`}>
                        {status}
                    </span>
                </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                    <span className="text-text-muted block text-[10px]">Runtime</span>
                    <span className={`font-medium ${isReady ? 'text-security' : 'text-red-400'}`}>
                        {isReady ? 'llama.cpp' : 'Not Found'}
                    </span>
                </div>
                <div>
                    <span className="text-text-muted block text-[10px]">CUDA / GPU</span>
                    <span className="font-medium text-text-main flex items-center gap-1">
                        {cudaAvailable ? (
                            <><Zap size={10} className="text-security" /> Available</>
                        ) : (
                            <><Cpu size={10} className="text-text-muted" /> Unavailable</>
                        )}
                    </span>
                </div>
                {activeConfig ? (
                    <>
                        <div>
                            <span className="text-text-muted block text-[10px]">Quantization</span>
                            <span className="font-medium text-primary truncate block" title={activeConfig.selectedVariant}>
                                {activeConfig.selectedVariant.split('.').slice(-2, -1)[0] || activeConfig.selectedVariant}
                            </span>
                        </div>
                        <div>
                            <span className="text-text-muted block text-[10px]">Execution</span>
                            <span className="font-medium text-text-main">
                                {activeConfig.gpuOffloadLayers > 0 ? `GPU (${activeConfig.gpuOffloadLayers} layers)` : 'CPU Only'}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="col-span-2 text-text-muted text-[10px] italic">
                        No runtime configuration locked for this model.
                    </div>
                )}
            </div>

            {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-lg mt-1">
                    {errorMsg}
                </div>
            )}

            <div className="flex items-center justify-between mt-1 pt-2 border-t border-border-subtle">
                <div className="text-[10px]">
                    <span className="text-text-muted">Speed: </span>
                    <span className="font-medium text-primary">
                        {currentSpeed ? `${currentSpeed.toFixed(1)} t/s` : activeConfig?.generationSpeed ? `${activeConfig.generationSpeed.toFixed(1)} t/s (Locked)` : 'N/A'}
                    </span>
                </div>
                
                <button 
                    onClick={handleBenchmark}
                    disabled={isBenchmarking || !isReady}
                    className="px-2 py-1 bg-bg-main hover:bg-bg-panel-hover border border-border-subtle rounded-md text-[10px] text-text-main transition-colors disabled:opacity-50"
                >
                    {isBenchmarking ? 'Testing...' : 'Run Benchmark'}
                </button>
            </div>
        </div>
    );
}
