# Quick Start Guide

## Get Running in 5 Minutes

### Step 1: Get an Anthropic API Key (2 minutes)

1. Go to https://console.anthropic.com/
2. Sign up for a free account
3. Navigate to API Keys
4. Click "Create Key"
5. **Copy the key** (you won't be able to see it again)

### Step 2: Choose Your Path

#### Path A: Run Locally FIRST (Recommended for Testing - 3 minutes)

```bash
# Install Vercel CLI (REQUIRED - handles serverless functions)
npm install -g vercel

# Login to Vercel
vercel login

# Create .env file with your API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Link project (creates .vercel directory)
vercel link --yes --project bluepeak-strategy-generator

# Run dev server - choose ONE of these (easiest first):
./dev.sh                      # Helper script - recommended!
# OR
npm start                     # Alias for vercel dev
# OR
vercel dev --listen 3000      # Manual command

# Open http://localhost:3000
```

**IMPORTANT:** You MUST use Vercel CLI, not the default Vite command!
- ❌ `npm run dev` = ERROR + 404 (no API support)
- ✅ `./dev.sh` = Automated setup + checks ✓
- ✅ `npm start` = Runs vercel dev ✓
- ✅ `vercel dev --listen 3000` = Direct command ✓

#### Path B: Deploy to Vercel (For Production)

```bash
# After testing locally, deploy to production
vercel --prod

# Or set up environment variables in Vercel dashboard:
# Project Settings → Environment Variables
# Add: ANTHROPIC_API_KEY = your_key
```

Your app will be live at a URL like `https://your-project.vercel.app`

### Step 3: Test It Out

1. Open the application in your browser

2. **Quick Test - Insufficient Data** (should ask questions):
   - Paste: `Client wants more B2B leads. Budget is flexible.`
   - Click "Generate Strategy"
   - AI should ask clarifying questions

3. **Full Test - Complete Data** (should generate strategy):
   - Upload the file: `sample-client-data.txt` (included in project)
   - Click "Generate Strategy"
   - Wait 10-30 seconds
   - You should see a 3-tab strategy output

## Common Issues

❌ **"API request failed: 404 Not Found"**
→ You're using `npm run dev` instead of `vercel dev`
→ SOLUTION: Stop the server and run `vercel dev --listen 3000`

❌ **"API request failed: 500"**
→ Your ANTHROPIC_API_KEY is missing or invalid
→ SOLUTION: Check your `.env` file or verify key at console.anthropic.com

❌ **"Cannot find module"**
→ Dependencies not installed
→ SOLUTION: Run `npm install` in both root AND `cd api && npm install`

❌ **"Project names cannot contain '---'"**
→ Vercel project name issue
→ SOLUTION: Run `vercel link --yes --project bluepeak-strategy-generator` first

## What to Customize

### 1. System Prompt
Edit the AI's behavior in `api/strategy.js` (line 7-22)

### 2. Branding
Change colors in `tailwind.config.js`:
```javascript
colors: {
  'bluepeak-blue': '#0066CC',  // Change these!
  'bluepeak-dark': '#003D7A',
  'bluepeak-light': '#E6F2FF',
}
```

### 3. File Upload Limits
Edit `api/strategy.js` (line 209):
```javascript
maxFileSize: 50 * 1024 * 1024 // Currently 50MB
```

### 4. Word Limit
Edit `api/strategy.js` (line 84):
```javascript
const MAX_WORDS = 170000 // Change this
```

## Project Structure

```
CBC-Hackathon/
├── api/strategy.js          ← Main AI logic (serverless function)
├── src/
│   ├── App.jsx              ← Main app component
│   └── components/          ← UI components
├── package.json             ← Frontend dependencies
├── api/package.json         ← API dependencies
└── vercel.json              ← Deployment config
```

## Next Steps

1. ✅ Deploy and test
2. 📝 Customize branding (colors, text)
3. 🧪 Test with real client data
4. 🚀 Share with your team
5. 📊 Monitor usage at console.anthropic.com

## Need Help?

- Check `DEPLOYMENT.md` for detailed deployment instructions
- Check `README.md` for full documentation
- Review test cases in `DEPLOYMENT.md`

## Cost Estimate

**Claude 3.5 Sonnet Pricing:**
- $3 per million input tokens
- $15 per million output tokens

**Typical request cost:** $0.05 - $0.50 per strategy

**Vercel:** Free tier includes 100GB bandwidth + 100 hours function execution

You're all set! 🎉
