@echo off
title RentA - Production Server
echo ========================================================
echo        Pornire Server RentA (Mod Productie Local)
echo ========================================================
echo.
cd /d "%~dp0"
echo Director curent: %cd%
echo Pornire server compilat pe http://localhost:3000 ...
echo.
echo [INFO] Pentru a opri serverul, apasati oricand CTRL + C
echo ========================================================
echo.
call npm.cmd run start
pause
