import { motion } from 'framer-motion';
import { Video, Wand2, ImageIcon, AudioLines, LayoutTemplate, AppWindow, Sparkles } from 'lucide-react';
import type { Screen } from '../store/useNav';

const tabs: { id: Screen; label: string; icon: typeof Video }[] = [
  { id: 'studio', label: 'Studio', icon: Video },
  { id: 'effects', label: 'Effects', icon: Wand2 },
  { id: 'backgrounds', label: 'Backgrounds', icon: ImageIcon },
  { id: 'voice', label: 'Voice', icon: AudioLines },
  { id: 'presets', label: 'Presets', icon: LayoutTemplate },
  { id: 'apps', label: 'Apps', icon: AppWindow },
  { id: 'premium', label: 'Premium', icon: Sparkles },
];

export default function BottomNav({ activeTab, onTabChange }: { activeTab: Screen; onTabChange: (id: Screen) => void }) {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 nav-glass rounded-full px-2 py-1.5">
      <div className="relative flex items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative z-10 flex flex-col items-center gap-1 py-2.5 px-3.5 rounded-full transition-colors duration-200 cursor-pointer ${
                isActive ? 'text-veyra' : 'text-ink-dim hover:text-ink'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-capsule"
                  className="absolute inset-0 rounded-full bg-accent/15 border border-accent/30"
                  style={{ boxShadow: '0 0 20px rgba(124,92,255,0.25), 0 0 40px rgba(124,92,255,0.1)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.8}
                className={`relative z-10 transition-transform duration-200 hover:scale-110 ${isActive ? 'text-veyra' : ''}`}
              />
              <span className="text-[10px] font-medium relative z-10 hidden sm:block">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
