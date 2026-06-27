@echo off
echo ================================================
echo   Techie Brains - GitHub Push Script
echo ================================================
echo.

cd /d "C:\Users\Swapna Boddu\Downloads\TechieBrains"

echo [1/6] Initializing git repository...
git init
if %errorlevel% neq 0 (
  echo ERROR: git init failed. Make sure Git is installed.
  echo Download Git from: https://git-scm.com/download/win
  pause
  exit /b 1
)

echo.
echo [2/6] Setting remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/hrishitha8/techie-brains.git
echo Remote set to: https://github.com/hrishitha8/techie-brains.git

echo.
echo [3/6] Staging all files...
git add .
if %errorlevel% neq 0 (
  echo ERROR: git add failed.
  pause
  exit /b 1
)

echo.
echo [4/6] Creating commit...
git commit -m "Initial commit: Techie Brains website with local cookie/JWT auth"
if %errorlevel% neq 0 (
  echo.
  echo NOTE: If you see 'Author identity unknown', run these two commands first:
  echo   git config --global user.email "your@email.com"
  echo   git config --global user.name "Your Name"
  echo Then re-run this script.
  pause
  exit /b 1
)

echo.
echo [5/6] Setting branch to main...
git branch -M main

echo.
echo [6/6] Pushing to GitHub...
echo.
echo IMPORTANT: When asked for password, use your GitHub Personal Access Token.
echo   Get one at: https://github.com/settings/tokens/new (check 'repo' scope)
echo.
git push -u origin main
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Push failed. Common reasons:
  echo   1. Wrong password - Use a Personal Access Token, NOT your GitHub password
  echo   2. Repository doesn't exist - Make sure https://github.com/hrishitha8/techie-brains exists
  echo   3. No internet connection
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================
echo   SUCCESS! Code pushed to GitHub!
echo   https://github.com/hrishitha8/techie-brains
echo ================================================
pause
