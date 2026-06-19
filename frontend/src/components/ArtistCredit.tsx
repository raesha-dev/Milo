import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Palette, ExternalLink } from 'lucide-react';

interface Artist {
  name: string;
  handle: string;
  avatar: string;
  rewardsCreated: number;
}

interface ArtistCreditProps {
  artist: Artist;
  rewardName: string;
  animated?: boolean;
}

export const ArtistCredit: React.FC<ArtistCreditProps> = ({ 
  artist, 
  rewardName, 
  animated = false 
}) => {
  return (
    <div 
      className={`
        flex items-center gap-4 p-4 rounded-xl border
        transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer
        ${animated ? 'animate-scale-in' : ''}
      `}
      style={{
        background: 'var(--gradient-glow)',
        borderColor: 'hsl(var(--border))'
      }}
    >
      {/* Artist Avatar */}
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl shadow-lg animate-bounce-in">
          {artist.avatar}
        </div>
      </div>

      {/* Artist Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm truncate">{artist.name}</p>
        </div>
        <p className="text-xs text-muted-foreground truncate">{artist.handle}</p>
        <p className="text-xs text-primary font-medium mt-1">Created "{rewardName}"</p>
      </div>

      {/* Stats */}
      <div className="flex flex-col items-end gap-1">
        <Badge variant="secondary" className="text-xs">
          {artist.rewardsCreated} rewards
        </Badge>
        <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          View <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
