# Exploratory Data Analysis

## Project

**Explaining and Auditing Emotion Recognition Models for Youth Mental Health Conversations (Milo)**

---

# 1. Dataset Overview

Two benchmark datasets were selected for this study.

| Dataset         | Samples | Emotion Classes |
| --------------- | ------: | --------------: |
| GoEmotions      |  43,410 |              28 |
| DAIR-AI Emotion |  16,000 |               6 |

### Insight

GoEmotions provides substantially finer emotional granularity than DAIR-AI.

DAIR-AI focuses on six broad emotional categories:

```text
anger
fear
joy
love
sadness
surprise
```

In contrast, GoEmotions captures a richer spectrum of emotional states including:

```text
admiration
approval
gratitude
optimism
realization
remorse
pride
embarrassment
```

This makes GoEmotions significantly more challenging and more representative of real-world emotional expression.

---

# 2. Text Statistics

## GoEmotions

| Statistic           |            Value |
| ------------------- | ---------------: |
| Samples             |           43,410 |
| Unique Labels       |              711 |
| Average Text Length | 68.40 characters |
| Maximum Length      |   703 characters |
| Minimum Length      |     2 characters |

## DAIR-AI Emotion

| Statistic           |            Value |
| ------------------- | ---------------: |
| Samples             |           16,000 |
| Emotion Classes     |                6 |
| Average Text Length | 96.85 characters |
| Maximum Length      |   300 characters |
| Minimum Length      |     7 characters |

### Insight

Although DAIR-AI contains fewer samples, its texts are generally longer.

GoEmotions contains shorter and more conversational social-media comments, increasing the likelihood of ambiguous or context-dependent emotional expressions.

---

# 3. Emotion Distribution Analysis

## Most Frequent GoEmotions Classes

| Emotion    |  Count |
| ---------- | -----: |
| Neutral    | 14,219 |
| Admiration |  4,130 |
| Approval   |  2,939 |
| Gratitude  |  2,662 |
| Annoyance  |  2,470 |

### Insight

The dominance of the **neutral** class indicates that most social-media conversations do not express strong emotional signals.

This creates a strong prior toward predicting neutral labels.

A naive classifier could achieve deceptively high accuracy by overpredicting the neutral class.

Therefore:

> Accuracy alone is insufficient for evaluating emotion recognition systems.

Instead, Macro-F1 is adopted as the primary evaluation metric because it treats all emotion classes equally regardless of frequency.

---

# 4. Class Imbalance Analysis

## Most Common Class

```text
neutral = 14,219
```

## Rare Classes

The GoEmotions paper identifies several low-frequency emotions:

```text
grief
relief
realization
```

These classes are significantly underrepresented compared to neutral and admiration.

### Research Insight

The dataset exhibits severe class imbalance.

Expected consequences include:

- Lower recall for rare emotions
- Higher confusion among semantically related emotions
- Lower Macro-F1 despite acceptable overall accuracy

This motivates:

- Class-weighted learning
- Macro-averaged evaluation
- Per-class performance analysis
- Confusion matrix inspection

---

# 5. Multi-Label Analysis

GoEmotions is fundamentally a multi-label dataset.

A single comment may express multiple emotions simultaneously.

Examples:

```text
joy + gratitude

fear + nervousness

sadness + remorse
```

## Distribution

| Labels Per Example |  Count |
| ------------------ | -----: |
| 1                  | 36,308 |
| 2                  |  6,541 |
| 3                  |    532 |
| 4                  |     28 |
| 5                  |      1 |

## Percentages

### Single Emotion

```text
83.64%
```

### Multiple Emotions

```text
16.36%
```

---

### Research Insight

Although the majority of examples contain a single emotion, approximately one in six examples contain multiple emotional labels.

This demonstrates that emotional expression is often overlapping rather than mutually exclusive.

Traditional single-label emotion classification therefore provides only a partial representation of human affect.

---

## Research Implication

For the initial benchmarking stage:

```text
Single-label simplification is acceptable.
```

For future work:

```text
Multi-label emotion classification should be explored.
```

---

# 6. Emotional Complexity

The presence of higher-order label combinations demonstrates the complexity of real-world emotional expression.

| Labels     | Count |
| ---------- | ----: |
| 3 emotions |   532 |
| 4 emotions |    28 |
| 5 emotions |     1 |

### Insight

Emotion recognition systems should not assume the existence of a single dominant emotional state.

This is particularly relevant for mental-health applications where emotions such as:

```text
fear
sadness
nervousness
remorse
```

may occur simultaneously.

---

# 7. Expected Classification Challenges

## Semantically Similar Emotions

Based on findings reported in the GoEmotions paper, common confusions include:

| True Emotion | Confused With |
| ------------ | ------------- |
| Grief        | Sadness       |
| Pride        | Admiration    |
| Nervousness  | Fear          |
| Approval     | Admiration    |
| Gratitude    | Joy           |

### Research Insight

Many classification errors arise from semantic overlap rather than complete misunderstanding.

The model often predicts an emotionally related class instead of an unrelated one.

This motivates:

- Emotion grouping experiments
- Hierarchical evaluation
- Fine-grained error analysis

---

# 8. Importance of Emotion Grouping

The GoEmotions authors evaluated three taxonomic levels.

| Taxonomy           | Macro F1 |
| ------------------ | -------: |
| Full (28 emotions) |     0.46 |
| Ekman Grouping     |     0.64 |
| Sentiment Grouping |     0.69 |

### Insight

A substantial portion of model error originates from distinguishing highly related emotions.

Grouping similar emotions reduces intra-category confusion and significantly improves performance.

This suggests:

> Emotion taxonomy design may be as important as model architecture.

---

# 9. Why DistilBERT Matters

GoEmotions contains:

```text
43,410 samples
```

which is moderate by modern NLP standards.

### Research Question

Can a smaller transformer achieve comparable performance?

DistilBERT is particularly attractive because it is:

- Approximately 40% smaller than BERT
- Approximately 60% faster during inference
- Retains approximately 97% of BERT performance

### Research Value

This enables investigation of:

> Accuracy-efficiency tradeoffs in emotion recognition systems.

Such tradeoffs are critical for real-time deployment in youth mental-health support platforms.

---

# 10. Explainability Motivation

Several emotion categories contain explicit lexical markers.

Examples:

```text
gratitude
love
joy
```

However, other emotions require contextual understanding.

Examples:

```text
realization
confusion
remorse
```

### Research Hypothesis

Classical machine-learning models will primarily rely on explicit keywords.

Transformer models will leverage contextual relationships between words.

This hypothesis will be investigated using SHAP-based explanation techniques.

---

# 11. Fairness and Robustness Motivation

The GoEmotions authors acknowledge several limitations:

- Reddit-specific language
- English-only dataset
- Annotator cultural bias
- Potential demographic bias

### Research Implication

A model trained on GoEmotions may perform differently across linguistic styles.

Potential evaluation groups include:

```text
Standard English

Teen Slang

Internet Language

Informal Social-Media Text
```

This motivates robustness and fairness analysis beyond traditional predictive metrics.

---

# 12. Research Gap

Existing emotion recognition research primarily emphasizes predictive performance.

Important questions remain regarding:

1. Explanation faithfulness
2. Efficiency-performance tradeoffs
3. Robustness to linguistic variation
4. Fairness across communication styles
5. Human-centered mental-health applications

The Milo project addresses these gaps through:

- Classical ML baselines
- Transformer-based models
- SHAP explainability
- Faithfulness testing
- Robustness evaluation
- Efficiency analysis

---

# 13. Key Findings

The exploratory analysis reveals several important characteristics of emotion recognition datasets:

1. GoEmotions provides substantially richer emotional granularity than DAIR-AI.
2. The dataset is highly imbalanced, with Neutral dominating the label distribution.
3. Approximately 16.4% of examples contain multiple emotions.
4. Emotion categories frequently overlap semantically.
5. Macro-F1 is more suitable than Accuracy for evaluation.
6. Emotion grouping substantially improves classification performance.
7. Explainability and robustness remain underexplored areas of emotion recognition research.

These findings directly inform the experimental design and research questions of the Milo project.

---

# Resume Contribution

At this stage, the project already demonstrates:

> Conducted exploratory analysis of the GoEmotions (43k samples, 28 emotions) and DAIR-AI Emotion datasets, identifying class imbalance, multi-label emotion prevalence (16.4%), and taxonomy-level challenges that inform the design of explainable emotion recognition systems for youth mental-health applications.
