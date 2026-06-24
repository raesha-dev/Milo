from datasets import load_dataset
import os

dataset = load_dataset("dair-ai/emotion")



dataset["train"].to_csv(
    "data/raw/dair_emotion/train.csv",
    index=False
)

dataset["validation"].to_csv(
    "data/raw/dair_emotion/validation.csv",
    index=False
)

dataset["test"].to_csv(
    "data/raw/dair_emotion/test.csv",
    index=False
)

print("DAIR-AI Emotion saved locally.")