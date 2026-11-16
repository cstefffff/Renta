@echo off
title RentA - Local Development Server
echo ========================================================
echo        Pornire Server RentA (Next.js Local)
echo ========================================================
echo.
cd /d "%~dp0"
echo Director curent: %cd%
echo Pornire server pe http://localhost:3000 ...
echo.
echo [INFO] Pentru a opri serverul, apasati oricand CTRL + C
echo ========================================================
echo.
call npm.cmd run dev
pause
