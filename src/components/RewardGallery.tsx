import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, Star } from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  type: 'sticker' | 'avatar' | 'badge';
  artist: string;
  artistHandle: string;
  imageUrl: string;
  unlocked: boolean;
  rarity: 'common' | 'rare' | 'legendary';
}

interface RewardGalleryProps {
  rewards: Reward[];
}

const rarityConfig = {
  common: {
    gradient: 'from-blue-400 to-cyan-400',
    glow: 'shadow-blue-400/50',
    label: 'Common'
  },
  rare: {
    gradient: 'from-purple-400 to-pink-400',
    glow: 'shadow-purple-400/50',
    label: 'Rare'
  },
  legendary: {
    gradient: 'from-amber-400 via-orange-400 to-red-400',
    glow: 'shadow-amber-400/50',
    label: 'Legendary'
  }
};

export const RewardGallery: React.FC<RewardGalleryProps> = ({ rewards }) => {
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 justify-center text-sm">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">
            {rewards.filter(r => r.unlocked).length}
          </p>
          <p className="text-muted-foreground">Unlocked</p>
        </div>
        <div className="h-12 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold text-muted-foreground">
            {rewards.length}
          </p>
          <p className="text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {rewards.map((reward, idx) => {
          const rarity = rarityConfig[reward.rarity];
          
          return (
            <div
              key={reward.id}
              onClick={() => setSelectedReward(reward)}
              className={`
                relative aspect-square rounded-xl p-4 cursor-pointer
                transition-all duration-500 hover:scale-105
                ${reward.unlocked 
                  ? 'bg-gradient-to-br shadow-lg hover:shadow-xl animate-bounce-in' 
                  : 'bg-muted opacity-50 hover:opacity-70'
                }
              `}
              style={{
                background: reward.unlocked 
                  ? `linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.1))`
                  : undefined,
                animationDelay: `${idx * 0.05}s`
              }}
            >
              {/* Rarity Indicator */}
              {reward.unlocked && (
                <div className={`absolute top-1 right-1 animate-sparkle`}>
                  {reward.rarity === 'legendary' && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                  {reward.rarity === 'rare' && <Sparkles className="w-3 h-3 text-purple-400" />}
                </div>
              )}

              {/* Reward Content */}
              <div className="flex flex-col items-center justify-center h-full gap-2">
                {reward.unlocked ? (
                  <>
                    <div className="text-4xl animate-reward-pop" style={{ animationDelay: `${idx * 0.1}s` }}>
                      {reward.imageUrl}
                    </div>
                    <p className="text-xs font-medium text-center line-clamp-1">
                      {reward.name}
                    </p>
                  </>
                ) : (
                  <>
                    <Lock className="w-8 h-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center">
                      Locked
                    </p>
                  </>
                )}
              </div>

              {/* New Badge */}
              {reward.unlocked && idx < 3 && (
                <Badge 
                  className="absolute -top-2 -right-2 text-xs animate-bounce-in"
                  style={{ 
                    background: 'var(--gradient-celebration)',
                    animationDelay: `${idx * 0.1}s`
                  }}
                >
                  New!
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Reward Details */}
      {selectedReward && (
        <div 
          className="p-6 rounded-2xl border-2 animate-scale-in"
          style={{
            background: selectedReward.unlocked 
              ? 'var(--gradient-glow)' 
              : 'var(--gradient-card)',
            borderColor: selectedReward.unlocked ? 'hsl(var(--primary))' : 'hsl(var(--border))'
          }}
        >
          <div className="flex items-start gap-4">
            <div className="text-6xl animate-reward-pop">
              {selectedReward.unlocked ? selectedReward.imageUrl : '🔒'}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{selectedReward.name}</h3>
                <Badge 
                  className={`bg-gradient-to-r ${rarityConfig[selectedReward.rarity].gradient}`}
                >
                  {rarityConfig[selectedReward.rarity].label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Created by <span className="font-semibold text-foreground">{selectedReward.artist}</span>
                </p>
                <p className="text-xs text-muted-foreground">{selectedReward.artistHandle}</p>
              </div>
              <Badge variant="secondary" className="mt-2">
                {selectedReward.type}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
