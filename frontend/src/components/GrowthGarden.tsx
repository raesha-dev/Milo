import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getStreakData, StreakData } from '@/lib/api';
import { getOrCreateUserId, loadUserData, saveUserData } from '@/lib/persistence';
import { plantSpecies } from '@/lib/plantSpecies';
import { PlantGrowthVisualizer } from './PlantGrowthVisualizer';
import { RewardGallery } from './RewardGallery';
import { LeaderboardCard } from './LeaderboardCard';
import { ArtistCredit } from './ArtistCredit';
import { Sparkles, Trophy, Award, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Confetti } from './Confetti.tsx';

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

interface RewardCycleWinner {
  username: string;
  rewardName: string;
  artist: {
    name: string;
    handle: string;
    avatar: string;
    rewardsCreated: number;
  };
}

export const GrowthGarden: React.FC = () => {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState('cherry');
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showRewardCycle, setShowRewardCycle] = useState(false);
  const [cycleWinners, setCycleWinners] = useState<RewardCycleWinner[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast } = useToast();

  // Mock leaderboard data
  const leaderboardEntries = [
    { rank: 1, username: 'Alice', streak: 28, totalWeeks: 4, currentPlant: '🌸', rewardsEarned: 8 },
    { rank: 2, username: 'Bob', streak: 21, totalWeeks: 3, currentPlant: '🌲', rewardsEarned: 6 },
    { rank: 3, username: 'Clara', streak: 14, totalWeeks: 2, currentPlant: '🍁', rewardsEarned: 4 },
    { rank: 4, username: 'David', streak: 14, totalWeeks: 2, currentPlant: '🌸', rewardsEarned: 3 },
    { rank: 5, username: 'Emma', streak: 7, totalWeeks: 1, currentPlant: '🌱', rewardsEarned: 2 },
  ];

  // Initialize rewards
  useEffect(() => {
    const initialRewards: Reward[] = [
      {
        id: '1',
        name: 'Cozy Theme',
        type: 'sticker',
        artist: 'Arya Smith',
        artistHandle: '@artist_arya',
        imageUrl: '✨',
        unlocked: false,
        rarity: 'common'
      },
      {
        id: '2',
        name: 'Trendy Vibe',
        type: 'sticker',
        artist: 'Reese Johnson',
        artistHandle: '@artist_reese',
        imageUrl: '🎨',
        unlocked: false,
        rarity: 'rare'
      },
      {
        id: '3',
        name: 'Galaxy Avatar',
        type: 'avatar',
        artist: 'Luna Park',
        artistHandle: '@luna_creates',
        imageUrl: '🌌',
        unlocked: false,
        rarity: 'legendary'
      },
      {
        id: '4',
        name: 'Growth Badge',
        type: 'badge',
        artist: 'Max Chen',
        artistHandle: '@maxchenart',
        imageUrl: '🏆',
        unlocked: false,
        rarity: 'rare'
      },
      {
        id: '5',
        name: 'Zen Garden',
        type: 'sticker',
        artist: 'Sarah Kim',
        artistHandle: '@zen_sarah',
        imageUrl: '🧘',
        unlocked: false,
        rarity: 'common'
      },
      {
        id: '6',
        name: 'Rainbow Avatar',
        type: 'avatar',
        artist: 'Alex Rivera',
        artistHandle: '@alex_colors',
        imageUrl: '🌈',
        unlocked: false,
        rarity: 'legendary'
      }
    ];
    setRewards(initialRewards);
  }, []);

  // Load streak data from MoodLogger
  useEffect(() => {
    const loadStreakData = async () => {
      try {
        const data = await getStreakData();
        setStreakData(data);

        // persist streak data for quick reload/offline fallback
        try {
          const userId = getOrCreateUserId();
          saveUserData(userId, 'streakData', data);
        } catch (err) {
          console.warn('Failed to persist streak data locally', err);
        }

        // Calculate weeks based on total days
        const weeks = Math.floor(data.totalDays / 7);
        setTotalWeeks(weeks);
        setCurrentWeek(weeks);
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://milo-backend-73215611303.asia-south1.run.app';


        // Try to fetch persisted rewards from backend
        try {
          const userId = getOrCreateUserId();
          const res = await fetch(`${BACKEND_URL}/api/rewards?userId=${encodeURIComponent(userId)}`);


          if (res.ok) {
            const payload = await res.json();
            if (Array.isArray(payload.rewards)) {
              setRewards(payload.rewards);
              return;
            }
          }
        } catch (err) {
          // silently fall back to client-side rewards
          console.warn('Failed to load persisted rewards:', err);
        }

        // Unlock rewards every 2 weeks (client fallback)
        const rewardsToUnlock = Math.floor(weeks / 2);
        setRewards(prev => 
          prev.map((reward, idx) => ({
            ...reward,
            unlocked: idx < rewardsToUnlock
          }))
        );
      } catch (err) {
        console.warn('Failed to load streak data:', err);
        // try to load persisted streak data
        try {
          const userId = getOrCreateUserId();
          const local = loadUserData<StreakData>(userId, 'streakData');
          if (local) {
            setStreakData(local);
            const weeks = Math.floor(local.totalDays / 7);
            setTotalWeeks(weeks);
            setCurrentWeek(weeks);
            const rewardsToUnlock = Math.floor(weeks / 2);
            setRewards(prev => prev.map((reward, idx) => ({ ...reward, unlocked: idx < rewardsToUnlock })));
            return;
          }
        } catch (e) {
          console.warn('Failed to load persisted streak data', e);
        }
      }
    };

    loadStreakData();

    // Refresh every minute to catch updates
    const interval = setInterval(loadStreakData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Unlock a reward via backend and fetch signed asset URL if available
  const unlockReward = async (rewardId: string) => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    
    try {
      const res = await fetch('/api/rewards/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId })
      });

      if (!res.ok) {
        throw new Error(`Unlock failed: ${res.statusText}`);
      }

      const payload = await res.json();
      // payload.reward could include updated unlocked state and imageUrl (signed)
      setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, ...payload.reward } : r));
      toast({ 
        title: '🎉 Reward unlocked!', 
        description: payload.reward?.name || 'New reward available' 
      });
    } catch (err) {
      console.warn('Unlock reward failed, falling back to client unlock:', err);
      // Fallback: unlock locally
      setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, unlocked: true } : r));
      toast({ 
        title: '✨ Reward unlocked!', 
        description: 'Reward unlocked locally due to network issues' 
      });
    }
  };

  // Ensure rewards unlocking happens sequentially and only once per milestone
  const unlockingRef = useRef(false);
  useEffect(() => {
    const tryAutoUnlock = async () => {
      if (!streakData || unlockingRef.current) return;
      // only auto-unlock when a 14-day streak (or multiples) reached
      if (streakData.currentStreak >= 14) {
        // use a local marker to avoid duplicate unlocks across reloads
        const key = `rewards_unlocked_until_${streakData.currentStreak}`;
        if (localStorage.getItem(key)) return;

        unlockingRef.current = true;
        try {
          // find next locked reward(s) and unlock one by one
          const locked = rewards.filter(r => !r.unlocked);
          for (const r of locked.slice(0, 1)) { // unlock one by default
            await unlockReward(r.id);
            // small pause for UX
            await new Promise(res => setTimeout(res, 500));
          }
          localStorage.setItem(key, '1');
        } catch (err) {
          console.warn('Auto-unlock failed', err);
        } finally {
          unlockingRef.current = false;
        }
      }
    };

    tryAutoUnlock();
  }, [streakData, rewards]);

  const selectedPlant = plantSpecies.find(p => p.id === selectedPlantId) || plantSpecies[0];
  const progressPercentage = streakData ? (streakData.currentStreak / 14) * 100 : 0;

  const handleRunRewardCycle = () => {
    // Mock reward cycle - randomly select winners
    const mockWinners: RewardCycleWinner[] = [
      {
        username: 'Alice',
        rewardName: 'Cozy Theme',
        artist: {
          name: 'Arya Smith',
          handle: '@artist_arya',
          avatar: '👩‍🎨',
          rewardsCreated: 12
        }
      },
      {
        username: 'Clara',
        rewardName: 'Trendy Vibe',
        artist: {
          name: 'Reese Johnson',
          handle: '@artist_reese',
          avatar: '🎨',
          rewardsCreated: 8
        }
      },
      {
        username: 'Bob',
        rewardName: 'Galaxy Avatar',
        artist: {
          name: 'Luna Park',
          handle: '@luna_creates',
          avatar: '🌙',
          rewardsCreated: 15
        }
      }
    ];

    setCycleWinners(mockWinners);
    setShowRewardCycle(true);
    setShowConfetti(true);
    
    toast({
      title: '🎉 Reward Cycle Complete!',
      description: `${mockWinners.length} users earned new rewards!`,
    });

    // Simulate unlocking rewards
    setRewards(prev => 
      prev.map((reward, idx) => ({
        ...reward,
        unlocked: idx < 3 ? true : reward.unlocked
      }))
    );

    // Hide confetti after 3 seconds
    setTimeout(() => setShowConfetti(false), 3000);
  };

  if (!streakData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin text-6xl">🌱</div>
      </div>
    );
  }

  return (
    <>
    <div className="growthgarden">
      <Confetti active={showConfetti} />
      <div className="w-full p-3 md:p-6 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="text-center space-y-3 animate-fade-in pt-4">
          <div className="inline-block">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow-pulse">
              🌳 Growth Garden
            </h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Nurture your consistency, watch your growth bloom ✨
          </p>
        </div>

        {/* Streak Overview */}
        <Card 
          className="animate-scale-in border-2 overflow-hidden relative group"
          style={{ 
            boxShadow: 'var(--shadow-card)',
            background: 'var(--gradient-card)'
          }}
        >
          {/* Decorative Glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
            style={{ background: 'var(--gradient-glow)' }} 
          />
          
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-xl bg-primary/10">
                <Sparkles className="w-7 h-7 text-primary animate-sparkle" />
              </div>
              Current Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-bounce-in">
                  {streakData.currentStreak}
                </p>
                <p className="text-sm text-muted-foreground font-medium">days streak 🔥</p>
              </div>
              <Badge 
                className="text-base px-4 py-2 animate-bounce-in"
                style={{ 
                  background: 'var(--gradient-primary)',
                  animationDelay: '0.2s'
                }}
              >
                Week {currentWeek}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress to next reward</span>
                <span className="text-lg font-bold text-primary">{Math.min(progressPercentage, 100).toFixed(0)}%</span>
              </div>
              
              {/* Enhanced Progress Bar */}
              <div className="relative h-4 bg-secondary rounded-full overflow-hidden shadow-inner">
                <div 
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 animate-glow-pulse"
                  style={{ 
                    width: `${progressPercentage}%`,
                    background: 'var(--gradient-primary)'
                  }}
                />
              </div>
              
              <div className={`
                text-center p-4 rounded-xl transition-all duration-500
                ${streakData.currentStreak >= 14 
                  ? 'animate-reward-pop' 
                  : ''
                }
              `}
                style={{
                  background: streakData.currentStreak >= 14 
                    ? 'var(--gradient-celebration)' 
                    : 'var(--gradient-glow)'
                }}
              >
                <p className="text-sm font-semibold">
                  {streakData.currentStreak >= 14 
                    ? '🎉 You\'ve earned a reward! Keep the momentum going!' 
                    : `✨ ${14 - streakData.currentStreak} more days until your next reward`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plant Selection */}
        <Card 
          className="animate-fade-in border-2 overflow-hidden"
          style={{ 
            boxShadow: 'var(--shadow-card)',
            background: 'var(--gradient-card)'
          }}
        >
          <CardHeader>
            <CardTitle className="text-xl">🌺 Choose Your Growth Journey</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {plantSpecies.map((plant, idx) => (
                <button
                  key={plant.id}
                  onClick={() => setSelectedPlantId(plant.id)}
                  className={`
                    relative h-auto py-6 px-4 flex flex-col gap-2 items-center
                    rounded-2xl border-2 transition-all duration-500
                    hover:scale-105 hover:shadow-xl
                    animate-scale-in
                    ${selectedPlantId === plant.id 
                      ? 'border-primary shadow-lg' 
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                  style={{
                    background: selectedPlantId === plant.id 
                      ? 'var(--gradient-glow)' 
                      : 'var(--card)',
                    animationDelay: `${idx * 0.1}s`
                  }}
                >
                  {selectedPlantId === plant.id && (
                    <div className="absolute top-2 right-2 animate-bounce-in">
                      <Sparkles className="w-5 h-5 text-primary fill-primary" />
                    </div>
                  )}
                  <span className="text-4xl transition-transform duration-300 hover:scale-110">
                    {plant.stages[plant.stages.length - 1].emoji}
                  </span>
                  <span className="text-sm font-semibold text-center">{plant.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Plant Growth Visualizer */}
        <div className="animate-plant-grow">
          <PlantGrowthVisualizer
            species={selectedPlant}
            currentWeek={currentWeek}
            totalWeeks={totalWeeks}
          />
        </div>

        {/* Reward Gallery */}
        <Card 
          className="border-2 overflow-hidden"
          style={{ 
            boxShadow: 'var(--shadow-reward)',
            background: 'var(--gradient-card)'
          }}
        >
          <CardHeader className="relative overflow-hidden">
            <div className="absolute inset-0 opacity-10"
              style={{ background: 'var(--gradient-reward)' }}
            />
            <CardTitle className="flex items-center gap-3 text-2xl relative">
              <div className="p-2 rounded-xl bg-accent/10">
                <Gift className="w-7 h-7 text-accent animate-sparkle" />
              </div>
              Your Rewards Collection
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <RewardGallery rewards={rewards} />
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <div className="animate-fade-in">
          <LeaderboardCard entries={leaderboardEntries} />
        </div>

        {/* Admin: Run Reward Cycle */}
        <Card 
          className="border-2"
          style={{ 
            boxShadow: 'var(--shadow-card)',
            background: 'var(--gradient-card)'
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-xl bg-accent/10">
                <Award className="w-6 h-6 text-accent animate-sparkle" />
              </div>
              Admin: Reward Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="p-4 rounded-xl" style={{ background: 'var(--gradient-glow)' }}>
              <p className="text-sm font-medium">
                Run the reward cycle to distribute rewards to all users who completed 2 weeks of consistent mood logging.
              </p>
            </div>
            <button
              onClick={handleRunRewardCycle}
              className="w-full py-4 px-6 rounded-xl font-semibold text-lg
                transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl
                flex items-center justify-center gap-3"
              style={{ 
                background: 'var(--gradient-celebration)',
                color: 'hsl(var(--celebration-foreground))',
                boxShadow: 'var(--shadow-elegant)'
              }}
            >
              <Trophy className="w-6 h-6" />
              Run Reward Cycle
            </button>

            {showRewardCycle && cycleWinners.length > 0 && (
              <div className="space-y-4 mt-6 animate-fade-in">
                <h3 className="font-semibold text-lg">🎉 Latest Winners</h3>
                <div className="space-y-3">
                  {cycleWinners.map((winner, idx) => (
                    <ArtistCredit
                      key={idx}
                      artist={winner.artist}
                      rewardName={winner.rewardName}
                      animated={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Artist Credits Info */}
        <Card 
          className="border-2"
          style={{ 
            boxShadow: 'var(--shadow-card)',
            background: 'var(--gradient-card)'
          }}
        >
          <CardHeader>
            <CardTitle className="text-xl">💝 About Rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm leading-relaxed">
              All stickers, avatars, and badges are created by talented artists in our community. 
              Artists can submit their work and get featured when users earn their rewards!
            </p>
            <div 
              className="p-6 rounded-2xl border-2 border-primary/20 transition-all duration-500 hover:scale-[1.02] cursor-pointer"
              style={{ background: 'var(--gradient-glow)' }}
            >
              <p className="text-base font-semibold mb-2 flex items-center gap-2">
                <span>🎨</span> Want to contribute as an artist?
              </p>
              <p className="text-sm text-muted-foreground">
                Submit your artwork and promote your work through our reward system!
              </p>
              <div className="mt-4 inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                Learn More →
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
      </div>
    </>
  );
};
