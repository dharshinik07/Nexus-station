@echo off
REM FreelanceVault Windows Automated Database Backup Script
setlocal enabledelayedexpansion

set BACKUP_DIR=.\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=%BACKUP_DIR%\freelancevault_db_%TIMESTAMP%.sql

echo Backing up database to %BACKUP_FILE%...
docker exec -t freelancevault_db pg_dump -U freelancevault freelancevault > "%BACKUP_FILE%"

echo Database backup created: %BACKUP_FILE%
