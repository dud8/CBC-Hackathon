# BluePeak Workflow Engine

AI-powered tool that transforms raw client data into professional B2B SaaS marketing strategies.

*Created for IU CBC's November 25' "hackathon". (Vibe) coded in ~2 hours, demo in ~10min, pitch deck in ~30min.*

- [Link to demo](https://vimeo.com/1135121007?share=copy&fl=sv&fe=ci)
- [Link to pitch deck](https://docs.google.com/presentation/d/1usuXClyhlttP7iCZhoJMPhrRsqZTmGJM)
- [Link to challenge details](https://docs.google.com/document/d/1hOeOZ3HGMUjfnJfiB1T6DQZ2AQ270gC3gm7zt6dRc5k/edit?usp=sharing)

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

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── ClarificationDialog.jsx
│   │   ├── FileUpload.jsx
│   │   ├── StrategyDisplay.jsx
│   │   └── TextInput.jsx
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── api/                     # Serverless functions + helpers
│   ├── count-tokens.js
│   ├── file-processing.js
│   ├── prompts.js
│   ├── section-chat.js
│   ├── strategy.js
│   ├── package.json
│   └── package-lock.json
├── mock_data/               # Sample client uploads for local testing
├── .env.example             # Template for required secrets
├── dev.sh                   # Launches Vercel + frontend locally
├── index.html               # Vite entry HTML
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── vercel.json
```
