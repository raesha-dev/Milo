import React, { useState, useEffect } from 'react';
import { MiloApp } from '@/components/MiloApp';

const Index = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check for saved theme preference or default to light mode
    const saved = localStorage.getItem('milo-theme');
    return saved === 'dark';
  });

  useEffect(() => {
    // Apply theme to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save theme preference
    localStorage.setItem('milo-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <div className="w-full">
      <MiloApp isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />
    </div> 
  );
};




export default Index;
