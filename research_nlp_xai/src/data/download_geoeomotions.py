from datasets import load_dataset

# Download dataset
dataset = load_dataset("go_emotions")

print(dataset)

# Save locally
dataset["train"].to_csv(
    "../../data/raw/goemotions/train.csv",
    index=False
)

dataset["validation"].to_csv(
    "../../data/raw/goemotions/validation.csv",
    index=False
)

dataset["test"].to_csv(
    "../../data/raw/goemotions/test.csv",
    index=False
)

print("GoEmotions downloaded successfully!")