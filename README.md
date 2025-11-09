# BluePeak Strategy Generator

An AI-powered tool that transforms raw, messy client data into professional, actionable marketing strategies for B2B SaaS clients.

> **⚠️ IMPORTANT:** This app requires Vercel CLI for local development.
> - ❌ `npm run dev` will NOT work (causes 404 errors)
> - ✅ Use `vercel dev --listen 3000` instead
>
> See [Local Development](#local-development) section below for setup.

## Overview

BluePeak Marketing's Strategy Generator solves the "translation gap" - the massive amount of manual work required to turn unstructured client notes (from discovery calls, emails, whiteboards) into a professional, client-ready marketing plan.

### Key Features

- **Flexible Multi-Format Input**: Accept text, images, PDFs, DOCX, TXT, MD, and XLSX files
- **AI-Powered Analysis**: Claude 3.5 Sonnet analyzes client data with precision
- **Intelligent Clarification**: AI asks follow-up questions when data is insufficient
- **Professional Output**: Three-part strategy including:
  - Client Proposal
  - Content Strategy & Calendar
  - Sample Ad Copy
- **170k Word Processing Limit**: Handles large volumes of client data
- **Server-Side File Processing**: Secure parsing of documents and images

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **AI**: Anthropic Claude 3.5 Sonnet (`claude-3-5-sonnet-20240620`)
- **File Processing**: mammoth (DOCX), pdf-parse (PDF), xlsx (spreadsheets)

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Anthropic API key ([get one here](https://console.anthropic.com/))
- Vercel account (for deployment)

### Local Development

1. **Clone and install dependencies**:
   ```bash
   # Install frontend dependencies
   npm install

   # Install API dependencies
   cd api && npm install && cd ..
   ```

2. **Set up environment variables**:
   ```bash
   # Create .env file in the root directory
   cp .env.example .env

   # Edit .env and add your Anthropic API key:
   # ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

3. **Install Vercel CLI (REQUIRED)**:
   ```bash
   # Install globally
   npm install -g vercel

   # Login to Vercel
   vercel login

   # Link project
   vercel link --yes --project bluepeak-strategy-generator
   ```

4. **Run the development server**:
   ```bash
   # Option 1: Use the helper script (easiest!)
   ./dev.sh

   # Option 2: Use npm start
   npm start

   # Option 3: Direct Vercel command
   vercel dev --listen 3000
   ```

   **⚠️ CRITICAL:** You MUST use Vercel CLI, not the default Vite command
   - ❌ `npm run dev` → Shows warning + exits (frontend only, no API)
   - ✅ `./dev.sh` → Automated setup + dev server ✓
   - ✅ `npm start` → Runs vercel dev ✓
   - ✅ `vercel dev --listen 3000` → Manual command ✓

5. **Open your browser**:
   Navigate to `http://localhost:3000`

## Deployment to Vercel

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Initial commit: BluePeak Strategy Generator"
git push origin master
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the configuration
5. **Add Environment Variable**:
   - Go to "Environment Variables"
   - Add `ANTHROPIC_API_KEY` with your API key
   - Click "Deploy"

### Step 3: Test Your Deployment

Once deployed, Vercel will give you a URL like `https://your-project.vercel.app`. Visit it and test the application.

## How to Use

### 1. Input Client Data

You can provide client information in multiple ways:

- **Text Input**: Paste notes, email chains, or type directly
- **Upload Files**:
  - Images (JPG, PNG) - for whiteboard photos or sketches
  - Documents (PDF, DOCX, TXT, MD) - for client briefs, existing reports
  - Spreadsheets (XLSX) - for budgets, keyword lists, data

### 2. Generate Strategy

Click "Generate Strategy" and the AI will:

- Analyze all provided data
- Ask clarifying questions if information is insufficient
- Generate a complete marketing strategy if data is sufficient

### 3. Review Output

The strategy includes three tabs:

- **Client Proposal**: Problem summary, solution, scope of work, timeline & budget
- **Content Strategy**: SEO blog topics, social media calendar
- **Sample Ads**: Multiple ad variations with A/B testing ideas

### 4. Download Results

Click "Download as Markdown" to save the strategy to your computer.

## AI Behavior

### The AI Will Ask Questions When:

- Client's product/service is not clearly defined
- Target audience is vague or missing
- Budget information is absent or unclear
- Goals are too general (e.g., "want more leads")
- Images are too blurry to read
- Critical information is missing

### The AI Will NOT:

- Hallucinate or invent information
- Make assumptions about budget, audience, or goals
- Proceed with incomplete data

### The AI Will Refuse If:

- User fails to provide minimum required information
- User responds unhelpfully to clarification questions

## File Support

| File Type | Extension | Use Case |
|-----------|-----------|----------|
| Images | .jpg, .png | Whiteboard photos, sketches, mockups |
| PDF | .pdf | Client briefs, existing reports |
| Word Docs | .docx | Proposals, notes, documentation |
| Text | .txt, .md | Raw notes, transcripts |
| Spreadsheets | .xlsx | Budgets, keywords, data tables |

## Limitations

- Maximum 170,000 words total input (text + extracted file content)
- Maximum 50MB per file upload
- Images are sent to Claude's vision API (must be clear enough to read)
- Processing time: 10-60 seconds depending on input volume

## Project Structure

```
CBC-Hackathon/
├── api/
│   ├── strategy.js          # Serverless function (file parsing + AI)
│   └── package.json          # API dependencies
├── src/
│   ├── components/
│   │   ├── TextInput.jsx     # Text area for pasted notes
│   │   ├── FileUpload.jsx    # Drag-and-drop file uploader
│   │   ├── StrategyDisplay.jsx  # Three-tab results display
│   │   └── ClarificationDialog.jsx  # Q&A interface
│   ├── App.jsx               # Main application logic
│   ├── main.jsx              # React entry point
│   └── index.css             # Tailwind CSS imports
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json               # Vercel configuration
└── README.md
```

## Troubleshooting

### "API request failed: 404 Not Found"
**Cause:** Using `npm run dev` instead of `vercel dev`

**Solution:**
```bash
# Stop current server (Ctrl+C)
# Then run:
vercel dev --listen 3000
```

### "API request failed: 500"
**Cause:** Missing or invalid Anthropic API key

**Solution:**
- Check that `ANTHROPIC_API_KEY` is set in your `.env` file (local) or Vercel environment variables (production)
- Verify your API key is valid at [console.anthropic.com](https://console.anthropic.com/)

### "Cannot read properties of undefined"
**Cause:** Missing dependencies

**Solution:**
```bash
# Install in root
npm install

# Install in api folder
cd api && npm install && cd ..
```

### "Project names cannot contain '---'"
**Cause:** Vercel project naming issue

**Solution:**
```bash
vercel link --yes --project bluepeak-strategy-generator
```

### Files not uploading
**Cause:** File size or type issue

**Solution:**
- Check file size (max 50MB)
- Verify file extension is supported: .jpg, .png, .pdf, .docx, .txt, .md, .xlsx
- Ensure serverless function has enough memory (configured in `vercel.json`)

### Local development not working
**Cause:** Not using Vercel CLI

**Solution:**
- ❌ NEVER use `npm run dev` - it only runs the frontend
- ✅ ALWAYS use `vercel dev --listen 3000` - runs frontend + API

## Future Enhancements

- Add conversation history persistence (localStorage)
- Support for more file types (PPT, Google Docs)
- Real-time collaboration features
- Export to PDF, DOCX
- Integration with CRM systems
- Custom branding for different agencies

## License

Proprietary - BluePeak Marketing

## Support

For issues or questions, contact the development team.
