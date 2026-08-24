#!/bin/bash

echo "🚀 Starting MultiMeet..."
echo ""

# Check if services are running
echo "📋 Checking required services..."

# Check PostgreSQL
if brew services list | grep -q "postgresql.*started"; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL is not running. Starting..."
    brew services start postgresql@15
fi

# Check Redis
if brew services list | grep -q "redis.*started"; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis is not running. Starting..."
    brew services start redis
fi

# Check Ollama
if brew services list | grep -q "ollama.*started"; then
    echo "✅ Ollama is running"
else
    echo "⚠️  Ollama is not running. Starting..."
    brew services start ollama
fi

echo ""
echo "🌐 Starting MultiMeet application..."
echo ""

# Run the executable
./multimeet

echo ""
echo "MultiMeet is now available at:"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop the application"