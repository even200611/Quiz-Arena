
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from 'firebase/ai'

import mammoth from 'mammoth'
import { app } from './firebase'

const ai = getAI(app, {
  backend: new GoogleAIBackend(),
})

const model = getGenerativeModel(ai, {
  model: 'gemini-3.8-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.5,
    maxOutputTokens: 8192,
  },
})

const MAX_FILE_SIZE = 14 * 1024 * 1024
const MAX_TEXT_LENGTH = 100000
const MAX_QUESTIONS = 60

function extractJson(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')

  try {
    return JSON.parse(cleaned)
  } catch {
    const arrayStart = cleaned.indexOf('[')
    const arrayEnd = cleaned.lastIndexOf(']')

    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1))
    }

    const objectStart = cleaned.indexOf('{')
    const objectEnd = cleaned.lastIndexOf('}')

    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(cleaned.slice(objectStart, objectEnd + 1))
    }

    throw new Error(
      'The AI returned an invalid or incomplete response. Please try again.'
    )
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => {
      reject(new Error('Could not read the selected file.'))
    }

    reader.readAsDataURL(file)
  })
}

async function fileToPdfPart(file) {
  const dataUrl = await readFileAsDataUrl(file)
  const base64 = String(dataUrl).split(',')[1]

  if (!base64) {
    throw new Error('Could not prepare the PDF for AI processing.')
  }

  return {
    inlineData: {
      data: base64,
      mimeType: 'application/pdf',
    },
  }
}

async function extractDocxText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const extractedText = String(result?.value || '').trim()

    if (!extractedText) {
      throw new Error(
        'No readable text was found in the Word document.'
      )
    }

    return extractedText.slice(0, MAX_TEXT_LENGTH)
  } catch (error) {
    if (error?.message?.includes('No readable text')) {
      throw error
    }

    console.error('DOCX extraction error:', error)

    throw new Error(
      'Could not read this Word document. Please make sure it is a valid .docx file.'
    )
  }
}

function estimateQuestionCount(text) {
  const wordCount = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

  // Estimate approximately one question for every 180 words.
  // Keep a practical minimum and maximum to avoid empty or oversized quizzes.
  return Math.min(
    MAX_QUESTIONS,
    Math.max(5, Math.ceil(wordCount / 180))
  )
}

function normalizeQuestion(item) {
  const question = String(item?.question || '').trim()

  const options = Array.isArray(item?.options)
    ? item.options
        .map((option) => String(option ?? '').trim())
        .slice(0, 3)
    : []

  const correctAnswer = Number(item?.correctAnswer)

  const normalizedOptions = options.map((option) =>
    option.toLocaleLowerCase()
  )

  const valid =
    question.length > 0 &&
    options.length === 3 &&
    options.every((option) => option.length > 0) &&
    new Set(normalizedOptions).size === 3 &&
    Number.isInteger(correctAnswer) &&
    correctAnswer >= 0 &&
    correctAnswer <= 2

  if (!valid) return null

  return {
    question,
    options,
    correctAnswer,
    explanation: String(item?.explanation || '').trim(),
  }
}

export async function generateQuizQuestions({
  topic = '',
  material = '',
  count = 'auto',
  pdf = null,
  file = null,
} = {}) {
  const selectedFile = file || pdf

  const cleanTopic = String(topic).trim().slice(0, 160)
  const cleanMaterial = String(material).trim()

  if (!cleanTopic && !cleanMaterial && !selectedFile) {
    throw new Error(
      'Upload a PDF or Word reviewer, enter a topic, or paste learning material first.'
    )
  }

  if (selectedFile) {
    const extension = String(selectedFile.name || '')
      .split('.')
      .pop()
      .toLowerCase()

    const isPdf =
      selectedFile.type === 'application/pdf' ||
      extension === 'pdf'

    const isDocx =
      extension === 'docx' ||
      selectedFile.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    if (!isPdf && !isDocx) {
      throw new Error(
        'Unsupported file. Please upload a PDF or Word document (.docx). For older .doc files, save or convert them to .docx first.'
      )
    }

    if (selectedFile.size === 0) {
      throw new Error('The selected file is empty.')
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      throw new Error(
        'The selected file is too large. Please choose a file up to 14 MB.'
      )
    }
  }

  let documentText = ''
  let pdfPart = null
  let sourceType = ''

  if (selectedFile) {
    const extension = String(selectedFile.name || '')
      .split('.')
      .pop()
      .toLowerCase()

    if (extension === 'pdf' || selectedFile.type === 'application/pdf') {
      sourceType = 'PDF'
      pdfPart = await fileToPdfPart(selectedFile)
    } else if (extension === 'docx') {
      sourceType = 'Microsoft Word document'
      documentText = await extractDocxText(selectedFile)
    }
  }

  const combinedText = [
    cleanMaterial,
    documentText,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_TEXT_LENGTH)

  const isAutoCount =
    count === 'auto' ||
    count === null ||
    count === undefined ||
    String(count).toLowerCase() === 'auto'

  const requestedCount = isAutoCount
    ? combinedText
      ? estimateQuestionCount(combinedText)
      : null
    : Math.min(
        MAX_QUESTIONS,
        Math.max(1, Math.floor(Number(count) || 5))
      )

  const countInstruction = isAutoCount
    ? requestedCount
      ? `Create exactly ${requestedCount} questions. This number was estimated from the amount of learning material.`
      : `Automatically decide the appropriate number of questions based on the actual amount of useful information in the PDF. Create between 5 and ${MAX_QUESTIONS} questions. Do not create unnecessary or repetitive questions just to increase the count.`
    : `Create exactly ${requestedCount} questions.`

  const prompt = `
You are an expert educational quiz creator for Quiz Arena.

YOUR TASK:
Create high-quality multiple-choice questions based on the supplied learning material.

QUESTION COUNT:
${countInstruction}

${cleanTopic ? `ADDITIONAL TOPIC:
${cleanTopic}
` : ''}

${combinedText ? `LEARNING MATERIAL:
${combinedText}
` : ''}

${sourceType === 'PDF' ? `
PDF DOCUMENT:
Carefully read and analyze the attached PDF.
Use its actual information as the primary source.
Consider its definitions, concepts, examples, tables, and educational content.
Do not invent facts that are not supported by the document.
` : ''}

IMPORTANT QUESTION RULES:
1. Questions must be based on the supplied reviewer or learning material.
2. Cover the important topics and concepts throughout the material.
3. Do not focus only on the first pages or first paragraphs.
4. Questions must be educational, clear, and accurate.
5. Avoid duplicate or nearly identical questions.
6. Use a good mixture of recall, understanding, and application questions.
7. Every question must have exactly 3 distinct answer options.
8. There must be exactly ONE correct answer per question.
9. correctAnswer must be an integer: 0, 1, or 2.
10. Include a useful but concise explanation for every answer.
11. Do not create questions whose answers are not supported by the material.
12. Use clear English.
13. Return valid JSON only. Do not include Markdown or extra commentary.

REQUIRED JSON FORMAT:
{
  "questions": [
    {
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C"
      ],
      "correctAnswer": 0,
      "explanation": "Short explanation based on the reviewer."
    }
  ]
}
`

  const content = [prompt]

  if (pdfPart) {
    content.push(pdfPart)
  }

  let result

  try {
    result = await model.generateContent(content)
  } catch (error) {
    console.error('Firebase AI Logic request failed:', {
      code: error?.code,
      message: error?.message,
      customData: error?.customData,
    })

    // Preserve the original Firebase error so App.jsx can show
    // the actual reason instead of hiding it behind a generic message.
    throw error
  }

  const responseText = result?.response?.text?.()

  if (!responseText) {
    throw new Error(
      'The AI did not return any questions. Please try again.'
    )
  }

  const parsed = extractJson(responseText)

  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : parsed?.questions

  if (!Array.isArray(rawQuestions)) {
    throw new Error(
      'The AI response has an unexpected format. Please try again.'
    )
  }

  const questions = rawQuestions
    .slice(0, MAX_QUESTIONS)
    .map(normalizeQuestion)
    .filter(Boolean)

  if (questions.length === 0) {
    throw new Error(
      'The AI could not create valid questions from this material. Try another file or clearer learning notes.'
    )
  }

  if (!isAutoCount && questions.length < requestedCount) {
    console.warn(
      `AI returned ${questions.length} valid questions instead of ${requestedCount}.`
    )
  }

  return questions
}
