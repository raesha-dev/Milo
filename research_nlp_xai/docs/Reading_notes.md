# Reading Notes

## Research Objective

This document records critical insights, limitations, and research opportunities identified from foundational papers in emotion recognition, explainable AI, transformer architectures, fairness, and efficient NLP systems.

The goal is not merely to summarize prior work, but to identify unanswered questions and opportunities for extending the state of the art through the Milo research project.

---

# Paper 1: GoEmotions

## Paper Information

**Title:** GoEmotions: A Dataset of Fine-Grained Emotions

**Authors:** Dorottya Demszky et al.

**Year:** 2020

---

## Research Problem

Most existing emotion datasets contain only a small number of emotion categories (typically 6–8 emotions), limiting the ability of NLP systems to recognize nuanced emotional states.

The authors propose a large-scale fine-grained emotion dataset containing 27 emotions plus Neutral.

---

## Dataset

### Name

GoEmotions

### Source

Reddit Comments

### Size

58,000+ comments

### Labels

27 emotions + Neutral

### Key Contribution

Introduced one of the largest manually annotated fine-grained emotion datasets.

---

## Models Used

### Baseline

BiLSTM

### Main Model

BERT Base

---

## Important Findings

### Finding 1

BERT significantly outperforms BiLSTM.

Implication:

Transformer architectures capture emotional context more effectively than recurrent models.

---

### Finding 2

Performance increases substantially when emotions are grouped into higher-level categories.

Results:

* Full Taxonomy: F1 ≈ 0.46
* Ekman Taxonomy: F1 ≈ 0.64
* Sentiment Taxonomy: F1 ≈ 0.69

Implication:

Many emotion classes overlap semantically.

---

### Finding 3

Rare emotions are significantly harder to classify.

Examples:

* Grief
* Relief
* Realization

Implication:

Class imbalance remains a major challenge.

---

### Finding 4

GoEmotions transfer learning improves performance on external emotion datasets.

Implication:

The dataset captures transferable emotional knowledge.

---

## Limitations

### Dataset Bias

Reddit users are not representative of the general population.

---

### Language Bias

English only.

---

### Cultural Bias

Annotators were native English speakers from India.

---

### Explainability Gap

The paper focuses on predictive performance and does not investigate why predictions are made.

---

## Research Opportunities

The paper leaves several questions unanswered:

1. Can emotion predictions be explained?
2. Are explanations faithful?
3. Are models robust across linguistic styles?
4. Which emotions are consistently confused?
5. Can lightweight models achieve comparable performance?

---

## Connection to Milo

GoEmotions becomes the primary benchmark dataset.

The Milo project extends GoEmotions by introducing:

* Explainability
* Faithfulness testing
* Linguistic robustness
* Fairness evaluation
* Efficiency analysis

---

# Paper 2: SHAP

## Paper Information

**Title:** A Unified Approach to Interpreting Model Predictions

**Authors:** Scott Lundberg, Su-In Lee

**Year:** 2017

---

## Research Problem

Machine learning models often achieve high performance while remaining difficult to interpret.

The paper introduces SHAP, a unified framework for explaining model predictions.

---

## Core Idea

Every feature receives a contribution score indicating how much it influenced the prediction.

Example:

Input:

"I feel isolated and hopeless."

Output:

Sadness = 0.92

SHAP Attribution:

* isolated => +0.43
* hopeless => +0.37
* feel => +0.02

---

## Important Findings

### Finding 1

SHAP explanations satisfy desirable theoretical properties:

* Local Accuracy
* Consistency
* Missingness

---

### Finding 2

SHAP provides both local and global explanations.

---

## Limitations

Computational complexity increases rapidly with feature count.

---

## Research Opportunities

SHAP explains predictions but does not verify whether explanations are faithful.

This motivates:

### Deletion Test

Remove important tokens.

Observe confidence drop.

### Research Question

Can explanation quality be quantitatively measured?

---

## Connection to Milo

SHAP will be used to explain:

* DistilBERT predictions
* BERT predictions

and compare them against classical ML explanations.

---

# Paper 3: DistilBERT

## Paper Information

**Title:** DistilBERT, a Distilled Version of BERT

**Authors:** Victor Sanh et al.

**Year:** 2019

---

## Research Problem

BERT provides strong performance but requires significant computational resources.

---

## Key Idea

Knowledge Distillation

Large Teacher Model:

BERT

↓

Smaller Student Model:

DistilBERT

---

## Important Findings

### Finding 1

Retains approximately 97% of BERT's performance.

---

### Finding 2

40% fewer parameters.

---

### Finding 3

60% faster inference.

---

## Limitations

Small performance degradation compared to BERT.

---

## Research Opportunities

Mental health applications often require deployment on low-resource devices.

Research Question:

Can DistilBERT provide the best balance between:

* Accuracy
* Explainability
* Efficiency

---

## Connection to Milo

DistilBERT serves as the primary lightweight transformer benchmark.

---

# Paper 4: Attention Is All You Need

## Paper Information

**Authors:** Vaswani et al.

**Year:** 2017

---

## Research Problem

RNNs and LSTMs struggle with long-range dependencies and sequential computation.

---

## Key Innovation

Self-Attention

Allows models to determine which words are important regardless of position.

---

## Important Findings

Transformers outperform recurrent architectures on machine translation.

---

## Research Opportunities

Do attention patterns correspond to emotionally important words?

Research Question:

Do attention weights and SHAP explanations identify the same emotional cues?

---

## Connection to Milo

Provides theoretical foundation for:

* BERT
* DistilBERT
* Transformer explainability

---

# Paper 5: Fairlearn

## Research Problem

Machine learning systems can produce unequal performance across different populations.

---

## Key Insight

Average accuracy can hide subgroup failures.

Example:

Overall Accuracy = 90%

Group A = 95%

Group B = 70%

Average metrics alone are misleading.

---

## Important Findings

Fairness should be evaluated using disaggregated metrics.

Metrics:

* FPR
* FNR
* Recall
* Precision

per subgroup.

---

## Research Opportunities

GoEmotions lacks demographic labels.

Instead of demographic fairness:

Evaluate linguistic robustness.

Groups:

* Standard English
* Teen Slang
* Social Media Language
* Informal Messaging

---

## Connection to Milo

Fairlearn will be used to evaluate:

* Linguistic robustness
* Performance disparities
* Responsible AI considerations

---

# Paper 6: DAIR-AI Emotion Dataset

## Research Problem

Emotion datasets with simpler taxonomies provide cleaner benchmarks for emotion classification.

---

## Dataset

6 Emotions:

* Joy
* Sadness
* Anger
* Fear
* Love
* Surprise

---

## Importance

Provides a cleaner benchmark than GoEmotions.

Allows cross-dataset validation.

---

## Research Opportunity

Research Question:

Do explanations learned on GoEmotions generalize to simpler emotion taxonomies?

---

# Emerging Research Gaps

Across all reviewed literature, the following gaps remain insufficiently explored:

1. Explainability of emotion recognition systems.
2. Faithfulness of explanation methods.
3. Robustness to slang and informal language.
4. Efficiency-performance tradeoffs.
5. Fairness across linguistic styles.
6. Error analysis in mental-health-oriented applications.
7. Trustworthiness of AI-assisted emotional understanding systems.

These gaps form the foundation of the Milo research agenda.
