@echo off
echo Committing and pushing to GitHub...
git commit --amend -m "Initial commit: Choice Pro - Couples Decision Making App"
git push -u origin main --force
echo.
echo Done! Check: https://github.com/Teymccall/choicepro
pause
