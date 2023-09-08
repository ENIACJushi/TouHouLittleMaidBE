:: Enter message
set /p commit_msg=Please input commit message:
:: Add files
git add .
:: Commit files
git commit -m "%commit_msg%"
:: push master
git push origin main
pause