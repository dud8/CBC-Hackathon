# Deployment Checklist

## Quick Start (5 minutes)

### 1. Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Go to API Keys
4. Create a new key
5. Copy it (you'll need it in step 3)

### 2. Deploy to Vercel

#### Option A: Deploy from GitHub

1. Push this code to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) and log in

3. Click "Add New Project"

4. Import your GitHub repository

5. Vercel will auto-detect the configuration (no changes needed)

6. Before deploying, add your environment variable:
   - Click "Environment Variables"
   - Name: `ANTHROPIC_API_KEY`
   - Value: Paste your API key from step 1
   - Click "Add"

7. Click "Deploy"

8. Wait 2-3 minutes for deployment to complete

9. Visit your new URL (e.g., `https://your-project.vercel.app`)

#### Option B: Deploy from CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variable (when prompted, or in dashboard)
# ANTHROPIC_API_KEY = your_key_here
```

### 3. Test Your Deployment

1. Visit your Vercel URL

2. Try the "Test with Sample Data" workflow below

## Test with Sample Data

### Test 1: Insufficient Data (Should Ask Questions)

**Text Input:**
```
Client wants more leads. Budget is flexible.
```

**Expected Result:** AI should ask clarifying questions about:
- What product/service?
- Who is the target customer?
- What does "flexible budget" mean?
- What are specific goals?

### Test 2: Complete Data (Should Generate Full Plan)

**Text Input:**
```
Client: FinFlow Analytics
Product: B2B SaaS platform for fintech startups to track cash flow and predict runway
Target Audience: Series A/B fintech startups (10-50 employees), specifically CFOs and finance teams
Budget: $8,000/quarter
Goals:
- Generate 15 qualified demo requests per month
- Position as thought leaders in fintech cash flow management
- Build SEO presence for keywords like "fintech cash flow tool" and "startup runway calculator"
Current Situation: Just launched 3 months ago, have 5 beta customers, no marketing presence yet
Channels Interested In: LinkedIn, SEO content marketing, maybe Google Ads
```

**Expected Result:** AI should generate a complete 3-part strategy with:
- Client Proposal (problem, solution, scope, timeline, budget)
- Content Strategy (blog topics, LinkedIn calendar)
- Sample Ads (multiple variations for A/B testing)

### Test 3: File Upload

1. Create a simple text file (`client-notes.txt`) with:
   ```
   Discovery Call Notes - TechStart Inc.

   Product: AI-powered recruitment platform for tech companies
   Target: Series B+ tech companies, HR directors
   Budget: $15k/month
   Goal: 50 enterprise demos in Q1
   Pain Point: Current recruitment is too slow and expensive
   Competitors: Greenhouse, Lever, but we have AI matching
   ```

2. Upload this file (no text input needed)

3. **Expected Result:** Full strategy generated from file content

### Test 4: Unhelpful Response (Should Refuse to Proceed)

**First Input:**
```
Need marketing help
```

**AI Response:** (Questions about specifics)

**Your Second Input:**
```
I don't know, just do something
```

**Expected Result:** AI should respond with `cannot_proceed` message explaining it cannot fabricate a strategy

## Verifying Everything Works

✅ **Frontend loads**: You can see the BluePeak header and input form

✅ **File upload works**: Drag-and-drop or click to upload files

✅ **Word counter works**: Type in text area and see word count update

✅ **Submit button works**: Disabled when empty, enabled with input

✅ **Loading state works**: Shows spinner when processing

✅ **Clarification flow works**: AI asks questions, you can answer

✅ **Full plan displays**: Three tabs appear with formatted content

✅ **Download works**: Can download strategy as Markdown file

## Troubleshooting

### "API request failed: 500"

**Problem:** Serverless function error

**Solutions:**
1. Check Vercel logs: Project > Deployments > Click latest > Functions tab
2. Verify `ANTHROPIC_API_KEY` is set in Vercel environment variables
3. Make sure the key is valid (test at console.anthropic.com)

### "Failed to fetch" or network error

**Problem:** CORS or connection issue

**Solutions:**
1. Make sure you're accessing via HTTPS (not HTTP)
2. Check browser console for specific error
3. Verify serverless function deployed correctly

### Files not uploading

**Problem:** File size or type issue

**Solutions:**
1. Check file is under 50MB
2. Verify file extension is supported (.jpg, .png, .pdf, .docx, .txt, .md, .xlsx)
3. Try a smaller/simpler file first

### Build fails during deployment

**Problem:** Dependencies or configuration issue

**Solutions:**
1. Make sure `package.json` and `api/package.json` are both present
2. Check Vercel build logs for specific error
3. Verify all files were pushed to Git

## Local Development

To run locally with serverless functions:

```bash
# Install Vercel CLI
npm install -g vercel

# Create .env file
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Run with Vercel dev server
vercel dev

# Open browser to http://localhost:3000
```

**Note:** `npm run dev` will start the frontend but serverless functions won't work without Vercel CLI.

## Monitoring Usage

### Anthropic API Costs

Claude 3.5 Sonnet pricing:
- Input: $3 per million tokens
- Output: $15 per million tokens

Example costs:
- Small request (5k input, 2k output): ~$0.05
- Medium request (50k input, 8k output): ~$0.27
- Large request (170k input, 8k output): ~$0.63

Monitor usage at [console.anthropic.com](https://console.anthropic.com/)

### Vercel Usage

Free tier includes:
- 100GB bandwidth
- Serverless function invocations: 100 hours/month

Monitor at Vercel dashboard > Usage

## Security Checklist

✅ API key is in environment variables (NOT in code)

✅ `.env` is in `.gitignore`

✅ Serverless function validates file types

✅ File size limits are enforced (50MB)

✅ No sensitive client data is logged

## Next Steps

Once deployed and tested:

1. **Custom Domain**: Add your own domain in Vercel settings
2. **Analytics**: Add Vercel Analytics or Google Analytics
3. **Error Tracking**: Consider Sentry for production monitoring
4. **Rate Limiting**: Add request limits to prevent abuse
5. **User Authentication**: Add login if needed for team access

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Review browser console for errors
3. Test API key at console.anthropic.com
4. Verify all environment variables are set
5. Try with sample data above to isolate issue

Happy deploying! 🚀
