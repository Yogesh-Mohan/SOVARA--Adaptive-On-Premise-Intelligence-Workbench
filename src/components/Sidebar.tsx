import { MessageSquarePlus, MessageSquare, FolderGit2, Bot, FileOutput, Activity, ShieldAlert, ScrollText, Settings, Moon, Sun } from 'lucide-react';
import { cn } from '../utils/cn';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function Sidebar({ activeTab, setActiveTab, theme, setTheme }: SidebarProps) {
  const getButtonClass = (tabId: string) => cn(
    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group",
    activeTab === tabId 
      ? "bg-bg-panel-hover text-text-main border border-border-subtle shadow-sm font-medium" 
      : "text-text-muted hover:text-text-main hover:bg-bg-panel-hover"
  );

  const getIconClass = (tabId: string) => cn(
    "transition-colors",
    activeTab === tabId ? "text-primary" : "text-text-muted group-hover:text-text-main"
  );

  return (
    <aside className="w-64 bg-bg-panel border-r border-border-subtle flex flex-col shrink-0">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-security">🛡</div>
          <div className="font-semibold text-text-main">Sovereign AI</div>
        </div>
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg-panel-hover rounded-md transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <div className="px-3 mb-6">
          <div className="flex items-center gap-2 bg-bg-main rounded-full px-3 py-1 w-fit border border-border-subtle">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span className="text-xs font-medium text-text-main">Local Mode</span>
          </div>
        </div>

        {/* MAIN NAVIGATION */}
        <div className="mb-6">
          <div className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Main</div>
          <ul className="space-y-1 px-2">
            <li>
              <button onClick={() => setActiveTab('chat')} className={getButtonClass('chat')}>
                <MessageSquarePlus size={16} className={getIconClass('chat')} />
                New Chat
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('history')} className={getButtonClass('history')}>
                <MessageSquare size={16} className={getIconClass('history')} />
                Chats
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('models')} className={getButtonClass('models')}>
                <Bot size={16} className={getIconClass('models')} />
                Model Manager
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('files')} className={getButtonClass('files')}>
                <FolderGit2 size={16} className={getIconClass('files')} />
                Files & Documents
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('agents')} className={getButtonClass('agents')}>
                <Bot size={16} className={getIconClass('agents')} />
                Agents
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('outputs')} className={getButtonClass('outputs')}>
                <FileOutput size={16} className={getIconClass('outputs')} />
                Outputs
              </button>
            </li>
          </ul>
        </div>

        {/* MONITORING NAVIGATION */}
        <div className="mb-6">
          <div className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Monitoring</div>
          <ul className="space-y-1 px-2">
            <li>
              <button onClick={() => setActiveTab('monitor')} className={getButtonClass('monitor')}>
                <Activity size={16} className={getIconClass('monitor')} />
                System Monitor
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('security')} className={getButtonClass('security')}>
                <ShieldAlert size={16} className={getIconClass('security')} />
                Sovereignty Guard
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('logs')} className={getButtonClass('logs')}>
                <ScrollText size={16} className={getIconClass('logs')} />
                Execution Logs
              </button>
            </li>
          </ul>
        </div>
        
        {/* SETTINGS NAVIGATION */}
        <div>
          <div className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Settings</div>
          <ul className="space-y-1 px-2">
            <li>
              <button onClick={() => setActiveTab('settings')} className={getButtonClass('settings')}>
                <Settings size={16} className={getIconClass('settings')} />
                Settings
              </button>
            </li>
          </ul>
        </div>

      </div>
      
      <div className="p-4 border-t border-border-subtle bg-bg-main">
        <div className="bg-bg-panel rounded-lg p-3 border border-border-subtle">
          <div className="flex items-start gap-3 mb-3 border-b border-border-subtle pb-2">
            <div className="w-2 h-2 rounded-full bg-security mt-1.5 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
            <div>
              <div className="text-sm font-medium text-text-main flex items-center gap-1">🛡 All Systems</div>
              <div className="text-xs text-security">Operational</div>
              <div className="text-[10px] text-text-muted mt-0.5">No external network</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-bg-panel flex items-center justify-center text-xs font-bold text-text-main border border-border-subtle">
              EA
            </div>
            <div>
              <div className="text-xs font-medium text-text-main">Engineer</div>
              <div className="text-[10px] text-text-muted">Administrator</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
