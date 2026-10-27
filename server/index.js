import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Gemini client ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Retry helper for rate limits ──
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && i < retries) {
        const delay = (i + 1) * 2000;
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ── Helper functions for recurrence analysis ──
function calculateRecurrenceProbability(probability, riskLevel, topParameters) {
  let baseProb = 10;
  if (riskLevel === 'High Risk') {
    baseProb = Math.min(60, probability);
  } else if (riskLevel === 'Moderate Risk') {
    baseProb = Math.min(30, probability);
  } else {
    baseProb = Math.min(15, probability);
  }

  const riskParameters = topParameters.filter(p => p.influence === 'risk').length;
  const protectiveParameters = topParameters.filter(p => p.influence === 'protective').length;

  const riskFactor = Math.min(0.5, riskParameters * 0.05);
  const protectiveFactor = Math.min(0.3, protectiveParameters * 0.03);

  return Math.round(Math.max(0, Math.min(100, baseProb + riskFactor - protectiveFactor)));
}

function identifyRecurrenceFactors(riskLevel, topParameters, selectedCrop) {
  const factors = [];

  if (riskLevel === 'High Risk') factors.push('High cancer risk level detected');
  else if (riskLevel === 'Moderate Risk') factors.push('Moderate cancer risk level');
  else factors.push('Low cancer risk level');

  const riskParameters = topParameters.filter(p => p.influence === 'risk');
  const protectiveParameters = topParameters.filter(p => p.influence === 'protective');

  if (riskParameters.length > 5) factors.push('Multiple risk parameters present');
  if (protectiveParameters.length > 3) factors.push('Several protective factors detected');

  if (selectedCrop && selectedCrop.includes('CC')) factors.push('CC view analysis');
  else if (selectedCrop && selectedCrop.includes('MLO')) factors.push('MLO view analysis');

  if (factors.length < 2) {
    factors.push('Standard screening recommended');
    if (factors.length < 3) factors.push('Regular follow-up monitoring');
  }

  return factors.slice(0, 3);
}

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Mammogram Analysis ──
app.post('/api/analyze', upload.fields([
  { name: 'cc', maxCount: 1 },
  { name: 'mlo', maxCount: 1 }
]), async (req, res) => {
  try {
    const ccFile = req.files?.cc?.[0];
    const mloFile = req.files?.mlo?.[0];

    if (!ccFile || !mloFile) {
      return res.status(400).json({ error: 'Please upload both CC and MLO view images.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

    const ccImage = {
      inlineData: {
        data: ccFile.buffer.toString('base64'),
        mimeType: ccFile.mimetype
      }
    };

    const mloImage = {
      inlineData: {
        data: mloFile.buffer.toString('base64'),
        mimeType: mloFile.mimetype
      }
    };

    const prompt = `You are an expert radiologist AI assistant specialized in mammogram analysis. Analyze two mammogram views:
1. CC (Cranio-Caudal) view - top-down
2. MLO (Medio-Lateral Oblique) view - angled side

Look for: tissue density, masses, calcifications, asymmetries, skin thickening, lymph nodes, breast composition.

RESPOND WITH ONLY VALID JSON (no markdown):
{
  "probability": <0-100>,
  "riskLevel": "<Low Risk|Moderate Risk|High Risk>",
  "cancerType": "<DCIS|IDC|ILC|Tubular|Medullary|Metaplastic|LCIS|No Suspicious Cancer Type Detected|Unable to Determine>",
  "typeConfidence": <0-100>,
  "recurrenceProbability": <0-100>,
  "recurrenceFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "prediction": "<Cancer Signal Detected|No Strong Cancer Signal>",
  "explanation": "<2-4 sentence explanation>",
  "selectedCrop": "<CC|MLO> - <area>",
  "focusArea": "center <x>%, <y>%, box <w>% × <h>%",
  "areaScores": [
    {"name": "top-left area", "score": <0-100>, "isSelected": false},
    {"name": "top-right area", "score": <0-100>, "isSelected": false},
    {"name": "bottom-left area", "score": <0-100>, "isSelected": false},
    {"name": "bottom-right area", "score": <0-100>, "isSelected": false},
    {"name": "center area", "score": <0-100>, "isSelected": false}
  ],
  "topParameters": [
    {"name": "<param>", "value": <number>, "influence": "<risk|protective>"},
    ...9 more parameters
  ],
  "disclaimer": "This AI analysis is for educational and screening assistance only. It does NOT replace professional medical diagnosis."
}

Rules:
- areaScores: exactly 5 entries, mark highest as isSelected: true
- topParameters: exactly 10 from: radius_mean/se/worst, texture_mean/se/worst, perimeter_mean/se/worst, area_mean/se/worst, smoothness_mean/se/worst, compactness_mean/se/worst, concavity_mean/se/worst, concave points_mean/se/worst, symmetry_mean/se/worst, fractal_dimension_mean/se/worst
- influence: either "risk" or "protective"
- probability: 0-20%=normal, 20-40%=likely benign, 40-60%=indeterminate, 60-80%=suspicious, 80-100%=highly suspicious
- Cancer Type: DCIS=microcalcifications; IDC=spiculated mass; ILC=linear patterns; Tubular=tubular structures; Medullary=central necrosis; Metaplastic=mixed features; LCIS=linear lesions
- typeConfidence: 0-30 if no cancer, higher if suspicious
- recurrenceProbability: 5-year estimate based on characteristics
- Be conservative, recommend follow-up when uncertain`;

    const result = await withRetry(() => model.generateContent([prompt, ccImage, mloImage]));
    const responseText = result.response.text();

    let analysisResult;
    try {
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleanJson);

      if (analysisResult.probability === undefined || analysisResult.riskLevel === undefined) {
        throw new Error('Invalid response structure');
      }

      // Add computed recurrence data if not present
      if (!analysisResult.recurrenceProbability) {
        analysisResult.recurrenceProbability = calculateRecurrenceProbability(
          analysisResult.probability,
          analysisResult.riskLevel,
          analysisResult.topParameters || []
        );
      }
      if (!analysisResult.recurrenceFactors) {
        analysisResult.recurrenceFactors = identifyRecurrenceFactors(
          analysisResult.riskLevel,
          analysisResult.topParameters || [],
          analysisResult.selectedCrop
        );
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      analysisResult = {
        probability: 15,
        riskLevel: 'Low Risk',
        cancerType: 'No Suspicious Cancer Type Detected',
        typeConfidence: 0,
        recurrenceProbability: 5,
        recurrenceFactors: ['Regular screening recommended'],
        prediction: 'Analysis Inconclusive',
        explanation: 'Unable to produce structured analysis. Please try uploading clearer images.',
        selectedCrop: 'CC - center area',
        focusArea: 'center 50.0%, 50.0%, box 50.0% × 50.0%',
        areaScores: [
          { name: 'top-left area', score: 50.0, isSelected: false },
          { name: 'top-right area', score: 50.0, isSelected: false },
          { name: 'bottom-left area', score: 50.0, isSelected: false },
          { name: 'bottom-right area', score: 50.0, isSelected: false },
          { name: 'center area', score: 50.0, isSelected: true },
        ],
        topParameters: [
          { name: 'area_se', value: 0, influence: 'risk' },
          { name: 'area_worst', value: 0, influence: 'risk' },
          { name: 'concave points_se', value: 0, influence: 'protective' },
          { name: 'perimeter_se', value: 0, influence: 'risk' },
          { name: 'area_mean', value: 0, influence: 'protective' },
          { name: 'radius_se', value: 0, influence: 'risk' },
          { name: 'concave points_worst', value: 0, influence: 'risk' },
          { name: 'concavity_se', value: 0, influence: 'protective' },
          { name: 'concavity_worst', value: 0, influence: 'risk' },
          { name: 'concave points_mean', value: 0, influence: 'risk' },
        ],
        disclaimer: 'This AI analysis is for educational purposes only and does NOT replace professional medical diagnosis.'
      };
    }

    res.json(analysisResult);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze images. Please try again.' });
  }
});

// ── Chatbot ──
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

    const systemPrompt = `You are a compassionate and knowledgeable breast cancer awareness assistant called "BCA Care Bot". Your role is to:
1. Provide accurate, evidence-based information about breast cancer
2. Help users understand breast cancer types, symptoms, risk factors, and prevention
3. Encourage regular screening and early detection
4. Offer emotional support and encouragement
5. Direct users to seek professional medical advice for personal health concerns

IMPORTANT RULES:
- NEVER provide a diagnosis or interpret specific medical results
- NEVER recommend specific treatments or medications
- Always encourage consulting with healthcare professionals
- Be empathetic and supportive in tone
- Keep responses concise (2-4 paragraphs max)
- Use simple, accessible language
- If asked about the app, explain you help with breast cancer awareness`;

    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I am the BCA Care Bot, a breast cancer awareness assistant. I will provide helpful, empathetic, and evidence-based information while always encouraging professional medical consultation. How can I help you today?' }] },
        ...chatHistory
      ]
    });

    const result = await withRetry(() => chat.sendMessage(message));
    const reply = result.response.text();

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`🩺 AI Breast Cancer Care server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
}); 
