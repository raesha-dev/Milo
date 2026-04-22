# Milo : A Digital Companion for Youth Mental Wellness

## Overview

Milo is an AI-based conversational system designed to support youth mental wellness through continuous, accessible, and empathetic interaction. It is built as an end-to-end system that integrates real-time user input, language understanding, and response generation to provide structured emotional support.

The system is designed not just as a chatbot, but as a behavioral support pipeline that focuses on reliability, safety, and user trust.

---

## Motivation

While building Milo, the primary question that emerged was:

> How can an AI system that interacts with vulnerable users be made reliable, safe, and trustworthy?

This project explores that question through system design, response control, and safety mechanisms rather than focusing only on conversational ability.

---

## Core Features

- **Daily Check-ins**  
  Context-aware messages such as mood prompts, reminders, and encouragement.

- **Mood Tracking System**  
  Users log emotions which are stored and visualized over time to reflect behavioral patterns.

- **Short Calm Practices**  
  Guided exercises (30–60 seconds) designed for quick emotional regulation.

- **Engagement System**  
  A simple reward-based structure to encourage consistent interaction and reflection.

- **Anonymous Support Layer**  
  Allows users to engage without sharing personal identity.

- **Safety Detection System**  
  Detects distress or self-harm related language and triggers:
  - supportive responses
  - escalation pathways to professional help resources

---

## System Architecture

### Frontend
- Built using **React (Vite)**
- Designed to simulate a familiar chat interface (inspired by messaging platforms)
- Focus on accessibility and low cognitive load

### Backend
- **Flask API** handling:
  - request routing
  - conversation flow management
  - safety checks
- Containerized using **Docker**
- Initially deployed on **Google Cloud Run**

### Cloud Transition
- Current deployment uses **Google Cloud**
- System is being transitioned to **Microsoft Azure** for:
  - tighter integration with AI services
  - improved scalability and modular service handling

---

## AI & Data Pipeline

- **Azure OpenAI**
  - Generates conversational responses
  - Controlled prompting for tone and safety

- **Azure NLP Services**
  - Sentiment and emotion detection
  - Used for mood classification and risk signals

- **Azure Cosmos DB / Blob Storage**
  - Stores anonymized interaction data
  - No personally identifiable information is retained

- **Azure Text-to-Speech**
  - Provides guided audio for calm exercises

---

## Design Considerations

### 1. Safety
The system prioritizes detection of harmful or distress signals and ensures responses are supportive, non-harmful, and redirect users when necessary.

### 2. Privacy
All data is anonymized. The system is designed to avoid storing sensitive personal identifiers.

### 3. Reliability
Focus on predictable and controlled behavior rather than unrestricted generation.

### 4. Accessibility
Low-friction interaction model inspired by familiar chat interfaces.

---

## Key Learnings

- Building conversational systems for real users requires more than response generation — it requires behavioral control and safety awareness.
- Handling sensitive domains (like mental wellness) introduces challenges around trust, misuse, and system boundaries.
- System-level design (frontend + backend + AI pipeline) is critical for real-world deployment.

---

## Future Work

- Improved response verification and consistency checks
- Enhanced safety classification models
- Multi-lingual support for broader accessibility
- Deeper integration of explainability in responses
- Continued migration and optimization on Azure infrastructure

---

## Summary

Milo is an attempt to move beyond “chatbot behavior” and towards building AI systems that users can rely on in sensitive, real-world contexts.

The project reflects an interest in not just building AI systems, but understanding how they behave, where they fail, and how they can be made more trustworthy.
