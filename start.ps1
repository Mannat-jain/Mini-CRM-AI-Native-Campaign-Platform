Write-Host "🚀 Starting Xeno Mini CRM on Windows..." -ForegroundColor Green

# 1. Start Channel Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd channel-service; pip install -r requirements.txt; uvicorn main:app --port 8001"
Write-Host "✅ Channel Service launching on port 8001..." -ForegroundColor Cyan

# 2. Start CRM Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; pip install -r requirements.txt; uvicorn main:app --port 8000"
Write-Host "✅ CRM Backend launching on port 8000..." -ForegroundColor Cyan

# 3. Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm start"
Write-Host "✅ Frontend launching on port 3000..." -ForegroundColor Cyan

Write-Host "`n🌐 Dashboard:       http://localhost:3000" -ForegroundColor Green
Write-Host "🔧 Backend API:     http://localhost:8000/docs" -ForegroundColor Green
Write-Host "📡 Channel Service: http://localhost:8001/docs" -ForegroundColor Green
Write-Host "`nClose the opened terminal windows to stop the services." -ForegroundColor Yellow
