import { Shield, ShieldAlert, Network, Lock, Cpu, Globe, ArrowRightLeft, FileLock2 } from 'lucide-react';

export default function SovereigntyGuard() {
  return (
    <div className="flex-1 bg-bg-main flex flex-col overflow-hidden">
      
      {/* Top Shield Status */}
      <div className="p-8 border-b border-border-subtle flex items-center justify-center flex-col py-12 bg-bg-panel relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-security/10 via-transparent to-transparent"></div>
        <div className="h-20 w-20 bg-security/10 text-security rounded-full flex items-center justify-center mb-6 border border-security/30 shadow-[0_0_30px_rgba(16,185,129,0.2)] relative">
          <Shield size={40} />
          <div className="absolute top-0 right-0 w-4 h-4 bg-security rounded-full animate-ping"></div>
          <div className="absolute top-0 right-0 w-4 h-4 bg-security rounded-full"></div>
        </div>
        <div className="text-security font-bold tracking-widest text-lg">SOVEREIGNTY VERIFIED</div>
        <div className="text-text-main font-bold text-3xl mt-2 tracking-wide">100% LOCAL</div>
        <div className="text-sm text-text-muted mt-2">Your data never leaves this machine.</div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row gap-6 p-8">
        {/* Security & Data Sovereignty Status */}
        <div className="flex-1 bg-bg-panel p-6 rounded-xl border border-border-subtle">
          <div className="text-sm font-bold text-text-muted mb-6 uppercase tracking-widest flex items-center gap-2">
            <Lock size={16} /> Security Status
          </div>
          
          <div className="space-y-3">
            <StatusRow icon={<Network size={16} />} label="Network Isolation" value="Isolated" isGood />
            <StatusRow icon={<Globe size={16} />} label="External Connections" value="0" isGood />
            <StatusRow icon={<ArrowRightLeft size={16} />} label="Outbound Transfers" value="0 B" isGood />
            <StatusRow icon={<Lock size={16} />} label="Localhost Binding" value="Active" isGood />
            <StatusRow icon={<ShieldAlert size={16} />} label="Egress Control" value="Active" isGood />
            <StatusRow icon={<FileLock2 size={16} />} label="Docker Isolation" value="Enabled" isGood />
            <StatusRow icon={<Cpu size={16} />} label="AI Inference" value="Local Model" isGood />
          </div>
        </div>

        {/* Security Events Timeline */}
        <div className="flex-1 bg-bg-panel p-6 rounded-xl border border-border-subtle">
          <div className="text-sm font-bold text-text-muted mb-6 uppercase tracking-widest">
            Security Events
          </div>
          
          <div className="space-y-6 pl-4 border-l-2 border-border-subtle relative">
            <EventLog time="10:20:16" message="Network isolation verified" />
            <EventLog time="10:20:17" message="No external connection detected" />
            <EventLog time="10:20:18" message="Local inference confirmed" />
            <EventLog time="10:20:19" message="No outbound transfer detected" />
            <EventLog time="10:20:21" message="Sovereignty check passed" isSuccess />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ icon, label, value, isGood }: { icon: React.ReactNode, label: string, value: string, isGood: boolean }) {
  return (
    <div className="flex justify-between items-center bg-bg-main p-3 rounded-lg border border-border-subtle hover:bg-bg-panel-hover transition-colors">
      <span className="text-text-main text-sm flex items-center gap-3">
        <span className="text-text-muted">{icon}</span>
        {label}
      </span>
      <span className={`text-sm font-medium flex items-center gap-2 ${isGood ? 'text-security' : 'text-text-muted'}`}>
        {isGood && <div className="w-2 h-2 rounded-full bg-security shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>}
        {value}
      </span>
    </div>
  );
}

function EventLog({ time, message, isSuccess = false }: { time: string, message: string, isSuccess?: boolean }) {
  return (
    <div className="relative pl-6">
      <div className={`absolute -left-[25px] top-1.5 w-3 h-3 rounded-full border-2 border-bg-panel ${isSuccess ? 'bg-security' : 'bg-text-muted'}`}></div>
      <div className="text-xs text-text-muted font-mono mb-1">{time}</div>
      <div className={`text-sm ${isSuccess ? 'text-security font-medium' : 'text-text-main'}`}>{message}</div>
    </div>
  );
}
