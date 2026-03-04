@echo off
REM ERP React - Quick Deployment Script for Windows
REM This script sets up and deploys the entire ERP system

echo.
echo 🚀 ERP React - Deployment Script (Windows)
echo ==========================================
echo.

REM Check if Docker is installed
echo [1/5] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop for Windows first.
    echo Visit: https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)
echo ✓ Docker found

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed.
    pause
    exit /b 1
)
echo ✓ Docker Compose found
echo.

REM Check .env file
echo [2/5] Checking environment configuration...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo ⚠ Creating .env from template...
        copy "backend\.env.example" "backend\.env"
        echo.
        echo ⚠ IMPORTANT: Edit backend\.env with your configuration
        echo   - Database password
        echo   - JWT secrets
        echo   - API keys
        echo.
        echo Please edit backend\.env and then press any key to continue...
        pause
    ) else (
        echo ❌ .env.example not found
        pause
        exit /b 1
    )
)
echo ✓ Environment configuration ready
echo.

REM Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo ❌ docker-compose.yml not found. Are you in the ERPREACT directory?
    pause
    exit /b 1
)

REM Build Docker containers
echo [3/5] Building Docker images...
docker-compose build
if %errorlevel% neq 0 (
    echo ❌ Docker build failed
    pause
    exit /b 1
)
echo ✓ Docker images built
echo.

REM Start Docker containers
echo [4/5] Starting Docker containers...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ❌ Docker startup failed
    pause
    exit /b 1
)
echo ✓ Docker containers started
echo.

REM Wait for services
echo Waiting for services to initialize (30 seconds)...
timeout /t 30 /nobreak
echo.

REM Verify deployment
echo [5/5] Verifying deployment...
powershell -Command "(Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing).StatusCode" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Backend API responding
) else (
    echo ⚠ Backend API not responding yet (may need more time)
)

powershell -Command "(Invoke-WebRequest -Uri 'http://localhost' -UseBasicParsing).StatusCode" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Frontend web server responding
) else (
    echo ⚠ Frontend not responding yet (may need more time)
)
echo.

REM Display access information
echo ==========================================
echo ✅ Deployment Complete!
echo ==========================================
echo.
echo Access Your System:
echo   Frontend:     http://localhost
echo   Backend API:  http://localhost:3000/api
echo   pgAdmin:      http://localhost:5050
echo.
echo Default Credentials:
echo   Email:        admin@company.com
echo   Password:     admin123
echo.
echo ⚠ IMPORTANT: Change these credentials immediately in production!
echo.
echo Useful Commands:
echo   View logs:        docker-compose logs -f
echo   Stop services:    docker-compose down
echo   Restart:          docker-compose restart
echo   Rebuild:          docker-compose up -d --build
echo.
echo Documentation:
echo   Setup Guide:            SETUP_GUIDE.md
echo   API Reference:          API_REFERENCE.md
echo   Verification Checklist: VERIFICATION_CHECKLIST.md
echo.
echo Next Steps:
echo   1. Open http://localhost in your browser
echo   2. Login with admin@company.com / admin123
echo   3. Configure company details in Settings
echo   4. Set up bank accounts and start using the system
echo.
pause
