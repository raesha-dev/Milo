import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { saveMood, analyzeSentiment } from '@/lib/api'; // API helpers for backend integration

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

interface Plant {
  id: string;
  name: string;
  stage: number;
  maxStage: number;
  emoji: string;
  growthPoints: number;
}

export const GrowthGarden: React.FC = () => {
  // Helper to calculate stage dynamically from growthPoints
  const calculateStage = (growthPoints: number, maxStage: number) => {
    return Math.min(Math.floor(growthPoints / 25) + 1, maxStage);
  };

  // Initialize plants with stage computed from growthPoints
  const initialPlants: Plant[] = [
    { id: '1', name: 'Mood Flower', growthPoints: 50, maxStage: 5, emoji: '🌸', stage: calculateStage(50, 5) },
    { id: '2', name: 'Calm Tree', growthPoints: 40, maxStage: 4, emoji: '🌳', stage: calculateStage(40, 4) },
    { id: '3', name: 'Confidence Rose', growthPoints: 20, maxStage: 3, emoji: '🌹', stage: calculateStage(20, 3) },
  ];

  const [totalGrowthPoints, setTotalGrowthPoints] = useState(150);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);

  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: '1', title: 'First Steps', description: 'Log your first mood', icon: '👶', unlocked: true, progress: 1, maxProgress: 1 },
    { id: '2', title: 'Consistent Tracker', description: 'Log moods for 7 days', icon: '📅', unlocked: false, progress: 3, maxProgress: 7 },
    { id: '3', title: 'Calm Master', description: 'Complete 10 calm sessions', icon: '🧘‍♀️', unlocked: false, progress: 4, maxProgress: 10 },
    { id: '4', title: 'Garden Keeper', description: 'Reach 200 growth points', icon: '🌻', unlocked: false, progress: totalGrowthPoints, maxProgress: 200 },
  ]);

  // When plants are updated later (e.g., in logMoodAndGrow),
  // recalculate their stage as follows:
  // setPlants(prevPlants =>
  //   prevPlants.map((plant) => {
  //     const newStage = calculateStage(plant.growthPoints, plant.maxStage);
  //     return { ...plant, stage: newStage };
  //   })
  // );

  


  // Calculate emoji based on plant stage
  const getPlantStageEmoji = (plant: Plant) => {
    const stages: Record<number, string> = {
      1: '🌱',
      2: '🌿',
      3: plant.emoji,
      4: plant.emoji + '✨',
      5: plant.emoji + '🌟',
    };
    return stages[Math.min(plant.stage, 5)] || '🌱';
  };

  const getNextPlantStage = (plant: Plant) => {
    if (plant.stage >= plant.maxStage) return null;
    const pointsNeeded = (plant.stage + 1) * 25;
    return pointsNeeded - plant.growthPoints;
  };

  const logMoodAndGrow = async (growthIncrement: number) => {
  const moodEntry = {
    userId: 'anonymous',
    mood: 'happy',
    timestamp: new Date().toISOString(),
    sentiment: { score: 0.8, magnitude: 0.5, classification: 'positive' }
  };

  try {
    await saveMood(moodEntry);

    setTotalGrowthPoints((prevTotal) => {
      const newTotal = prevTotal + growthIncrement;

      setPlants((prevPlants) =>
        prevPlants.map((plant) => {
          if (plant.stage < plant.maxStage) {
            const newPoints = plant.growthPoints + growthIncrement / prevPlants.length;
            const newStage = Math.min(Math.floor(newPoints / 25) + 1, plant.maxStage);
            return {
              ...plant,
              growthPoints: Math.min(newPoints, plant.maxStage * 25),
              stage: newStage,
            };
          }
          return plant;
        })
      );

      setAchievements((prevAchievements) =>
        prevAchievements.map((ach) => {
          if (ach.id === '4') {
            return { ...ach, progress: newTotal, unlocked: newTotal >= ach.maxProgress };
          }
          return ach;
        })
      );

      return newTotal;
    });

  } catch (error) {
    console.error('Error logging mood or updating garden:', error);
  }
};

  // Optional: Example hook or effect could analyze sentiment periodically or on mood change
  // async function analyzeLatestMood(moodText: string) {
  //   const sentimentResponse = await analyzeSentiment(moodText);
  //   console.log('Mood sentiment:', sentimentResponse);
  // }
  // Optional: Example hook or effect could analyze sentiment periodically or on mood change
async function analyzeLatestMood(moodText: string) {
  try {
    const sentimentResponse = await fetch("http://localhost:8080/api/analyze_latest_mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moodText }),
    });

    if (!sentimentResponse.ok) throw new Error("Failed to analyze mood");

    const data = await sentimentResponse.json();
    console.log("Mood sentiment:", data);

    // Safe optional diagnostic – no state change
    return data;
  } catch (error) {
    console.error("Error analyzing mood sentiment:", error);
  }
}


  return (
    <div className="p-4 h-full overflow-y-auto bg-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-white text-2xl font-bold mb-2">🌸 My Growth Garden</h2>
        <p className="text-white/80">Collect new rewards on emotional wellness bloom with every step</p>
      </div>

      {/* Growth Points Overview */}
      <Card className="mb-6 bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🌟 Total Growth Points</span>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {totalGrowthPoints} pts
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Next Milestone</span>
                <span>{Math.ceil(totalGrowthPoints / 100) * 100} pts</span>
              </div>
              <Progress value={totalGrowthPoints % 100} />
              <p className="text-xs text-muted-foreground mt-1">
                {100 - (totalGrowthPoints % 100)} points to unlock new plant! 🌺
              </p>
            </div>
            <Button onClick={() => logMoodAndGrow(10)} className="mt-2 w-full">
              Log Mood & Grow Garden +10 pts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plants Garden */}
      <div className="mb-6">
        <h3 className="text-white text-lg font-semibold mb-3">🏡 Your Plants</h3>
        <div className="grid gap-4">
          {plants.map((plant) => {
            const nextStagePoints = getNextPlantStage(plant);
            return (
              <Card key={plant.id} className="bg-white/90 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-4xl">{getPlantStageEmoji(plant)}</span>
                      <div>
                        <h4 className="font-semibold">{plant.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Stage {plant.stage}/{plant.maxStage}
                        </p>
                      </div>
                    </div>
                    <Badge variant={plant.stage >= plant.maxStage ? 'default' : 'secondary'}>
                      {plant.stage >= plant.maxStage ? 'Fully Grown!' : `${Math.floor(plant.growthPoints)} pts`}
                    </Badge>
                  </div>
                  {plant.stage < plant.maxStage && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Growth Progress</span>
                        <span>{nextStagePoints} pts to next stage</span>
                      </div>
                      <Progress value={((plant.growthPoints % 25) / 25) * 100} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* New Plant Slot */}
          <Card className="bg-white/50 backdrop-blur-sm border-dashed border-2">
            <CardContent className="p-4 text-center">
              <div className="text-4xl mb-2">🌱</div>
              <p className="text-muted-foreground text-sm">
                New plant unlocks at {Math.ceil(totalGrowthPoints / 100) * 100} points!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h3 className="text-white text-lg font-semibold mb-3">🏆 Achievements</h3>
        <div className="grid gap-3">
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className={`${
                achievement.unlocked
                  ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-300'
                  : 'bg-white/90 backdrop-blur-sm'
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`text-2xl ${achievement.unlocked ? 'grayscale-0' : 'grayscale'}`}>
                      {achievement.icon}
                    </span>
                    <div>
                      <h4 className={`font-medium ${achievement.unlocked ? 'text-yellow-800' : ''}`}>
                        {achievement.title}
                      </h4>
                      <p
                        className={`text-sm ${
                          achievement.unlocked ? 'text-yellow-700' : 'text-muted-foreground'
                        }`}
                      >
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {achievement.unlocked ? (
                      <Badge className="bg-yellow-500 text-white">Unlocked!</Badge>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {achievement.progress}/{achievement.maxProgress}
                      </div>
                    )}
                  </div>
                </div>
                {!achievement.unlocked && (
                  <div className="mt-2">
                    <Progress value={(achievement.progress / achievement.maxProgress) * 100} className="h-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
