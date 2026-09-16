import { Activity, Network, HardDrive, Cpu, Terminal, ArrowUpRight, Zap } from 'lucide-react';
import { useSystemHardware } from '../hooks/useSystemHardware';
import { analyzeHardware } from '../services/hardwareAnalysis/hardwareAnalyzer';

export default function BottomDashboard() {
  const { hardware, loading } = useSystemHardware(2000);
  const analysis = analyzeHardware(hardware);

  return (
    <div className="flex-1 bg-bg-main flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border-subtle bg-bg-panel flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Activity size={20} className="text-primary" />
          System Monitor
        </h2>
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded bg-bg-main border border-border-subtle text-xs text-text-muted flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-security animate-pulse"></div>
            Live Monitoring
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <MetricCard icon={<Cpu size={18} />} label="Inference Engine" value="Idle" />
          <MetricCard icon={<HardDrive size={18} />} label="Model Storage" value="48.2 GB" trend="0%" />
          <MetricCard icon={<Network size={18} />} label="Local API Server" value="Operational" isGood />
          <MetricCard icon={<Terminal size={18} />} label="Active Sessions" value="2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4 flex flex-col">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap size={14} className="text-primary"/>
              Hardware Analysis
            </h3>
            
            {!analysis ? (
              <div className="text-sm text-text-muted italic flex-1 flex items-center justify-center">Analyzing hardware...</div>
            ) : (
              <div className="flex flex-col gap-4 flex-1">
                {/* Raw Hardware Specs */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">CPU</span>
                    <span className="text-text-main font-medium truncate ml-4 text-right">{analysis.cpuName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">CPU Cores</span>
                    <span className="text-text-main font-medium">{analysis.cpuCores}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">RAM</span>
                    <span className="text-text-main font-medium">{analysis.ramTotalGB} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">RAM Available</span>
                    <span className="text-text-main font-medium">{analysis.ramAvailableGB} GB</span>
                  </div>
                  {analysis.gpuAvailable && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-text-muted">GPU</span>
                        <span className="text-text-main font-medium truncate ml-4 text-right">{analysis.gpuName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">VRAM</span>
                        <span className="text-text-main font-medium">{analysis.vramTotalGB} GB</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border-subtle"></div>

                {/* Computed Profiles */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1">Compute Profile</div>
                    <div className={`text-sm font-bold ${analysis.computeProfile === 'GPU Available' ? 'text-primary' : 'text-text-main'}`}>
                      {analysis.computeProfile}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1">Memory Profile</div>
                    <div className={`text-sm font-bold ${analysis.memoryProfile === 'Low' ? 'text-orange-400' : analysis.memoryProfile === 'High' ? 'text-security' : 'text-yellow-400'}`}>
                      {analysis.memoryProfile}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1">VRAM Profile</div>
                    <div className={`text-sm font-bold ${analysis.vramProfile === 'None' ? 'text-text-muted' : analysis.vramProfile === 'Low' ? 'text-orange-400' : 'text-primary'}`}>
                      {analysis.vramProfile}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1">Resource Status</div>
                    <div className={`text-sm font-bold ${
                      analysis.resourceStatus === 'Healthy' ? 'text-security' : 
                      analysis.resourceStatus === 'Moderate' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {analysis.resourceStatus}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Resource Usage</h3>
            <div className="space-y-4">
              <ProgressBar 
                label={`CPU (${loading ? '...' : hardware?.cpu.name})`} 
                percentage={loading ? 0 : Math.round(hardware?.cpu.utilization ?? 0)} 
              />
              <ProgressBar 
                label={`RAM (${loading ? '...' : hardware?.ram.total_gb} GB)`} 
                percentage={loading ? 0 : (hardware?.ram.utilization ?? 0)} 
              />
              {hardware?.gpu.available && (
                <ProgressBar 
                  label={`GPU VRAM (${hardware.gpu.vram_total_gb} GB)`} 
                  percentage={Math.round((hardware.gpu.vram_used_gb / hardware.gpu.vram_total_gb) * 100) || 0} 
                  color="bg-orange-500" 
                />
              )}
            </div>
          </div>
          
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Local Execution Logs</h3>
            <div className="font-mono text-xs space-y-2 text-text-muted">
              <div><span className="text-primary">[INFO]</span> Loading model IRAMR-1.5B...</div>
              <div><span className="text-security">[OK]</span> Model loaded successfully in 4.2s.</div>
              <div><span className="text-primary">[INFO]</span> Starting local inference server on port 8080.</div>
              <div><span className="text-primary">[INFO]</span> Awaiting prompt...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, trend, isGood }: any) {
  return (
    <div className="bg-bg-panel border border-border-subtle p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden">
      <div className="flex justify-between items-start text-text-muted">
        {icon}
        {trend && <span className="text-xs text-security bg-security/10 px-1 rounded flex items-center"><ArrowUpRight size={10} />{trend}</span>}
      </div>
      <div className="mt-2">
        <div className="text-xs font-bold text-text-muted uppercase tracking-widest">{label}</div>
        <div className={`text-xl font-bold mt-1 ${isGood ? 'text-security' : 'text-text-main'}`}>{value}</div>
      </div>
    </div>
  );
}

function ProgressBar({ label, percentage, color = "bg-primary" }: any) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-main">{label}</span>
        <span className="text-text-muted">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-bg-main rounded-full overflow-hidden border border-border-subtle">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}
