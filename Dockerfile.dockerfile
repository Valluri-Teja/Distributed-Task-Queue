FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install fastapi uvicorn redis python-dotenv

