@echo off
title OOTD 서비스 매니저
cd /d "%~dp0"

echo OOTD 서비스 매니저를 시작합니다...

:: ELECTRON_RUN_AS_NODE가 설정된 경우 해제 (VS Code 터미널 등에서 설정됨)
set ELECTRON_RUN_AS_NODE=

:: launcher/node_modules/electron이 없으면 설치
if not exist "launcher\node_modules\electron" (
  echo Electron 의존성 설치 중...
  cd launcher
  call npm install
  cd ..
)

:: 실행
node launcher\node_modules\electron\cli.js .
