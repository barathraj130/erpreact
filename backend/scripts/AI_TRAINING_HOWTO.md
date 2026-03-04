# World-Class AI Bill Processing & Training Guide

This ERP system uses a **Hybrid Neural Architecture** for bill scanning. It combines high-end Vision LLMs (Gemini) with a localized **Supervised Learning** loop.

## 1. How the "Training" Works
Every time a bill is scanned, the system performs the following "Self-Learning" steps:
1.  **Data Acquisition**: The raw image/PDF is stored in `backend/uploads/training_data`.
2.  **Labeling**: The AI's initial guess is saved as a JSON sibling file.
3.  **Human Feedback (Fine-Tuning)**: When you manually correct a field (like the Amount or Supplier) and click "Apply", the system sends a "Correction" signal to the backend.
4.  **Dataset Build**: Over time, you build a high-quality dataset of `(Image -> Correct Data)` pairs specific to your vendors.

## 2. Training Your Own Local Model
Once you have ~500 scanned bills, you can move away from external APIs by training a local model.

### Recommended Stack:
*   **Base Model**: LayoutLMv3 (Microsoft) or Donut (Clova AI).
*   **Library**: `Hugging Face Transformers` + `PyTorch`.

### Example Training Logic (Conceptual):
```python
from transformers import LayoutLMv3Processor, LayoutLMv3ForTokenClassification
import torch

# Load your collected dataset from /uploads/training_data
dataset = load_local_erp_dataset("./backend/uploads/training_data")

# Fine-tune the model to recognize YOUR specific bill layouts
model = LayoutLMv3ForTokenClassification.from_pretrained("microsoft/layoutlmv3-base")
# ... training loop ...
model.save_pretrained("./backend/models/custom_bill_scanner")
```

## 3. Activating "Pro" Mode
To move from Simulation to World-Class real-time scanning:
1.  Get a **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
2.  Add it to your `backend/.env` file:
    ```env
    GEMINI_API_KEY=your_key_here
    ```
3.  The system will automatically switch from **Intelligent Simulation** to **Neural Extraction**.

## 4. Future Roadmap: Predictive Accounting
With enough data, the model won't just scan; it will start **predicting** tax categories, GL codes, and payment risks based on historical vendor behavior.
