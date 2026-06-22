# Research Questions

## Project Title

**Trustworthy Emotion Intelligence for Youth Mental Health Conversations: Evaluating Performance, Explainability, Fairness, and Efficiency in Emotion Recognition Systems**

---

# Research Motivation

Emotion recognition systems are increasingly being integrated into mental health support platforms. While recent Transformer-based models achieve strong predictive performance, important questions remain regarding their interpretability, fairness, robustness, and suitability for deployment in real-world youth mental-health settings.

The Milo project investigates these challenges by combining fine-grained emotion recognition, explainable AI, fairness evaluation, and efficiency analysis.

---

# Primary Research Question

## PRQ

**How can emotion recognition systems for youth mental-health support be made simultaneously accurate, explainable, fair, robust, and computationally efficient?**

This question serves as the central theme connecting all experiments conducted in this project.

---

# RQ1: Emotion Recognition Performance

## Research Question

How much performance improvement do Transformer-based models provide over classical machine learning approaches for fine-grained emotion recognition?

## Motivation

GoEmotions demonstrated that BERT outperforms BiLSTM, but the trade-offs between modern Transformers and interpretable classical models remain underexplored.

## Models

* Logistic Regression
* Linear SVM
* DistilBERT
* BERT

## Hypothesis

Transformer models will outperform classical approaches in Macro F1 score due to their ability to capture contextual information.

## Metrics

* Accuracy
* Precision
* Recall
* Macro F1

---

# RQ2: Explainability of Emotion Predictions

## Research Question

What linguistic features contribute most strongly to emotion predictions across classical and Transformer-based models?

## Motivation

Mental health applications require transparent decision-making.

## Hypothesis

Classical models will rely primarily on explicit emotion-indicating keywords, whereas Transformer models will leverage broader contextual information.

## Methods

* SHAP
* Feature Coefficients
* Global Feature Importance

## Metrics

* SHAP Attribution Scores
* Feature Importance Rankings

---

# RQ3: Faithfulness of Explanations

## Research Question

Do explanation methods accurately reflect the underlying decision-making processes of emotion recognition models?

## Motivation

An explanation is useful only if it truly reflects how a model arrived at its prediction.

## Hypothesis

Removing highly influential tokens identified by SHAP will significantly reduce model confidence.

## Methods

* Deletion Test
* Confidence Perturbation Analysis
* AOPC (Area Over Perturbation Curve)

## Metrics

* Confidence Drop
* AOPC Score

---

# RQ4: Efficiency-Performance Tradeoffs

## Research Question

Can lightweight Transformer architectures achieve comparable emotion recognition performance while reducing computational requirements?

## Motivation

Many real-world mental-health applications operate under limited computational resources.

## Hypothesis

DistilBERT will achieve performance close to BERT while substantially reducing inference latency and memory usage.

## Models

* DistilBERT
* BERT Base

## Metrics

* Macro F1
* Inference Time
* Parameter Count
* Memory Consumption

---

# RQ5: Linguistic Robustness

## Research Question

Do emotion recognition systems perform consistently across different linguistic styles commonly used by young people?

## Motivation

Youth conversations frequently contain slang, abbreviations, informal language, and social-media-specific expressions.

## Hypothesis

Models will demonstrate lower performance on slang-heavy and informal language compared to standard English.

## Linguistic Groups

* Standard English
* Social Media English
* Teen Slang
* Informal Messaging

## Metrics

* Macro F1
* Precision
* Recall
* False Negative Rate

---

# RQ6: Error Analysis and Safety

## Research Question

What categories of emotion recognition errors are most likely to affect youth mental-health support systems?

## Motivation

Certain mistakes may have more serious consequences than others.

## Hypothesis

Errors involving distress-related emotions will have greater potential impact than errors involving positive emotions.

## Error Categories

* Sarcasm
* Mixed Emotion
* Slang
* Context Missing
* Ambiguous Emotion
* Long-Range Context

## Metrics

* Error Frequency
* Error Severity
* Confusion Matrix Analysis

---

# RQ7: Generalization Across Emotion Taxonomies

## Research Question

Do models trained on fine-grained emotion datasets generalize effectively to simpler emotion classification tasks?

## Motivation

GoEmotions contains 27 emotions while DAIR-AI Emotion contains only six categories.

## Hypothesis

Models trained on fine-grained emotion taxonomies will transfer effectively to coarse-grained emotion recognition tasks.

## Datasets

* GoEmotions
* DAIR-AI Emotion

## Metrics

* Transfer Learning Performance
* Macro F1
* Cross-Dataset Generalization

---

# RQ8: Trade-offs in Responsible Emotion AI

## Research Question

What trade-offs exist between predictive performance, interpretability, robustness, fairness, and computational efficiency in emotion recognition systems?

## Motivation

The most accurate model may not necessarily be the most suitable for deployment in mental-health applications.

## Hypothesis

Models with the highest predictive performance will not always achieve the highest scores in explainability, robustness, or efficiency.

## Evaluation Dimensions

* Accuracy
* Explainability
* Faithfulness
* Robustness
* Efficiency

## Expected Outcome

Develop a framework for selecting emotion recognition models that balances predictive performance with responsible AI principles.

---

# Expected Contributions

This project aims to contribute:

1. A benchmark comparison of classical and Transformer-based emotion recognition systems.
2. A comprehensive explainability analysis using SHAP.
3. A faithfulness evaluation framework using deletion-based perturbation tests.
4. A linguistic robustness assessment across youth-oriented language styles.
5. An efficiency-performance comparison between BERT and DistilBERT.
6. A Responsible AI framework for emotion recognition in mental-health support systems.

---

# Long-Term Research Vision

The long-term goal of Milo is to advance trustworthy, explainable, and human-centered emotion intelligence systems capable of supporting youth mental well-being while maintaining transparency, fairness, and reliability.
