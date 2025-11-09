import Anthropic from '@anthropic-ai/sdk'
import formidable from 'formidable'
import fs from 'fs'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import xlsx from 'xlsx'

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'

const normalizeTextInput = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const firstString = value.find(item => typeof item === 'string')
    return firstString ?? ''
  }
  return ''
}

// The exact system prompt as specified
const SYSTEM_PROMPT = `You are "BluePeak-AI," an elite, world-class marketing strategist and senior innovation consultant. Your tone is professional, hyper-competent, precise, and data-driven. You exist to serve the account managers at BluePeak Marketing by turning their raw, messy client data into polished, actionable, and brilliant strategic plans.

**YOUR CORE DIRECTIVES:**

1. **NO HALLUCINATION:** Your primary directive is to _never_ invent information, assume details, or hallucinate. Your value is in precision. If a client's budget, goal, or target audience is not in the provided data, you _do not invent it_.

2. **ANALYZE FIRST:** You _must_ first analyze all provided client data. Use the \`<thinking>...</thinking>\` tags to perform a step-by-step analysis of the input quality _before_ you generate any response.

3. **INTERVIEW IF NECESSARY:** If the provided data is insufficient (e.g., blurry image, vague text like "we want more leads," missing budget, missing goals), you _must not_ proceed. Your _only_ response must be to ask clarifying questions. You are an expert interviewer. Your job is to extract the _exact_ information needed to build a world-class plan.

4. **ADHERE TO FORMAT:** Your responses _must_ strictly adhere to one of the three XML formats specified: \`<clarification_needed>\`, \`<full_plan>\`, or \`<cannot_proceed>\`. There is no other valid output. This is critical for the application's UI to function.`

// Word counter utility
function countWords(text) {
  const normalized = normalizeTextInput(text).trim()
  if (!normalized) return 0
  return normalized.split(/\s+/).filter(word => word.length > 0).length
}

// Parse uploaded files
async function parseFiles(files) {
  const results = []

  for (const file of files) {
    try {
      const filename = file.originalFilename || file.name
      const ext = filename.split('.').pop().toLowerCase()
      let text = ''

      if (ext === 'pdf') {
        const buffer = fs.readFileSync(file.filepath)
        const data = await pdfParse(buffer)
        text = data.text
      } else if (ext === 'docx') {
        const buffer = fs.readFileSync(file.filepath)
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = xlsx.readFile(file.filepath)
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        text = xlsx.utils.sheet_to_csv(sheet)
      } else if (ext === 'txt' || ext === 'md') {
        text = fs.readFileSync(file.filepath, 'utf-8')
      } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        // For images, we'll send them to Claude directly
        const buffer = fs.readFileSync(file.filepath)
        const base64 = buffer.toString('base64')
        const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
        results.push({
          type: 'image',
          filename,
          data: base64,
          mimeType
        })
        continue
      }

      if (text) {
        results.push({
          type: 'text',
          filename,
          content: text
        })
      }
    } catch (error) {
      console.error(`Error parsing file ${file.originalFilename}:`, error)
      results.push({
        type: 'error',
        filename: file.originalFilename,
        error: error.message
      })
    }
  }

  return results
}

// Build context blob with 170k word limit
function buildContextBlob(textInput, parsedFiles) {
  let blob = ''
  let wordCount = 0
  const MAX_WORDS = 170000

  // Add text input first
  const normalizedInput = normalizeTextInput(textInput)

  if (normalizedInput.trim()) {
    blob += '---START_PASTED_TEXT---\n'
    blob += normalizedInput
    blob += '\n---END_PASTED_TEXT---\n\n'
    wordCount += countWords(normalizedInput)
  }

  // Add parsed files
  for (const file of parsedFiles) {
    if (file.type === 'text') {
      const fileHeader = `---START_${file.filename.toUpperCase().replace(/[^A-Z0-9]/g, '_')}---\n`
      const fileFooter = `\n---END_${file.filename.toUpperCase().replace(/[^A-Z0-9]/g, '_')}---\n\n`

      const fileWords = countWords(file.content)

      if (wordCount + fileWords > MAX_WORDS) {
        // Truncate this file's content
        const remainingWords = MAX_WORDS - wordCount
        const words = file.content.split(/\s+/)
        const truncated = words.slice(0, remainingWords).join(' ')
        blob += fileHeader + truncated + '\n[TRUNCATED]' + fileFooter
        blob += '[WARNING: INPUT TRUNCATED. The provided data exceeded the 170,000-word limit and was cut short. Analysis may be incomplete.]\n'
        break
      }

      blob += fileHeader + file.content + fileFooter
      wordCount += fileWords
    } else if (file.type === 'error') {
      blob += `---ERROR_PARSING_${file.filename.toUpperCase().replace(/[^A-Z0-9]/g, '_')}---\n`
      blob += `Error: ${file.error}\n\n`
    }
  }

  return { blob, wordCount, images: parsedFiles.filter(f => f.type === 'image') }
}

// Parse XML response from Claude
function parseXMLResponse(text) {
  // Extract thinking
  const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/)
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null

  // Check for clarification_needed
  if (text.includes('<clarification_needed>')) {
    const questionsMatch = text.match(/<questions>([\s\S]*?)<\/questions>/)
    if (questionsMatch) {
      const questionsText = questionsMatch[1].trim()
      const questions = questionsText
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .filter(q => q.startsWith('<question>') || !q.startsWith('<'))
        .map(q => q.replace(/<\/?question>/g, '').trim())
        .filter(q => q.length > 0)

      return {
        type: 'clarification_needed',
        thinking,
        questions
      }
    }
  }

  // Check for full_plan
  if (text.includes('<full_plan>')) {
    const proposalMatch = text.match(/<proposal>([\s\S]*?)<\/proposal>/)
    const contentStrategyMatch = text.match(/<content_strategy>([\s\S]*?)<\/content_strategy>/)
    const sampleAdsMatch = text.match(/<sample_ads>([\s\S]*?)<\/sample_ads>/)

    return {
      type: 'full_plan',
      thinking,
      proposal: proposalMatch ? proposalMatch[1].trim() : '',
      contentStrategy: contentStrategyMatch ? contentStrategyMatch[1].trim() : '',
      sampleAds: sampleAdsMatch ? sampleAdsMatch[1].trim() : ''
    }
  }

  // Check for cannot_proceed
  if (text.includes('<cannot_proceed>')) {
    const messageMatch = text.match(/<message>([\s\S]*?)<\/message>/)
    return {
      type: 'cannot_proceed',
      thinking,
      message: messageMatch ? messageMatch[1].trim() : 'Cannot proceed without additional information.'
    }
  }

  // Fallback - couldn't parse
  return {
    type: 'error',
    message: 'Could not parse AI response. Please try again.'
  }
}

export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse form data
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024 // 50MB max
    })

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })

    const textInput = normalizeTextInput(fields.text)

    // Convert files object to array
    const fileArray = []
    for (const key in files) {
      const file = files[key]
      if (Array.isArray(file)) {
        fileArray.push(...file)
      } else {
        fileArray.push(file)
      }
    }

    // Parse all uploaded files
    const parsedFiles = await parseFiles(fileArray)

    // Build context blob
    const { blob, wordCount, images } = buildContextBlob(textInput, parsedFiles)

    // Prepare user prompt
    const userPrompt = `Here is all the client information I have. Please analyze it and generate the full strategic plan.\n\n<client_data>\n${blob}\n</client_data>`

    // Prepare message content with images if any
    const content = []

    // Add images first (if any)
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType,
          data: img.data
        }
      })
    }

    // Add text prompt
    content.push({
      type: 'text',
      text: userPrompt
    })

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      console.error('API Error: Missing ANTHROPIC_API_KEY environment variable')
      return res.status(500).json({
        type: 'error',
        message: 'Server misconfigured: ANTHROPIC_API_KEY is not set. Add it to your .env (local) or Vercel project and restart.'
      })
    }

    // Call Claude 3.5 Sonnet
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey
    })

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      temperature: 1.0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content
        }
      ]
    })

    // Extract response text
    const responseText = message.content.find(block => block.type === 'text')?.text || ''

    // Parse XML response
    const parsedResponse = parseXMLResponse(responseText)

    // Clean up temp files
    for (const file of fileArray) {
      try {
        if (file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath)
        }
      } catch (err) {
        console.error('Error cleaning up file:', err)
      }
    }

    return res.status(200).json(parsedResponse)
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({
      type: 'error',
      message: error.message || 'An error occurred while processing your request'
    })
  }
}
