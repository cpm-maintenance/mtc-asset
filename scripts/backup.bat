@echo off
REM ==========================================
REM  MTC-ASSET Quick Backup Script (Windows)
REM  Backup semua source code + Firebase data
REM  lalu push ke GitHub
REM ==========================================
title MTC-ASSET Backup

echo.
echo ========================================
echo   MTC-ASSET BACKUP UTILITY
echo   %DATE% %TIME%
echo ========================================
echo.

REM 1. Backup Firebase data
echo [1/4] Backing up Firebase database...
node scripts\backup-firebase.js
if %errorlevel% neq 0 (
    echo [WARNING] Firebase backup failed, continuing...
)

REM 2. Add files to git
echo.
echo [2/4] Staging files for git...
git add -A

REM 3. Check if there are changes
echo.
echo [3/4] Checking changes...
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo No changes to commit.
    echo.
    echo ========================================
    echo   Backup completed! (no changes)
    echo ========================================
    pause
    exit /b 0
)

REM 4. Commit and push
echo.
echo [4/4] Committing and pushing to GitHub...
git commit -m "📦 Backup: %DATE% %TIME%

Automated backup of source code and Firebase data"
git push

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ BACKUP COMPLETED SUCCESSFULLY!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   ⚠️  Git push failed. Check error above.
    echo ========================================
)

echo.
pause
