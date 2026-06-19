import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  username: string;
  streak: number;
  totalWeeks: number;
  currentPlant: string;
  rewardsEarned: number;
}

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ entries }) => {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-400 fill-amber-400 animate-bounce-in" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400 fill-gray-400 animate-bounce-in" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600 fill-amber-600 animate-bounce-in" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-amber-400/20 to-yellow-400/20 border-amber-400/40';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300/20 to-gray-400/20 border-gray-400/40';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/40';
    return 'bg-card hover:bg-muted/50';
  };

  return (
    <Card style={{ boxShadow: 'var(--shadow-card)' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-6 h-6 text-primary animate-sparkle" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className={`
              flex items-center gap-3 p-3 rounded-xl border transition-all duration-300
              ${getRankBg(entry.rank)}
              hover:scale-[1.02] cursor-pointer
              animate-slide-up
            `}
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            {/* Rank */}
            <div className="flex items-center justify-center w-8">
              {getRankIcon(entry.rank)}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{entry.username}</p>
                <span className="text-lg">{entry.currentPlant}</span>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{entry.streak} day streak</span>
                <span>•</span>
                <span>{entry.totalWeeks} weeks</span>
              </div>
            </div>

            {/* Rewards */}
            <div className="flex flex-col items-end gap-1">
              <Badge 
                variant="secondary" 
                className="text-xs animate-bounce-in"
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                {entry.rewardsEarned} 🎁
              </Badge>
            </div>
          </div>
        ))}

        {/* View More */}
        <div className="text-center pt-2">
          <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            View Full Leaderboard →
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
