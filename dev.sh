#!/bin/bash

# BluePeak Strategy Generator - Development Server Launcher
# This script ensures you're running the correct dev server

echo "🚀 Starting BluePeak Strategy Generator..."
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI is not installed!"
    echo ""
    echo "Install it with:"
    echo "  npm install -g vercel"
    echo ""
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo ""
    echo "Create one with:"
    echo "  echo 'ANTHROPIC_API_KEY=your_key_here' > .env"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        exit 1
    fi
fi

# Check if project is linked
if [ ! -d .vercel ]; then
    echo "📦 Linking project to Vercel..."
    vercel link --yes --project bluepeak-strategy-generator
    echo ""
fi

echo "✅ Starting development server..."
echo "🌐 Server will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the dev server
vercel dev --listen 3000
