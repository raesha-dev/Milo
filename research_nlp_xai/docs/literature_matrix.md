# Literature Matrix

## Purpose

This document summarizes key research papers related to emotion recognition, explainable AI, transformer models, fairness, and responsible NLP. It serves as a reference for experiment design, model selection, evaluation methodology, and identification of research gaps for the Milo project.

---

| Paper                                            | Dataset                                                 | Models                                  | Main Findings                                                                                                                                                                | Limitations                                                                                                | Relevance to My Research                                                                 |
| ------------------------------------------------ | ------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GoEmotions (Demszky et al., 2020)                | GoEmotions (58k Reddit comments, 27 emotions + neutral) | BERT, BiLSTM                            | BERT outperforms BiLSTM; emotion grouping (Ekman and Sentiment taxonomies) significantly improves Macro F1; transfer learning improves performance on small emotion datasets | Reddit-only data; English-only dataset; demographic and cultural biases; limited explainability analysis   | Primary dataset, benchmark models, emotion taxonomy analysis, transfer learning baseline |
| SHAP (Lundberg & Lee, 2017)                      | General                                                 | Model-agnostic explainability framework | Provides theoretically grounded feature attribution explanations; satisfies local accuracy, consistency, and missingness properties                                          | Computationally expensive for large feature spaces; explanation quality depends on background distribution | Explainability analysis, token attribution, model transparency, faithfulness evaluation  |
| DistilBERT (Sanh et al., 2019)                   | Multiple NLP Benchmarks (GLUE, IMDb, SQuAD)             | DistilBERT                              | Retains approximately 97% of BERT performance while reducing model size by 40% and improving inference speed by 60%                                                          | Slight decrease in predictive performance compared to full BERT                                            | Efficiency-performance tradeoff analysis for deployable emotion recognition systems      |
| Attention Is All You Need (Vaswani et al., 2017) | Machine Translation                                     | Transformer                             | Introduced self-attention mechanism and Transformer architecture; improved parallelization and long-range dependency modeling                                                | High computational requirements; limited interpretability of attention weights                             | Foundation of BERT and DistilBERT architectures used in emotion recognition              |
| Fairlearn (Weerts et al., 2023)                  | Multiple Domains                                        | Fairness Evaluation Framework           | Supports disaggregated evaluation across population groups; identifies quality-of-service and allocation harms                                                               | Fairness definitions depend on subgroup selection and context                                              | Fairness, robustness, and linguistic subgroup evaluation                                 |
| DAIR-AI Emotion Dataset (Saravia et al.)         | Emotion Dataset (6 emotions)                            | Common NLP Classification Models        | Provides a balanced and widely used benchmark for emotion classification; simpler taxonomy than GoEmotions                                                                   | Limited emotion granularity; only six emotion categories                                                   | Secondary benchmark dataset for testing generalization and cross-dataset robustness      |

---

## Key Research Gap

Existing emotion recognition research primarily focuses on predictive performance.

Relatively fewer studies investigate:

1. Explainability of emotion predictions.
2. Faithfulness of explanations.
3. Robustness across different linguistic styles.
4. Fairness in emotion classification.
5. Efficiency-performance tradeoffs for real-world deployment.

The Milo project aims to address these gaps through a combination of:

* Classical ML baselines
* Transformer-based models
* Explainable AI techniques (SHAP)
* Faithfulness testing
* Fairness and robustness evaluation
* Efficient deployment-oriented model comparison
