# BluePeak Workflow Engine

*Created for IU CBC's November hackathon.*

AI-powered tool that transforms raw client data into professional B2B SaaS marketing strategies.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **AI**: Anthropic Claude 4.5 Haiku
- **File Processing**: PDF, DOCX, XLSX, images (JPG, PNG)

## Prerequisites

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)
- Vercel CLI (required for local development)

## Quick Start

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Set up environment
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Install and configure Vercel CLI
npm install -g vercel
vercel login
vercel link --yes --project bluepeak-strategy-generator

# Start development server
./dev.sh
# or
vercel dev --listen 3000
```

Open [http://localhost:3000](http://localhost:3000)

## Important

This application requires Vercel CLI for local development. Do not use `npm run dev` - it only runs the frontend and will cause 404 errors on API calls.

## Usage

1. Input client data via text or file upload (PDF, DOCX, XLSX, images)
2. Click "Generate Strategy"
3. Review AI-generated output across three tabs:
   - Client Proposal
   - Content Strategy
   - Sample Ads
4. Download as Markdown

## Deployment

```bash
# Deploy to production
vercel --prod
```

Add `ANTHROPIC_API_KEY` as an environment variable in the Vercel dashboard.

## Documentation

See [DOCUMENTATION.md](DOCUMENTATION.md) for:
- Architecture details
- File processing
- Output format specifications
- Testing guidelines
- Troubleshooting
- API costs

## Project Structure

```
├── api/
│   ├── strategy.js          # Serverless function
│   ├── count-tokens.js      # Token counting
│   └── package.json
├── src/
│   ├── components/
│   │   ├── TextInput.jsx
│   │   ├── FileUpload.jsx
│   │   ├── StrategyDisplay.jsx
│   │   └── ClarificationDialog.jsx
│   ├── App.jsx
│   └── main.jsx
├── vercel.json
└── package.json
```