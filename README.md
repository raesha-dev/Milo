# Welcome to our Project MILO
## Project info

Milo — Your Digital Buddy for Youth Mental Wellness  :D

Milo is a friendly digital companion designed to support youth mental wellness. It lives inside an Instagram-style chat and offers daily check-ins, encouragement, mood tracking, and safe support — like a friend who’s always there.


Features

Daily Friendly DMs: Milo sends check-ins, birthday wishes, or encouragement messages.

Mood Logging: Track your emotions, which visually bloom into a flower garden over time.

Calm Practices: Quick 30-second exercises for stress relief and mindfulness.

Gamified Emotional Growth: Track progress in a fun, engaging way.

Anonymous Support Rooms: Connect with peers who share similar feelings.

Safety Net: Detects risky or self-harm language, comforts the user, and guides them to professional help.

How It Works...

Frontend: Built with Vite + React, designed to mimic Instagram DMs.

Backend: Flask API running in Docker, deployed on Google Cloud Run for now.  // Note: Future will be shifted to Azure static web apps

AI & Azure Services used in mvp for now //credits required for live demonstration, solution is end to end ready with fallbacks:

Azure OpenAI : Powers Milo’s personality and friendly conversation.  

Azure NLP: Analyzes moods and sentiment.

Azure storage/ blob storage/ cosmos db: Stores mood logs anonymously, no personal data saved.

Azure TTS: Provides a soothing voice for mindfulness exercises.
