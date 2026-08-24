#!/bin/bash

echo "🧪 API 번역 기능 테스트"
echo ""

# Test English to Korean
echo "1️⃣ 영어 → 한국어 번역 테스트"
curl -X POST http://localhost:3001/api/meetings/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test for the meeting translation system.",
    "sourceLanguage": "en"
  }' | jq .

echo ""

# Test Chinese to Korean
echo "2️⃣ 중국어 → 한국어 번역 테스트"
curl -X POST http://localhost:3001/api/meetings/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，这是会议翻译系统的测试。",
    "sourceLanguage": "zh"
  }' | jq .

echo ""

# Test Vietnamese to Korean
echo "3️⃣ 베트남어 → 한국어 번역 테스트"
curl -X POST http://localhost:3001/api/meetings/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Xin chào, đây là bài kiểm tra hệ thống dịch cuộc họp.",
    "sourceLanguage": "vi"
  }' | jq .

echo ""
echo "✅ API 테스트 완료"