import type { DownloadProgress } from '../hooks/useModelDownload';
import { X, Server, Activity, Clock } from 'lucide-react';

interface Props {
    modelName: string;
    repoId: string;
    progress: DownloadProgress | null;
    onCancel: () => void;
}

export default function ModelDownloadModal({ modelName, repoId, progress, onCancel }: Props) {
    if (!progress) return null;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatTime = (seconds: number) => {
        if (!isFinite(seconds) || seconds < 0) return 'Calculating...';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s remaining`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-bg-main">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary relative">
                            <Server size={20} />
                            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full animate-ping"></div>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-main">Downloading Model Engine</h2>
                            <div className="text-xs text-text-muted flex items-center gap-1.5 font-mono">
                                {repoId}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex flex-col items-center">
                    
                    <h3 className="text-2xl font-bold text-text-main mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-text-muted">
                        {modelName}
                    </h3>

                    {/* Circular Progress or Large Progress Bar */}
                    <div className="w-full mb-8 relative">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-4xl font-bold text-primary tabular-nums tracking-tight">
                                {progress.percentage.toFixed(1)}%
                            </span>
                            <span className="text-sm font-medium text-text-muted tabular-nums">
                                {formatBytes(progress.downloaded_bytes)} / {formatBytes(progress.total_bytes)}
                            </span>
                        </div>
                        
                        <div className="h-4 w-full bg-bg-main rounded-full overflow-hidden border border-border-subtle shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-600 to-primary transition-all duration-300 ease-out relative"
                                style={{ width: `${progress.percentage}%` }}
                            >
                                {/* Shimmer effect */}
                                <div className="absolute top-0 left-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full mb-8">
                        <div className="bg-bg-main border border-border-subtle rounded-xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-bg-panel flex items-center justify-center text-text-muted">
                                <Activity size={18} />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Download Speed</div>
                                <div className="text-lg font-bold text-text-main tabular-nums">
                                    {progress.speed_mbps.toFixed(2)} <span className="text-sm font-normal text-text-muted">MB/s</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-bg-main border border-border-subtle rounded-xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-bg-panel flex items-center justify-center text-text-muted">
                                <Clock size={18} />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Estimated Time</div>
                                <div className="text-lg font-bold text-text-main tabular-nums">
                                    {formatTime(progress.eta_seconds)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-text-muted text-center max-w-md mb-8">
                        This model file will be securely stored in your local AppData directory. The download will resume seamlessly if interrupted.
                    </div>

                    {/* Actions */}
                    <button 
                        onClick={onCancel}
                        className="px-6 py-2.5 bg-bg-main border border-border-subtle hover:bg-bg-panel-hover text-text-main rounded-xl font-medium transition-colors flex items-center gap-2 group"
                    >
                        <X size={16} className="text-text-muted group-hover:text-red-400 transition-colors" />
                        Cancel Download
                    </button>
                </div>
            </div>
        </div>
    );
}
