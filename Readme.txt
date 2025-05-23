python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn "pyodbc<5" pydantic
uvicorn main:app --reload --host 0.0.0.0 --port 8000