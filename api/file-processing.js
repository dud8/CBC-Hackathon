import fs from 'fs'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import xlsx from 'xlsx'

const PDF_SIZE_LIMIT_MB = 32
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif'])

export const normalizeTextInput = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const firstString = value.find((item) => typeof item === 'string')
    return firstString ?? ''
  }
  return ''
}

const qualifiesForDirectPDF = (file) => {
  try {
    if (!file?.filepath) return false
    const stats = fs.statSync(file.filepath)
    const sizeInMB = stats.size / (1024 * 1024)
    return sizeInMB < PDF_SIZE_LIMIT_MB
  } catch {
    return false
  }
}

const readFileAsBase64 = (filepath) => fs.readFileSync(filepath).toString('base64')

const formatFileHeader = (filename = 'FILE') =>
  filename.toUpperCase().replace(/[^A-Z0-9]/g, '_')

export async function parseUploadedFiles(files = [], logger = null) {
  const results = []

  for (const file of files) {
    if (!file) continue
    const filename = file.originalFilename || file.name || 'upload'
    const ext = (filename.split('.').pop() || '').toLowerCase()

    try {
      if (!file.filepath) {
        throw new Error('Missing temporary filepath for uploaded file')
      }

      if (ext === 'pdf') {
        if (qualifiesForDirectPDF(file)) {
          logger?.debug?.('PDF qualifies for direct submission', {
            filename,
            size: file?.size
          })
          results.push({
            type: 'pdf',
            filename,
            data: readFileAsBase64(file.filepath)
          })
        } else {
          const buffer = fs.readFileSync(file.filepath)
          const data = await pdfParse(buffer)
          logger?.debug?.('PDF parsed server-side', {
            filename,
            extractedLength: data.text.length
          })
          results.push({
            type: 'text',
            filename,
            content: data.text
          })
        }
        continue
      }

      if (ext === 'docx') {
        const buffer = fs.readFileSync(file.filepath)
        const result = await mammoth.extractRawText({ buffer })
        logger?.debug?.('DOCX parsed', { filename, extractedLength: result.value.length })
        results.push({
          type: 'text',
          filename,
          content: result.value
        })
        continue
      }

      if (ext === 'xlsx' || ext === 'xls') {
        const workbook = xlsx.readFile(file.filepath)
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const csv = xlsx.utils.sheet_to_csv(sheet)
        logger?.debug?.('Spreadsheet parsed to CSV text', {
          filename,
          extractedLength: csv.length
        })
        results.push({
          type: 'text',
          filename,
          content: csv
        })
        continue
      }

      if (TEXT_EXTENSIONS.has(ext)) {
        const text = fs.readFileSync(file.filepath, 'utf-8')
        logger?.debug?.('Plain text file parsed', {
          filename,
          extractedLength: text.length
        })
        results.push({
          type: 'text',
          filename,
          content: text
        })
        continue
      }

      if (IMAGE_EXTENSIONS.has(ext)) {
        const base64 = readFileAsBase64(file.filepath)
        const mimeType =
          ext === 'png'
            ? 'image/png'
            : ext === 'gif'
              ? 'image/gif'
              : 'image/jpeg'
        logger?.debug?.('Image prepared for direct submission', {
          filename,
          mimeType
        })
        results.push({
          type: 'image',
          filename,
          data: base64,
          mimeType
        })
        continue
      }

      logger?.warn?.('Unsupported file type encountered', { filename, ext })
    } catch (error) {
      logger?.error?.(`Error parsing file ${filename}:`, error)
      results.push({
        type: 'error',
        filename,
        error: error.message || 'Unknown error parsing upload'
      })
    }
  }

  return results
}

export function buildContextBlob(textInput, parsedFiles = []) {
  let blob = ''
  const normalizedInput = normalizeTextInput(textInput)

  if (normalizedInput.trim()) {
    blob += '---START_PASTED_TEXT---\n'
    blob += normalizedInput
    blob += '\n---END_PASTED_TEXT---\n\n'
  }

  for (const file of parsedFiles) {
    if (file.type === 'text') {
      const safeName = formatFileHeader(file.filename)
      blob += `---START_${safeName}---\n`
      blob += file.content || ''
      blob += `\n---END_${safeName}---\n\n`
    } else if (file.type === 'error') {
      const safeName = formatFileHeader(file.filename)
      blob += `---ERROR_PARSING_${safeName}---\n`
      blob += `Error: ${file.error || 'Unknown error'}\n\n`
    }
  }

  return {
    blob,
    images: parsedFiles.filter((file) => file.type === 'image'),
    pdfs: parsedFiles.filter((file) => file.type === 'pdf')
  }
}
