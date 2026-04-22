# Milo — A Digital Companion for Youth Mental Wellness

## Overview

Milo is an AI-based conversational system designed to support youth mental wellness through a familiar, low-friction interaction model — similar to social media direct messages.

The idea behind Milo comes from a simple observation: in today’s social media-driven environment, many young people spend hours online, yet still feel isolated, unnoticed, or emotionally unheard. Moments like “no one texting back” or constant comparison with others can quietly affect mental well-being.

Milo attempts to exist within this space — not as a replacement for human connection, but as a system that can gently reach out, respond, and provide support when needed.

---

## Motivation

While building Milo, a central question emerged:

> If an AI system is interacting with emotionally vulnerable users, how can it be made safe, reliable, and worthy of trust?

This project is an attempt to explore that question through system design, controlled interaction, and safety-aware response generation.

---

## Core Idea

Milo is designed around three principles:

- **Trust** — responses should be predictable, supportive, and non-harmful  
- **Safety** — the system must detect distress and respond responsibly  
- **Anonymity** — users should feel safe interacting without exposing personal identity  

At the same time, the system must still **reach out meaningfully**, especially when a user may not actively seek help.

---

## Features

- **DM-style Interaction (Instagram-inspired)**  
  A familiar chat interface to reduce hesitation and cognitive load, designed to feel like a natural conversation rather than a clinical tool.

- **Proactive Check-ins**  
  Gentle messages such as “How are you feeling today?” or small nudges that simulate social interaction in moments of silence.

- **Mood Tracking**  
  Users can log emotions over time, helping identify patterns in behavior and mental state.

- **Calm Practices**  
  Short, guided exercises (30–60 seconds) for grounding and stress relief.

- **Anonymous Interaction Layer**  
  No requirement for personal identity, allowing users to engage without fear of judgment.

- **Distress Detection System**  
  Identifies signals of emotional distress or harmful intent and responds with:
  - supportive language  
  - de-escalation strategies  
  - suggestions to seek professional help  

---

## Design Considerations

### 1. Social Context Integration
Research shows that platforms like Instagram are among the most used by youth. Milo adopts a DM-style interface to meet users where they already are, with future scope for integration into social platforms.

### 2. Colour & Interface Design
The interface is designed using calm, low-intensity color palettes inspired by color psychology research, aiming to reduce anxiety and create a sense of emotional safety.

### 3. Safety over Fluency
The goal is not just to generate fluent responses, but to ensure that responses are:
- appropriate  
- non-triggering  
- aligned with user well-being  

---

## System Architecture

### Frontend
- Built using **React (Vite)**
- Designed as a lightweight, chat-based interface inspired by social media DMs

### Backend
- **Flask API** handling:
  - conversation flow  
  - safety checks  
  - response orchestration  
- Containerized with **Docker**

### Cloud Infrastructure
- Initially deployed using **Google Cloud Run**
- Currently transitioning to **Microsoft Azure** for:
  - tighter integration with AI services  
  - better modularity and scalability  

---

## AI Pipeline

- **Azure OpenAI**
  - Generates conversational responses with controlled prompting

- **Azure NLP Services**
  - Detects sentiment, mood, and potential risk signals

- **Azure Cosmos DB / Blob Storage**
  - Stores anonymized interaction data
  - No personally identifiable information is retained

- **Azure Text-to-Speech**
  - Supports guided calm exercises

---

## Challenges in Building Safe AI Systems

Working on Milo highlighted several challenges:

- **Unpredictability of language models** in sensitive contexts  
- Difficulty in distinguishing between:
  - casual expressions  
  - genuine distress signals  
- Ensuring responses are helpful without being:
  - overly intrusive  
  - dismissive  
- Balancing **anonymity** with the need to escalate serious situations  

These challenges reinforce that building such systems requires not just engineering, but careful consideration of human behavior and ethical responsibility.

---

## Current Status

This project is **actively under development**.

The current system demonstrates:
- end-to-end conversational flow  
- basic safety mechanisms  
- integration with cloud-based AI services  

However, improving reliability, safety guarantees, and evaluation methods remains an ongoing effort.

---

## Future Direction

The long-term vision is to explore how systems like Milo could:

- be integrated into large-scale social platforms  
- provide safe, accessible support within everyday digital environments  
- operate as assistive layers rather than standalone tools  

---

## Closing Note

Milo is not just about building a chatbot.

It is an attempt to understand:
- how AI systems behave in real-world emotional contexts  
- where they fail  
- and how they can be made more trustworthy for the people who might need them the most
