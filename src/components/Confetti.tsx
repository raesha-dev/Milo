import React, { useEffect, useState } from 'react';

interface ConfettiProps {
  active?: boolean;
  duration?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({ 
  active = false, 
  duration = 3000 
}) => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    if (active) {
      const colors = [
        'hsl(270, 65%, 65%)',
        'hsl(240, 70%, 70%)',
        'hsl(320, 60%, 75%)',
        'hsl(280, 60%, 75%)',
        'hsl(220, 50%, 75%)',
        'hsl(260, 65%, 70%)',
      ];

      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));

      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [active, duration]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 animate-confetti opacity-0"
          style={{
            left: `${particle.left}%`,
            top: '-10px',
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0%',
          }}
        />
      ))}
    </div>
  );
};
