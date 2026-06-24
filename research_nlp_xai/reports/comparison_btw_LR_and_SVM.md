# Comparison Between Logistic Regression and Linear SVM

## Experiment Overview

This experiment evaluates two classical machine learning approaches for fine-grained emotion recognition on the GoEmotions dataset:

1. TF-IDF + Logistic Regression
2. TF-IDF + Linear Support Vector Machine (SVM)

The goal is to establish strong classical baselines before evaluating transformer-based architectures such as DistilBERT and BERT.

---

# Experimental Results

| Model               |  Accuracy | Precision |    Recall |  Macro F1 |
| ------------------- | --------: | --------: | --------: | --------: |
| Logistic Regression | **0.392** | **0.333** | **0.464** | **0.367** |
| Linear SVM          |     0.373 |     0.293 |     0.399 |     0.324 |

---

# Primary Finding

Logistic Regression outperformed Linear SVM across all evaluation metrics.

| Metric    | Better Model        |
| --------- | ------------------- |
| Accuracy  | Logistic Regression |
| Precision | Logistic Regression |
| Recall    | Logistic Regression |
| Macro F1  | Logistic Regression |

Most importantly:

```text
Logistic Regression Macro F1 = 0.367
Linear SVM Macro F1 = 0.324
```

This represents approximately:

```text
13.1% relative improvement in Macro F1
```

The improvement is substantial given the difficulty of a 28-class emotion classification problem.

---

# Analysis 1: Probabilistic Decision Boundaries

One possible explanation for the superior performance of Logistic Regression is its probabilistic formulation.

Logistic Regression estimates:

```text
P(emotion | text)
```

whereas Linear SVM attempts to construct hard decision boundaries between classes.

The GoEmotions dataset contains:

```text
16.36% multi-label examples
```

Even after simplifying the dataset into a single-label setting, emotional boundaries remain inherently fuzzy.

Examples include:

```text
fear ↔ nervousness

gratitude ↔ joy

approval ↔ admiration
```

These emotional categories overlap semantically and are not cleanly separable.

### Interpretation

The probabilistic nature of Logistic Regression appears better suited for modeling emotional ambiguity than the margin-based decision boundaries used by SVM.

---

# Analysis 2: Evidence of Semantic Class Overlap

Inspection of the confusion matrices reveals strong diagonal structures for both models, indicating that many predictions are correct.

However, visible off-diagonal regions indicate recurring confusion between related emotions.

Common emotion confusions reported in the GoEmotions literature include:

| True Emotion | Confused With |
| ------------ | ------------- |
| Grief        | Sadness       |
| Pride        | Admiration    |
| Nervousness  | Fear          |
| Approval     | Admiration    |
| Gratitude    | Joy           |

### Interpretation

Most errors occur between semantically related emotions rather than unrelated emotional categories.

This suggests that the challenge is not recognizing emotional content itself, but distinguishing between subtle emotional nuances.

---

# Analysis 3: Neutral Class Dominance

Emotion label:

```text
27 = Neutral
```

is the dominant category in the dataset.

The confusion matrices show a particularly strong diagonal cell for the Neutral class.

This observation aligns with the dataset distribution:

```text
Neutral = 14,219 samples
```

which is substantially larger than most other emotion classes.

### Interpretation

Both models learn the Neutral class effectively due to its frequency.

As a result, overall accuracy may be inflated by strong performance on dominant classes.

---

# Analysis 4: Dataset Imbalance as a Limiting Factor

Exploratory analysis revealed severe class imbalance.

Examples:

| Emotion    |  Count |
| ---------- | -----: |
| Neutral    | 14,219 |
| Admiration |  4,130 |
| Approval   |  2,939 |
| Gratitude  |  2,662 |

Rare classes include:

```text
grief
relief
realization
```

The confusion matrices suggest:

- Strong performance on common emotions
- Weak performance on rare emotions

### Interpretation

Performance limitations appear to be driven more by class imbalance than by classifier choice alone.

Future experiments may benefit from:

- Class weighting
- Data augmentation
- Hierarchical emotion grouping

---

# Analysis 5: Why Macro F1 Matters

Accuracy alone is not sufficient for evaluating emotion recognition systems.

High-frequency classes such as:

```text
neutral
admiration
approval
```

can disproportionately influence accuracy.

Macro F1 provides a more balanced evaluation because it treats each emotion equally regardless of frequency.

### Key Observation

Logistic Regression achieved:

```text
Macro F1 = 0.367
```

compared to:

```text
Macro F1 = 0.324
```

for Linear SVM.

This suggests that Logistic Regression performs better not only on common emotions but also across the broader emotion taxonomy.

---

# Analysis 6: Sparse Features Remain Strong Baselines

The strongest classical model consists only of:

```text
TF-IDF
+
Logistic Regression
```

yet achieves:

```text
Macro F1 ≈ 0.37
```

For comparison, the GoEmotions paper reports:

| Model                            | Macro F1 |
| -------------------------------- | -------: |
| Logistic Regression (This Study) |    0.367 |
| BiLSTM (GoEmotions Paper)        |     0.41 |
| BERT (GoEmotions Paper)          |     0.46 |

### Interpretation

A substantial portion of emotional information is encoded through explicit lexical signals.

Examples include:

```text
thank you
grateful
love
hate
afraid
```

This indicates that sophisticated architectures are not always necessary to capture basic emotional content.

---

# Implications for Transformer Models

The performance gap between Logistic Regression and BERT remains significant.

| Model               | Macro F1 |
| ------------------- | -------: |
| Logistic Regression |    0.367 |
| BERT (Reported)     |     0.46 |

This corresponds to roughly:

```text
25% relative improvement
```

The remaining gap is likely attributable to:

- Contextual understanding
- Word interactions
- Long-range dependencies
- Semantic reasoning

rather than simple keyword matching.

### Research Question

This motivates the next stage of the project:

> Does BERT outperform classical models because it captures contextual emotional meaning beyond explicit lexical cues?

---

# Conclusion

Logistic Regression emerged as the strongest classical baseline, outperforming Linear SVM across all evaluation metrics.

The findings suggest that:

1. Emotion categories exhibit substantial semantic overlap.
2. Probabilistic classifiers may better capture emotional ambiguity.
3. Dataset imbalance remains a major challenge.
4. Lexical information alone provides surprisingly strong predictive power.
5. Significant room remains for transformer-based architectures to improve performance through contextual understanding.

These results establish a robust baseline against which DistilBERT and BERT will be evaluated in subsequent experiments.

---

# Key Takeaway

The strongest baseline model is:

```text
TF-IDF + Logistic Regression
```

with:

```text
Macro F1 = 0.367
```

making it the reference point for all future transformer, explainability, and faithfulness experiments in the Milo research project.
