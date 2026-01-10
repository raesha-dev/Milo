import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { generateTTS, playAudioFromUrl } from '@/lib/api'; // <-- New imports for TTS API and audio play helper

interface Exercise {
  id: string;
  title: string;
  duration: number;
  type: 'breathing' | 'gratitude' | 'mindfulness';
  instructions: string[];
  icon: string;
}

export const QuickCalm: React.FC = () => {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const exercises: Exercise[] = [
    {
      id: 'breathing-30s',
      title: '30s Deep Breathing',
      duration: 30,
      type: 'breathing',
      icon: '🫁',
      instructions: [
        'Find a comfortable position',
        'Breathe in slowly for 4 counts',
        'Hold for 4 counts',
        'Breathe out for 6 counts',
        'Repeat until time is up'
      ]
    },
    {
      id: 'gratitude-60s',
      title: '1min Gratitude',
      duration: 60,
      type: 'gratitude',
      icon: '🙏',
      instructions: [
        'Close your eyes gently',
        'Think of 3 things you\'re grateful for',
        'Really feel the appreciation',
        'Let the warmth fill your heart',
        'Smile softly to yourself'
      ]
    },
    {
      id: 'mindfulness-3min',
      title: '3min Body Scan',
      duration: 180,
      type: 'mindfulness',
      icon: '🧘‍♀️',
      instructions: [
        'Sit or lie down comfortably',
        'Start by noticing your breathing',
        'Scan from your toes to your head',
        'Notice any tension without judging',
        'Send kind thoughts to each body part'
      ]
    }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            setIsActive(false);
            // Could trigger completion celebration here
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // New: Play TTS instructions by calling backend and playing audio
  const playTTSInstructions = async (instructions: string[]) => {
    try {
      // Join all instructions into one string
      const textToSpeak = instructions.join('. ');
      // Call backend to get audio URL
      const response = await generateTTS(textToSpeak);
      if (response.audio_url) {
        await playAudioFromUrl(response.audio_url);
      }
    } catch (err) {
      console.warn('TTS playback failed:', err);
    }
  };

  const startExercise = async (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setTimeLeft(exercise.duration);
    setCurrentStep(0);
    setIsActive(true);

    // Play the instructions using TTS
    await playTTSInstructions(exercise.instructions);
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetExercise = () => {
    setIsActive(false);
    setTimeLeft(selectedExercise?.duration || 0);
    setCurrentStep(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-white text-2xl font-bold mb-2">🌬️ Quick Calm</h2>
        <p className="text-white/80">Take a moment to breathe and center yourself</p>
      </div>

      {!selectedExercise ? (
        /* Exercise Selection */
        <div className="grid gap-4">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="bg-cream/90 backdrop-blur-sm cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{exercise.icon}</span>
                    <div>
                      <h3 className="font-semibold">{exercise.title}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {exercise.type} • {exercise.duration < 60 ? `${exercise.duration}s` : `${Math.floor(exercise.duration/60)}min`}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => startExercise(exercise)}
                    className="bg-gradient-to-r from-green-400 to-blue-500 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Motivational Card */}
          <Card className="bg-gradient-to-r from-purple-400 to-pink-500 text-white">
            <CardContent className="p-4 text-center">
              <h3 className="font-semibold mb-2">💙 You've got this!</h3>
              <p className="text-sm text-white/90">
                Even 30 seconds of calm can make a huge difference in your day.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Active Exercise */
        <div className="space-y-6">
          <Card className="bg-cream/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  {selectedExercise.icon} {selectedExercise.title}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedExercise(null)}
                  className="text-muted-foreground"
                >
                  ✕
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Timer Display */}
              <div className="text-center mb-6">
                <div className="text-6xl font-bold text-primary mb-2">
                  {formatTime(timeLeft)}
                </div>
                <Progress 
                  value={((selectedExercise.duration - timeLeft) / selectedExercise.duration) * 100} 
                  className="w-full h-2 mb-4"
                />
                <div className="flex justify-center space-x-4">
                  <Button onClick={toggleTimer} variant="outline">
                    {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button onClick={resetExercise} variant="outline">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                <h4 className="font-semibold text-center">Follow these steps:</h4>
                {selectedExercise.instructions.map((instruction, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      index === currentStep 
                        ? 'bg-primary/10 border-primary text-primary' 
                        : 'bg-muted/50 border-muted text-muted-foreground'
                    }`}
                  >
                    <p className="text-sm">{instruction}</p>
                  </div>
                ))}
              </div>

              {timeLeft === 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <h4 className="font-semibold text-green-800 mb-2">🎉 Well Done!</h4>
                  <p className="text-green-700 text-sm mb-3">
                    You've completed your calm session. How are you feeling?
                  </p>
                  <div className="flex justify-center space-x-2">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300">
                      😌 Relaxed
                    </Button>
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300">
                      🧘‍♀️ Centered
                    </Button>
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300">
                      💚 Better
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
