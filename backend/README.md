# Backend (FastAPI + matcher)

- FastAPI app lives in `backend/app`, matcher/normalization logic in `backend/src/zestie_matcher`.
- Data snapshot: `backend/data/normalized/dogs.json` (built from the raw feeds under `backend/data/raw`).

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=backend/src uvicorn backend.app.main:app --reload --port 8000
```
Set `VITE_API_BASE_URL=http://127.0.0.1:8000` for the frontend.

## Refresh normalized data
```bash
PYTHONPATH=backend/src python backend/src/zestie_matcher/normalization/normalize_dogs.py \
  --output backend/data/normalized/dogs.json
```
- Pulls from `backend/data/raw/*`.
- Extracts numeric ages from bios when missing, keeps months/weeks as months (no month→year conversion).
- Cleans descriptions (HTML entities/tags) so the UI doesn’t show stray symbols.
