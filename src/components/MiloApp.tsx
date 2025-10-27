import React, { useState } from 'react';
import { Sun, Moon, Palette, Heart, Wind, Flower, Home, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface } from './ChatInterface';
import { MoodLogger } from './MoodLogger';
import { QuickCalm } from './QuickCalm';
import { GrowthGarden } from './GrowthGarden';
import { SupportRooms } from './SupportRooms';
import { EmergencyHelp } from './EmergencyHelp';

type ViewType = 'chat' | 'mood' | 'calm' | 'growth' | 'rooms' | 'help';
type MessageColor = 'pink' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'rose';

interface MiloAppProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const MiloApp: React.FC<MiloAppProps> = ({ isDarkMode, onToggleTheme }) => {
  const [currentView, setCurrentView] = useState<ViewType>('chat');
  const [messageColor, setMessageColor] = useState<MessageColor>('pink');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const colorOptions: { value: MessageColor; label: string; gradient: string }[] = [
    { value: 'pink', label: '💖 Classic Pink', gradient: 'var(--gradient-pink)' },
    { value: 'ocean', label: '🌊 Ocean Breeze', gradient: 'var(--gradient-ocean)' },
    { value: 'sunset', label: '☀️ Sunset Glow', gradient: 'var(--gradient-sunset)' },
    { value: 'forest', label: '🌱 Forest Green', gradient: 'var(--gradient-forest)' },
    { value: 'lavender', label: '💜 Lavender Dreams', gradient: 'var(--gradient-lavender)' },
    { value: 'rose', label: '🌹 Rose Garden', gradient: 'var(--gradient-rose)' }
  ];

  const navigationItems = [
    { id: 'chat' as ViewType, icon: Heart, label: 'Chat with Milo', color: 'text-pink-500' },
    { id: 'mood' as ViewType, icon: Heart, label: '📝 Mood Log', color: 'text-blue-500' },
    { id: 'calm' as ViewType, icon: Wind, label: '🌬️ Quick Calm', color: 'text-green-500' },
    { id: 'growth' as ViewType, icon: Flower, label: '🌸 My Growth', color: 'text-purple-500' },
    { id: 'rooms' as ViewType, icon: Home, label: '🏠 Support Rooms', color: 'text-orange-500' },
    { id: 'help' as ViewType, icon: AlertCircle, label: '🚨 Need Help', color: 'text-red-500' },
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'chat':
        return <ChatInterface messageColor={messageColor} />;
      case 'mood':
        return <MoodLogger />;
      case 'calm':
        return <QuickCalm />;
      case 'growth':
        return <GrowthGarden />;
      case 'rooms':
        return <SupportRooms />;
      case 'help':
        return <EmergencyHelp />;
      default:
        return <ChatInterface messageColor={messageColor} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br" style={{ background: 'var(--milo-gradient)' }}>
      {/* Header - Cream/Off-white */}
      <header className="bg-cream border-b border-cream/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">🌸</span>
          </div>
          <div>
            <h1 className="text-cream-foreground font-semibold text-lg">Milo</h1>
            <p className="text-cream-foreground/70 text-xs">Your Digital Buddy</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="text-cream-foreground hover:bg-cream-foreground/10"
            aria-label="Toggle message color picker"
          >
            <Palette className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            className="text-cream-foreground hover:bg-cream-foreground/10"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Color Picker Dropdown */}
      {showColorPicker && (
        <div 
          className="bg-off-white border border-off-white/20 mx-4 mt-2 rounded-lg p-3 shadow-lg"
          role="list"
          aria-label="Message color options"
        >
          <p className="text-off-white-foreground text-sm font-medium mb-2">Choose Message Color</p>
          <div className="grid grid-cols-2 gap-2">
            {colorOptions.map((color) => (
              <button
                key={color.value}
                onClick={() => {
                  setMessageColor(color.value);
                  setShowColorPicker(false);
                }}
                className={`p-2 rounded-lg text-left text-sm transition-all ${
                  messageColor === color.value 
                    ? 'ring-2 ring-primary' 
                    : 'hover:bg-off-white-foreground/10'
                }`}
                style={{ background: messageColor === color.value ? color.gradient : 'transparent' }}
                role="listitem"
              >
                <span className={messageColor === color.value ? 'text-white font-medium' : 'text-off-white-foreground'}>
                  {color.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-off-white border-b border-off-white/20 px-4 py-2">
        <div className="flex space-x-1 overflow-x-auto" role="menu" aria-label="App navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={currentView === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrentView(item.id)}
                className={`whitespace-nowrap text-xs ${
                  currentView === item.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-off-white-foreground hover:bg-off-white-foreground/10'
                }`}
                role="menuitem"
                aria-current={currentView === item.id ? 'page' : undefined}
              >
                <Icon className="w-3 h-3 mr-1" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Render */}
      <main className="flex-1 overflow-auto">
        {renderCurrentView()}
      </main>
    </div>
    
  );
};
