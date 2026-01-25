@echo off
echo ========================================
echo Running Backend API Tests
echo ========================================
python -m pytest %*
echo.
echo Done.
pause
