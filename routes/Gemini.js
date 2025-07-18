// routes/gemini.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

// 🔐 Get the Gemini API key from environment variables
const getApiKey = () => {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
};

// 🧠 Generate Gemini response from prompt
const generateGeminiResponse = async (prompt, temperature = 0.7) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Gemini API key not found in environment variables');

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // 🎯 Convert prompt to string and validate
  if (prompt === undefined || prompt === null) {
    throw new Error('Prompt is missing');
  }

  const promptStr = String(prompt).trim();
  if (promptStr.length === 0) {
    throw new Error('Prompt must not be empty');
  }

  // 📡 Send request to Gemini API
  const response = await axios.post(geminiUrl, {
    contents: [{ parts: [{ text: promptStr }] }],
    generationConfig: {
      temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  // 🧾 Extract the response text
  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Invalid response from Gemini API');

  return text;
};
router.post('/',async (req,res)=>{
    try{
        const { prompt, temperature } = req.body;
        const response = await generateGeminiResponse(prompt, temperature);
        res.json({ response });
    }catch (error) {
        console.error('Error generating Gemini response:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
})
export default router;