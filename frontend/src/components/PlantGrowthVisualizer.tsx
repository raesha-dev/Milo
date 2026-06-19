import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlantSpecies } from '@/lib/plantSpecies';

interface PlantGrowthVisualizerProps {
  species: PlantSpecies;
  currentWeek: number;
  totalWeeks: number;
}

export const PlantGrowthVisualizer: React.FC<PlantGrowthVisualizerProps> = ({
  species,
  currentWeek,
  totalWeeks
}) => {
  const currentStageIndex = species.stages.findIndex((stage, idx) => {
    const nextStage = species.stages[idx + 1];
    return currentWeek >= stage.week && (!nextStage || currentWeek < nextStage.week);
  });
  
  const currentStage = species.stages[currentStageIndex] || species.stages[0];
  const nextStage = species.stages[currentStageIndex + 1];
  
  const progressToNextStage = nextStage
    ? ((currentWeek - currentStage.week) / (nextStage.week - currentStage.week)) * 100
    : 100;

  return (
    <Card
  className="overflow-hidden"
  style={{
    background: 'linear-gradient(135deg, hsl(40, 40%, 92%), hsl(45, 30%, 98%))'
  }}
>

      <CardContent className="p-4 space-y-3">
        <div className="text-center space-y-1">
          <div className="text-6xl animate-bounce">{currentStage.emoji}</div>
          <h3 className="text-xl font-bold">{currentStage.name}</h3>
          <Badge variant="secondary" className="text-xs">Week {currentWeek} of {totalWeeks}</Badge>
        </div>

        {nextStage && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Next: {nextStage.name}</span>
              <span className="font-semibold">{Math.round(progressToNextStage)}%</span>
            </div>
            <Progress value={progressToNextStage} className="h-2" />
            <p className="text-[10px] text-center text-muted-foreground">
              {nextStage.week - currentWeek} weeks until {nextStage.name}
            </p>
          </div>
        )}

        {!nextStage && (
          <div className="text-center py-2">
            <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm px-4 py-1">
              🏆 Tree Complete!
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Choose a new species to grow</p>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-center text-muted-foreground">
            {species.name} Growth Timeline
          </p>
          <div className="flex justify-between mt-2">
            {species.stages.map((stage, idx) => (
              <div
                key={idx}
                className={`text-center transition-all duration-300 ${
                  currentWeek >= stage.week ? 'scale-110 opacity-100' : 'scale-90 opacity-40'
                }`}
              >
                <div className="text-2xl">{stage.emoji}</div>
                <div className="text-xs mt-1">W{stage.week}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
