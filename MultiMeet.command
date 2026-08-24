#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

clear
echo "================================="
echo "     MultiMeet - 회의 번역 시스템"
echo "================================="
echo ""

# Check if services are running
echo "📋 필수 서비스 확인 중..."

# Check PostgreSQL
if brew services list | grep -q "postgresql.*started"; then
    echo "✅ PostgreSQL 실행 중"
else
    echo "⚠️  PostgreSQL이 실행되지 않았습니다. 시작 중..."
    brew services start postgresql@15
    sleep 2
fi

# Check Redis
if brew services list | grep -q "redis.*started"; then
    echo "✅ Redis 실행 중"
else
    echo "⚠️  Redis가 실행되지 않았습니다. 시작 중..."
    brew services start redis
    sleep 2
fi

# Check Ollama
if brew services list | grep -q "ollama.*started"; then
    echo "✅ Ollama 실행 중"
else
    echo "⚠️  Ollama가 실행되지 않았습니다. 시작 중..."
    brew services start ollama
    sleep 2
fi

echo ""
echo "🚀 MultiMeet 애플리케이션 시작 중..."
echo ""

# Set environment variable for production
export NODE_ENV=production

# Run the executable
"$DIR/multimeet" &

# Wait a moment for the server to start
sleep 3

echo ""
echo "================================="
echo "MultiMeet이 실행되었습니다!"
echo "================================="
echo ""
echo "📱 웹 브라우저에서 접속하세요:"
echo "   http://localhost:3001"
echo ""
echo "🔐 처음 사용시 회원가입이 필요합니다"
echo ""
echo "종료하려면 이 창을 닫으세요."
echo "================================="

# Open browser
open http://localhost:3001

# Keep the script running
wait