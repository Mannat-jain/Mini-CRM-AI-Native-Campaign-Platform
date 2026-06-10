#!/bin/bash
echo "🚀 Starting Xeno Mini CRM..."

# Start channel service
cd channel-service
pip install -r requirements.txt -q
uvicorn main:app --port 8001 &
CHANNEL_PID=$!
echo "✅ Channel Service started (PID $CHANNEL_PID)"

# Start backend
cd ../backend
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ CRM Backend started (PID $BACKEND_PID)"

# Start frontend
cd ../frontend
npm install -q
npm start &
FRONTEND_PID=$!
echo "✅ Frontend started (PID $FRONTEND_PID)"

echo ""
echo "🌐 Frontend:        http://localhost:3000"
echo "🔧 Backend API:     http://localhost:8000/docs"
echo "📡 Channel Service: http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop all services"

wait
