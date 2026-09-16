import { useState, useEffect } from 'react';
import TopStatusBar from '../components/TopStatusBar';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import SovereigntyGuard from '../components/SovereigntyGuard';
import BottomDashboard from '../components/BottomDashboard';
import ModelManager from '../components/ModelManager';

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatArea />;
      case 'models':
        return <ModelManager />;
      case 'security':
        return <SovereigntyGuard />;
      case 'monitor':
      case 'outputs':
        return <BottomDashboard />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center text-text-muted flex-col gap-4">
            <div className="text-4xl opacity-50">🚧</div>
            <div>This panel is under construction</div>
          </div>
        );
    }
  };

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden font-sans ${theme} bg-bg-main text-text-main`}>
      
      {/* TOP SYSTEM STATUS BAR */}
      <TopStatusBar />

      {/* MIDDLE SECTION */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} setTheme={setTheme} />

        {/* MAIN DYNAMIC CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-main">
          {renderContent()}
        </div>
        
      </div>
      
    </div>
  );
}
