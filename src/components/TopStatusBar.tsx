import { Cpu, ShieldCheck, MemoryStick as Memory } from 'lucide-react';
import { useSystemHardware } from '../hooks/useSystemHardware';

export default function TopStatusBar() {
  const { hardware, loading } = useSystemHardware(2000);

  return (
    <header className="h-14 bg-bg-panel border-b border-border-subtle flex items-center justify-between px-4 shrink-0 shadow-sm z-10 relative">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="font-bold text-lg tracking-wide text-text-main">Sovereign AI Workbench</div>
        </div>
      </div>
      
      <div className="flex gap-3">
        {/* Active Model */}
        <div className="flex flex-col justify-center px-3 py-1 bg-bg-main rounded border border-border-subtle min-w-[120px]">
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Active Model</span>
          <div className="text-sm text-text-main font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            IRAMR Selected
          </div>
        </div>

        {/* RAM */}
        <div className="flex flex-col justify-center px-3 py-1 bg-bg-main rounded border border-border-subtle min-w-[120px]">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1"><Memory size={10}/> RAM</span>
            <span className="text-[10px] text-text-main">
              {loading ? '...' : `${hardware?.ram.utilization ?? 0}%`}
            </span>
          </div>
          <div className="text-sm text-text-main font-medium">
            {loading ? 'Loading...' : `${hardware?.ram.used_gb ?? 0} / ${hardware?.ram.total_gb ?? 0} GB`}
          </div>
        </div>

        {/* GPU */}
        <div className="flex flex-col justify-center px-3 py-1 bg-bg-main rounded border border-border-subtle min-w-[120px]">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1"><Cpu size={10}/> GPU</span>
          </div>
          <div className="text-sm text-text-main font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={hardware?.gpu.name}>
            {loading ? 'Detecting...' : (hardware?.gpu.available ? hardware.gpu.name : 'Unavailable')}
            {hardware?.gpu.available && <span className="text-xs text-text-muted font-normal ml-1">{hardware.gpu.vram_total_gb} GB VRAM</span>}
          </div>
        </div>
        
        {/* CPU */}
        <div className="flex flex-col justify-center px-3 py-1 bg-bg-main rounded border border-border-subtle min-w-[140px]">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1"><Cpu size={10}/> CPU</span>
            <span className="text-[10px] text-text-main">
              {loading ? '...' : `${Math.round(hardware?.cpu.utilization ?? 0)}%`}
            </span>
          </div>
          <div className="text-sm text-text-main font-medium">
            {loading ? 'Loading...' : `${hardware?.cpu.cores ?? 0} Cores / ${hardware?.cpu.threads ?? 0} Threads`}
          </div>
        </div>

        {/* LOCAL MODE */}
        <div className="flex flex-col justify-center px-4 py-1 bg-security/10 rounded border border-security/50 shadow-[0_0_10px_rgba(16,185,129,0.15)] min-w-[120px]">
          <span className="text-[10px] text-security uppercase tracking-wider font-bold flex items-center gap-1"><ShieldCheck size={10}/> LOCAL MODE</span>
          <div className="text-sm text-text-main font-medium">100% Local</div>
        </div>
      </div>
    </header>
  );
}
