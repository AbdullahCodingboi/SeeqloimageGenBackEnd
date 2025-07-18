import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";
import geminiRoute from './routes/Gemini.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: "http://localhost:5173", // your Vite frontend
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-secret"],
}));

app.use(express.json());

// 🛡️ AUTH MIDDLEWARE: Protect all routes with secret key check
app.use((req, res, next) => {
  const secret = req.headers["x-api-secret"];
  const requiredSecret = process.env.INTERNAL_SECRET;
  
  // Check if secret is provided and matches
  if (!secret || !requiredSecret || secret !== requiredSecret) {
    return res.status(403).json({ 
      error: "Not allowed 🤺",
      message: "Missing or invalid x-api-secret header" 
    });
  }
  
  next();
});

const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
});

app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, style } = req.body;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ error: "Prompt is required and must be meaningful." });
    }

    // Combine style with prompt if style is not "none"
    const styledPrompt =
      style && style !== "none"
        ? `Generate an image in the style of "${style}". ${prompt}`
        : prompt;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: styledPrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response.candidates[0].content.parts;

    let textResponse = "";
    let imageBuffer = null;

    for (const part of parts) {
      if (part.text) {
        textResponse = part.text;
      } else if (part.inlineData) {
        imageBuffer = Buffer.from(part.inlineData.data, "base64");
      }
    }

    if (imageBuffer) {
      fs.writeFileSync("generated-image.png", imageBuffer);
      console.log("💾 Image saved as generated-image.png");
    }

    res.json({
      message: "🖼️ Image generated successfully!",
      description: textResponse,
      image: `data:image/png;base64,${imageBuffer.toString("base64")}`,
    });
  } catch (err) {
    console.error("❌ Error generating image:", err);
    res.status(500).json({ error: "Failed to generate image." });
  }
});

// 🔗 Mount Gemini routes
app.use("/api/gemini", geminiRoute);

app.listen(PORT, () => {
  console.log(`🔥 Server running at http://localhost:${PORT}`);
});