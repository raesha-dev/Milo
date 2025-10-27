import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { saveMood as saveMoodBackend, getRecentMoods, getStreakData, updateStreakData, analyzeSentiment, MoodEntry } from '@/lib/api';
import { getOrCreateUserId, loadUserData, saveUserData, appendUserArray } from '@/lib/persistence';
import { Sparkles, Award, Calendar, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MoodOption {
  value: string;
  emoji: string;
  label: string;
}

interface StreakData {
  currentStreak: number;
  weekNumber: number;
  dayOfWeek: number;
  totalDays: number;
  lastLogDate: string;
  rewardEarned: boolean;
}

export const MoodLogger: React.FC = () => {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [manualMoodText, setManualMoodText] = useState('');
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    weekNumber: 0,
    dayOfWeek: 0,
    totalDays: 0,
    lastLogDate: '',
    rewardEarned: false
  });
  const [canLog, setCanLog] = useState(true);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');
  const { toast } = useToast();

  const moodOptions: MoodOption[] = [
    { value: 'amazing', emoji: '🤩', label: 'Amazing' },
    { value: 'happy', emoji: '😊', label: 'Happy' },
    { value: 'calm', emoji: '😌', label: 'Calm' },
    { value: 'okay', emoji: '😐', label: 'Okay' },
    { value: 'anxious', emoji: '😰', label: 'Anxious' },
    { value: 'sad', emoji: '😔', label: 'Sad' },
    { value: 'angry', emoji: '😠', label: 'Angry' },
    { value: 'tired', emoji: '😴', label: 'Tired' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  // Offline sync: push queued moods when device comes online
  const offlineSyncInProgress = useRef(false);
  useEffect(() => {
    const syncOfflineData = async () => {
      if (offlineSyncInProgress.current) return;
      offlineSyncInProgress.current = true;
      try {
        const raw = localStorage.getItem('offline_moods');
        const offlineMoods: MoodEntry[] = raw ? JSON.parse(raw) : [];
        if (offlineMoods.length > 0) {
          for (const m of offlineMoods) {
            try {
              await saveMoodBackend(m);
            } catch (e) {
              console.warn('Failed to sync mood', e);
            }
          }
          localStorage.removeItem('offline_moods');
        }
      } finally {
        offlineSyncInProgress.current = false;
      }
    };

    window.addEventListener('online', syncOfflineData);
    if (navigator.onLine) syncOfflineData();
    return () => window.removeEventListener('online', syncOfflineData);
  }, []);

  // Check if 3.5 hours have passed since last log (timezone-aware)
  useEffect(() => {
    const getLocalDateString = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD

    const parseLocalDate = (dateStr: string) => {
      // dateStr in format YYYY-MM-DD
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const checkLogAvailability = () => {
      const lastLogTimestamp = localStorage.getItem('lastMoodLogTime');

      if (!lastLogTimestamp) {
        setCanLog(true);
        setTimeUntilNext('');
        return;
      }

      const lastLog = new Date(lastLogTimestamp);
      const now = new Date();

      // Use local date strings to avoid timezone shifting issues
      const lastLogLocalStr = getLocalDateString(lastLog);
      const todayLocalStr = getLocalDateString(now);

      // If last log was not today, allow logging (first log of the day)
      if (lastLogLocalStr !== todayLocalStr) {
        setCanLog(true);
        setTimeUntilNext('');
        return;
      }

      // Last log was today, check 3.5 hour requirement using exact timestamps
      const hoursElapsed = (now.getTime() - lastLog.getTime()) / (1000 * 60 * 60);
      const REQUIRED_HOURS = 3.5;

      if (hoursElapsed >= REQUIRED_HOURS) {
        setCanLog(true);
        setTimeUntilNext('');
      } else {
        setCanLog(false);
        const nextAllowed = new Date(lastLog.getTime() + REQUIRED_HOURS * 60 * 60 * 1000);

        // Calculate remaining time
        const remainingMs = nextAllowed.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

        setTimeUntilNext(`${remainingHours}h ${remainingMinutes}m`);
      }
    };

    checkLogAvailability();
    const interval = setInterval(checkLogAvailability, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [moods]);

  const loadData = async () => {
    try {
      const recentMoods = await getRecentMoods();
      const streak = await getStreakData();
      setMoods(recentMoods);
      setStreakData(streak);

      // persist fetched data for quick reload/offline fallback
      try {
        const userId = getOrCreateUserId();
        saveUserData(userId, 'moods', recentMoods);
        saveUserData(userId, 'streakData', streak);
      } catch (e) {
        console.warn('Failed to persist mood data locally', e);
      }
    } catch (error) {
      console.warn('Failed to load data:', error);
      // Fallback to persisted local data when backend unreachable
      try {
        const userId = getOrCreateUserId();
        const localMoods = loadUserData<MoodEntry[]>(userId, 'moods');
        const localStreak = loadUserData<any>(userId, 'streakData');
        if (localMoods) setMoods(localMoods);
        if (localStreak) setStreakData(localStreak as StreakData);
      } catch (e) {
        console.warn('Failed to load persisted mood/streak data', e);
      }
    }
  };

  const calculateStreakUpdate = (lastLogDate: string): StreakData => {
    // Use local date strings (YYYY-MM-DD) to calculate streaks reliably across timezones
    const toLocalDateStr = (d: Date) => d.toLocaleDateString('en-CA');
    const parseLocalDate = (s: string) => {
      if (!s) return null;
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const today = new Date();
    const todayStr = toLocalDateStr(today);

    if (!lastLogDate) {
      // First mood log ever
      return {
        currentStreak: 1,
        weekNumber: 1,
        dayOfWeek: 1,
        totalDays: 1,
        lastLogDate: todayStr,
        rewardEarned: false
      };
    }

    // lastLogDate may already be stored as a local YYYY-MM-DD string or ISO. Try to handle both.
    let lastLogLocalDate: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(lastLogDate)) {
      lastLogLocalDate = parseLocalDate(lastLogDate);
    } else {
      lastLogLocalDate = new Date(lastLogDate);
    }

    if (!lastLogLocalDate) {
      return {
        currentStreak: 1,
        weekNumber: 1,
        dayOfWeek: 1,
        totalDays: 1,
        lastLogDate: todayStr,
        rewardEarned: false
      };
    }

    const lastLogStr = toLocalDateStr(lastLogLocalDate);

    // Already logged today
    if (lastLogStr === todayStr) {
      return streakData;
    }

    // Compute days difference using local dates to avoid DST/timezone drift
    const todayDate = parseLocalDate(todayStr)!;
    const lastDate = parseLocalDate(lastLogStr)!;
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      // Consecutive day
      const newStreak = streakData.currentStreak + 1;
      const newTotalDays = streakData.totalDays + 1;
      const newDayOfWeek = (streakData.dayOfWeek % 7) + 1;
      const newWeekNumber = Math.floor(newTotalDays / 7) + 1;

      // Check for 14-day reward
      const rewardEarned = newStreak === 14;
      if (rewardEarned) {
        toast({
          title: "🎉 Amazing Achievement!",
          description: "You've logged moods for 14 consecutive days! Reward unlocked in Growth Garden!",
          duration: 6000,
        });
      }

      return {
        currentStreak: newStreak,
        weekNumber: newWeekNumber,
        dayOfWeek: newDayOfWeek,
        totalDays: newTotalDays,
        lastLogDate: todayStr,
        rewardEarned
      };
    } else {
      // Streak broken - reset
      toast({
        title: "Streak Reset",
        description: "Missed a day, but that's okay! Starting fresh today. 💜",
        variant: "destructive",
      });

      return {
        currentStreak: 1,
        weekNumber: 1,
        dayOfWeek: 1,
        totalDays: 1,
        lastLogDate: todayStr,
        rewardEarned: false
      };
    }
  };

  const handleMoodSelect = async (mood: MoodOption) => {
    if (!canLog) {
      toast({
        title: "Too Soon!",
        description: `Please wait ${timeUntilNext} before logging your next mood. This helps maintain accurate tracking.`,
        variant: "destructive",
      });
      return;
    }
    await logMood(mood.value, mood.emoji);
  };

  const handleManualMoodEntry = async () => {
    if (!manualMoodText.trim()) return;

    if (!canLog) {
      toast({
        title: "Too Soon!",
        description: `Please wait ${timeUntilNext} before logging your next mood. This helps maintain accurate tracking.`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Use AI to understand the mood
      const sentiment = await analyzeSentiment(manualMoodText);
      
      // Map sentiment to mood
      let moodValue = 'okay';
      let moodEmoji = '😐';
      
      if (sentiment.score > 0.5) {
        moodValue = 'happy';
        moodEmoji = '😊';
      } else if (sentiment.score > 0.8) {
        moodValue = 'amazing';
        moodEmoji = '🤩';
      } else if (sentiment.score < -0.5) {
        moodValue = 'sad';
        moodEmoji = '😔';
      } else if (sentiment.score < -0.8) {
        moodValue = 'anxious';
        moodEmoji = '😰';
      }

      await logMood(moodValue, moodEmoji, manualMoodText);
      setManualMoodText('');
    } catch (error) {
      console.error('Error analyzing mood text:', error);
      toast({
        title: "Error",
        description: "Failed to log mood. Please try again.",
        variant: "destructive",
      });
    }
  };

  const logMood = async (moodValue: string, emoji: string, note?: string) => {
    const newStreak = calculateStreakUpdate(streakData.lastLogDate);
    const now = new Date();

    const newMood: MoodEntry = {
      id: Date.now().toString(),
      mood: moodValue,
      emoji: emoji,
      timestamp: now.toISOString(),
      note: note
    };

    setMoods(prev => [newMood, ...prev]);
    setSelectedMood(moodValue);
    setStreakData(newStreak);

    // Store the timestamp of this log
    localStorage.setItem('lastMoodLogTime', now.toISOString());

    // Persist local copy of moods and streak data for session continuity
    try {
      const userId = getOrCreateUserId();
      appendUserArray(userId, 'moods', newMood, 1000);
      saveUserData(userId, 'streakData', newStreak);
    } catch (e) {
      console.warn('Failed to persist new mood locally', e);
    }

    try {
      // attempt to save to backend; if offline, queue locally
      if (!navigator.onLine) {
        const queued = JSON.parse(localStorage.getItem('offline_moods') || '[]');
        queued.push(newMood);
        localStorage.setItem('offline_moods', JSON.stringify(queued));
        toast({
          title: "Offline",
          description: 'Mood saved locally. It will sync when you are back online.',
        });
      } else {
        await saveMoodBackend(newMood);
      }

      await updateStreakData(newStreak);

      toast({
        title: "Mood Logged! ✨",
        description: `Day ${newStreak.dayOfWeek} of Week ${newStreak.weekNumber}. Next mood can be logged in 3.5 hours.`,
      });
    } catch (e) {
      console.warn('Failed to save mood', e);
      // ensure offline fallback
      const queued = JSON.parse(localStorage.getItem('offline_moods') || '[]');
      queued.push(newMood);
      localStorage.setItem('offline_moods', JSON.stringify(queued));
      toast({
        title: "Saved Locally",
        description: 'Could not reach server, saved locally and will retry when online.',
      });
    }
  };

  const growthPoints = moods.length * 10;
  const streakPercentage = (streakData.currentStreak / 14) * 100;

  return (
    <div className="p-4 h-full overflow-y-auto bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/5 backdrop-blur-sm">
      {/* Header with Streak */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-primary text-3xl font-bold">📝 Mood Logger</h2>
          <Badge className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-2 text-lg">
            <Sparkles className="w-4 h-4 mr-1 inline" />
            {streakData.currentStreak} Day Streak
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Day {streakData.dayOfWeek} of Week {streakData.weekNumber} • Track your journey to wellness 💜
        </p>
      </div>

      {/* Progress to Reward */}
      <Card className="mb-6 bg-gradient-to-br from-primary/90 to-secondary/90 text-white border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span className="flex items-center">
              <Award className="w-5 h-5 mr-2" />
              Reward Progress
            </span>
            <span className="text-sm">{streakData.currentStreak}/14 days</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={streakPercentage} className="h-3 mb-2 bg-white/20" />
          <p className="text-sm text-white/90">
            {14 - streakData.currentStreak} more days to unlock your next reward! 🎁
          </p>
        </CardContent>
      </Card>

      {/* Manual Mood Entry */}
      <Card className="mb-6 bg-white/95 backdrop-blur-sm shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            How are you feeling?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Type your mood or feeling... (e.g., 'Feeling peaceful but tired')"
              value={manualMoodText}
              onChange={(e) => setManualMoodText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualMoodEntry()}
              className="flex-1 border-primary/30 focus:border-primary"
            />
            <Button
              onClick={handleManualMoodEntry}
              className="bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
              disabled={!manualMoodText.trim()}
            >
              Log Mood
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            AI will understand your mood from your text ✨
          </p>
        </CardContent>
      </Card>

      {/* Quick Mood Options */}
      <div className="mb-6">
        <h3 className="text-primary font-semibold mb-3 flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          Quick Select
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {moodOptions.map((mood) => (
            <Button
              key={mood.value}
              onClick={() => handleMoodSelect(mood)}
              className={`h-20 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 hover:from-primary/20 hover:to-secondary/20 border-2 transition-all ${
                selectedMood === mood.value ? 'border-primary shadow-lg scale-105' : 'border-primary/20'
              }`}
              variant="outline"
            >
              <div className="text-3xl mb-1">{mood.emoji}</div>
              <div className="text-xs font-medium text-primary">{mood.label}</div>
            </Button>
          ))}
        </div>
      </div>

      {/* Growth Stats */}
      <Card className="mb-6 bg-white/95 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center text-primary">
            🌸 Your Growth Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Growth Points</span>
                <span className="font-bold text-primary">{growthPoints} pts</span>
              </div>
              <Progress value={growthPoints % 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {100 - (growthPoints % 100)} more points to next milestone! 🌺
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-primary/10 rounded-lg p-2">
                <div className="text-2xl font-bold text-primary">{streakData.currentStreak}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
              <div className="bg-secondary/10 rounded-lg p-2">
                <div className="text-2xl font-bold text-secondary">{streakData.weekNumber}</div>
                <div className="text-xs text-muted-foreground">Weeks</div>
              </div>
              <div className="bg-primary/10 rounded-lg p-2">
                <div className="text-2xl font-bold text-primary">{streakData.totalDays}</div>
                <div className="text-xs text-muted-foreground">Total Days</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Moods */}
      <div>
        <h3 className="text-primary text-lg font-semibold mb-3">Recent Mood Logs</h3>
        <div className="space-y-2">
          {moods.length === 0 ? (
            <Card className="bg-white/95 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <p className="text-muted-foreground">No moods logged yet. Start your journey! 💙</p>
              </CardContent>
            </Card>
          ) : (
            moods.slice(0, 5).map((mood) => {
              const moodData = moodOptions.find(m => m.value === mood.mood);
              return (
                <Card key={mood.id} className="bg-white/95 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-primary">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">{mood.emoji}</span>
                        <div>
                          <p className="font-semibold text-primary">{moodData?.label ?? 'Mood'}</p>
                          {mood.note && (
                            <p className="text-sm text-muted-foreground italic">"{mood.note}"</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">+10 growth points earned! 🌱</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(mood.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Auto-Check Reminder */}
      <Card className="mt-6 bg-gradient-to-br from-secondary/20 to-primary/20 border-primary/30">
        <CardContent className="p-4 text-center">
          <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-sm text-primary font-medium">
            💡 Remember: Log your mood every 3.5 hours for best results!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Consistent tracking helps you understand your patterns better
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
