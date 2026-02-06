
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StyleAnalysis, PaperType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeHandwriting = async (base64Data: string, mimeType: string): Promise<StyleAnalysis> => {
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    Analyze the handwriting style in this document (${mimeType}). 
    The user is providing a sample of their own handwriting.
    
    STEP 1: RECOGNITION CHECK
    Verify if the document contains human handwriting. If it's a PDF or Image, look for ink strokes.
    If the content is purely digital text or unrecognizable, set "isRecognizable" to false.
    
    STEP 2: STYLE DNA EXTRACTION
    If recognizable, capture the "Forensic DNA" of the handwriting. 
    CRITICAL: Pay special attention to INCONSISTENCIES. 
    Does the person write some words bigger than others? 
    Does the slant change mid-sentence? 
    Are some letters squashed and others loopy?
    
    Capture:
    1. Slant Variability: (e.g., "starts vertical but slants right towards end of lines").
    2. Size Inconsistency: (e.g., "capital letters are disproportionately large, middle-of-word letters shrink").
    3. Pressure/Bleed: (e.g., "heavy ink pooling on downstrokes, scratchy on connectors").
    4. Baseline Drift: (e.g., "lines tend to float upwards as they go right").
    5. Quirks: Unique character connections or "bad" habits.
    
    Return the response in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data.split(',')[1], mimeType } },
          { text: prompt }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isRecognizable: { type: Type.BOOLEAN },
          failureReason: { type: Type.STRING },
          slant: { type: Type.STRING },
          pressure: { type: Type.STRING },
          spacing: { type: Type.STRING },
          quirks: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["isRecognizable"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as StyleAnalysis;
};

export const splitIntoPages = (text: string): string[] => {
  const words = text.split(/\s+/);
  const pages: string[] = [];
  let currentChunk = "";
  const LIMIT = 900; // Slightly lower limit to account for potentially larger/messier handwriting

  for (const word of words) {
    if ((currentChunk.length + word.length + 1) > LIMIT) {
      pages.push(currentChunk.trim());
      currentChunk = word + " ";
    } else {
      currentChunk += word + " ";
    }
  }
  if (currentChunk.trim()) {
    pages.push(currentChunk.trim());
  }
  return pages;
};

export const generateSingleHandwrittenPage = async (
  referenceImage: string,
  text: string,
  paperType: PaperType,
  styleProfile: StyleAnalysis,
  pageNumber: number,
  totalPages: number
): Promise<string | null> => {
  const model = 'gemini-2.5-flash-image';
  
  const prompt = `
    TASK: ABSOLUTE HANDWRITING FORGERY (Page ${pageNumber} of ${totalPages}).
    
    You must REPLICATE the EXACT style from the reference sample for the text: "${text}".
    
    STRICT STYLE RULES (DO NOT BEAUTIFY):
    1. INCONSISTENT SIZING: Replicate the user's tendency to make some words larger and some smaller. Do not use a uniform font size.
    2. VARIABLE SLANT: Follow the user's specific slant patterns. If they wobble, you must wobble.
    3. NATURAL MESSINESS: If the sample is "bad", the output must be "bad". Maintain shaky strokes, uneven connectors, and ink blotches.
    4. BASELINE DRIFT: Do not write in perfectly straight lines if the sample shows the user's writing drifting up or down.
    5. STROKE PRESSURE: Match the exact ink behavior (heavy, light, bleeding).
    
    CONTEXT:
    - Background: ${paperType}.
    - Description: ${styleProfile.description}.
    - Quirks to include: ${styleProfile.quirks}.
    
    The final image must look like a real photograph taken of a handwritten paper.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: referenceImage.split(',')[1], mimeType: 'image/png' } },
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "3:4"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  return null;
};
