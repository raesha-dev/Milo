# Milo : A Digital Companion for Youth Mental Wellness

## Overview

Milo is an AI-based conversational system designed to support youth mental wellness through a familiar, low-friction interaction model - inspired by social media direct messages.

The system is built around a simple observation: in today’s social media-driven environment, many young people are constantly connected, yet often feel isolated, unnoticed, or emotionally unheard. Moments such as “no one texting back” or silent comparison with others can quietly affect mental well-being.

Milo attempts to exist within this space — not as a replacement for human connection, but as a system that can gently reach out, respond, and provide support when needed.

---

## Motivation

While building Milo, a central question emerged:

> If an AI system interacts with emotionally vulnerable users, how can it be made safe, reliable, and worthy of trust?

This project explores that question through system design, controlled interaction, and safety-aware response generation — focusing not just on what the system says, but how it behaves.

---

## Core Principles

Milo is designed around three foundational principles:

- **Trust** - responses must be predictable, supportive, and non-harmful  
- **Safety** - the system must detect distress and respond responsibly  
- **Anonymity** - users should feel safe interacting without exposing identity  

At the same time, the system must still **reach out meaningfully**, especially in moments when users may not actively seek help.

---

## Features

- **DM-style Interaction (Instagram-inspired)**  
  A familiar chat interface that reduces hesitation and makes interaction feel natural rather than clinical.

- **Proactive Check-ins**  
  Context-aware messages such as emotional check-ins and gentle prompts during periods of inactivity.

- **Mood Tracking**  
  Logging and visualizing emotional patterns over time to support self-awareness.

- **Calm Practices**  
  Short (30–60 second) guided exercises for grounding and stress relief.

- **Anonymous Interaction Layer**  
  No requirement for personal identity, enabling safe and judgment-free interaction.

- **Distress Detection System**  
  Detects signals of emotional distress or harmful intent and responds with:
  - supportive language  
  - de-escalation strategies  
  - suggestions to seek professional help  

---

## Design Considerations

### 1. Social Context Integration

Platforms like Instagram are widely used among youth in India, making DM-style interaction a natural and familiar interface.

Reference:  
https://www.business-standard.com/article/technology/instagram-most-preferred-platform-among-indian-youth-survey-120100900588_1.html

Milo is designed with future potential for integration into such environments, where support can exist within everyday digital interactions.

---

### 2. Colour & Interface Design

The interface uses calm, low-intensity color palettes informed by research in color psychology to reduce anxiety and create a sense of emotional safety.

Reference:  
https://www.researchgate.net/publication/388544060_The_Influence_Of_Colour_On_Social_Media_User_Behaviour_and_Designing_Engagement

---

### 3. Safety over Fluency

The objective is not just fluent conversation, but **controlled and responsible interaction**. Responses are designed to be:

- appropriate  
- non-triggering  
- aligned with user well-being  

---

## System Architecture

### Frontend
- Built using **React (Vite)**
- Lightweight, chat-based interface inspired by social media messaging systems

### Backend
- **Flask API** managing:
  - conversation flow  
  - safety checks  
  - response orchestration  
- Containerized using **Docker**

---

## Cloud Infrastructure

- Initially developed and deployed using **Google Cloud (Cloud Run)**  
- Currently transitioning to **Microsoft Azure**

### Reason for Transition
- Better integration with AI services  
- Improved modularity of system components  
- More scalable architecture for future deployment  

---

## AI Pipeline

- **Azure OpenAI**
  - Controlled conversational response generation

- **Azure NLP Services**
  - Sentiment analysis and distress signal detection

- **Azure Cosmos DB / Blob Storage**
  - Stores anonymized interaction data  
  - No personally identifiable information is retained  

- **Azure Text-to-Speech**
  - Supports guided calm exercises  

---

## Challenges in Building Safe AI Systems

Developing Milo highlighted several challenges:

- **Unpredictability of language models** in sensitive contexts  
- Distinguishing between:
  - casual emotional expression  
  - genuine distress signals  
- Ensuring responses are helpful without being:
  - overly intrusive  
  - dismissive  
- Balancing **anonymity** with the need for escalation in critical situations  

These challenges emphasize that building such systems requires not only engineering, but careful consideration of human behavior and ethical responsibility.

---

## Current Status

This project is **actively under development**.

The current system demonstrates:
- end-to-end conversational pipeline  
- initial safety mechanisms  
- integration with cloud-based AI services  

Ongoing work focuses on improving:
- reliability  
- response consistency  
- safety evaluation methods  

---

## Future Direction

The long-term goal is to explore how systems like Milo could:

- integrate into large-scale social platforms  
- provide accessible support within everyday digital environments  
- function as assistive layers rather than standalone tools  

---

## Closing Note

Milo is not just about building a chatbot.

It is an attempt to understand:
- how AI systems behave in real-world emotional contexts  
- where they fail  
- and how they can be made more trustworthy for the people who might need them the most
