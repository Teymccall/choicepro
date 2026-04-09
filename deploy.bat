@echo off
echo ========================================
echo  Choice Pro - GitHub Deployment
echo ========================================
echo.

echo Step 1: Configuring Git...
git config user.name "Teymccall"
git config user.email "royalgallerygh@gmail.com"
echo Done!

echo.
echo Step 2: Committing changes...
git commit -m "Initial commit: Choice Pro - Couples Decision Making App"
echo Done!

echo.
echo Step 3: Setting up GitHub remote...
git remote add origin https://github.com/Teymccall/choicepro.git
echo Done!

echo.
echo Step 4: Pushing to GitHub...
git branch -M main
git push -u origin main

echo.
echo ========================================
echo  SUCCESS! Your code is on GitHub!
echo ========================================
echo.
echo View your repository at:
echo https://github.com/Teymccall/choicepro
echo.
pause
