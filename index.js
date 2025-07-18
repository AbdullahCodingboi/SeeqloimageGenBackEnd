// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import { GoogleGenAI, Modality } from "@google/genai";
// import * as fs from "node:fs";
// import geminiRoute from './routes/Gemini.js';

// dotenv.config();

// const app = express();
// app.use(cors({
//   origin: "http://localhost:5173", // your Vite frontend
//   methods: ["GET", "POST", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "x-api-secret"],
// }));

// app.use(express.json());

// // 🛡️ AUTH MIDDLEWARE: Protect all routes with secret key check
// app.use((req, res, next) => {
//   const secret = req.headers["x-api-secret"];
//   const requiredSecret = process.env.INTERNAL_SECRET;
  
//   // Check if secret is provided and matches
//   if (!secret || !requiredSecret || secret !== requiredSecret) {
//     return res.status(403).json({ 
//       error: "Not allowed 🤺",
//       message: "Missing or invalid x-api-secret header" 
//     });
//   }
  
//   next();
// });

// const PORT = process.env.PORT || 3000;

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
// });

// app.post("/generate-image", async (req, res) => {
//   try {
//     const { prompt, style } = req.body;

//     if (!prompt || prompt.trim().length < 5) {
//       return res.status(400).json({ error: "Prompt is required and must be meaningful." });
//     }

//     // Combine style with prompt if style is not "none"
//     const styledPrompt =
//       style && style !== "none"
//         ? `Generate an image in the style of "${style}". ${prompt}`
//         : prompt;

//     const response = await ai.models.generateContent({
//       model: "gemini-2.0-flash-preview-image-generation",
//       contents: styledPrompt,
//       config: {
//         responseModalities: [Modality.TEXT, Modality.IMAGE],
//       },
//     });

//     const parts = response.candidates[0].content.parts;

//     let textResponse = "";
//     let imageBuffer = null;

//     for (const part of parts) {
//       if (part.text) {
//         textResponse = part.text;
//       } else if (part.inlineData) {
//         imageBuffer = Buffer.from(part.inlineData.data, "base64");
//       }
//     }

//     if (imageBuffer) {
//       fs.writeFileSync("generated-image.png", imageBuffer);
//       console.log("💾 Image saved as generated-image.png");
//     }

//     res.json({
//       message: "🖼️ Image generated successfully!",
//       description: textResponse,
//       image: `data:image/png;base64,${imageBuffer.toString("base64")}`,
//     });
//   } catch (err) {
//     console.error("❌ Error generating image:", err);
//     res.status(500).json({ error: "Failed to generate image." });
//   }
// });

// // 🔗 Mount Gemini routes
// app.use("/api/gemini", geminiRoute);

// app.listen(PORT, () => {
//   console.log(`🔥 Server running at http://localhost:${PORT}`);
// });

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI, Modality } from "@google/genai";
import geminiRoute from './routes/Gemini.js';

dotenv.config();

const app = express();

// 🌐 CORS Configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || "https://your-frontend-domain.com"
    : "http://localhost:5173",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-secret"],
}));

app.use(express.json());

// 🛡️ AUTH MIDDLEWARE
app.use((req, res, next) => {
  const secret = req.headers["x-api-secret"];
  const requiredSecret = process.env.INTERNAL_SECRET;
  
  if (!secret || !requiredSecret || secret !== requiredSecret) {
    return res.status(403).json({
      error: "Not allowed 🤺",
      message: "Missing or invalid x-api-secret header"
    });
  }
  
  next();
});

const PORT = process.env.PORT || 3000;

// ✅ Initialize Google AI with proper API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// 🎨 Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "🔥 Server is running!",
    timestamp: new Date().toISOString()
  });
});

// 🔍 List available models endpoint (helpful for debugging)
app.get("/models", async (req, res) => {
  try {
    const models = await ai.listModels();
    res.json({
      message: "Available models",
      models: models.map(model => ({
        name: model.name,
        displayName: model.displayName,
        description: model.description
      }))
    });
  } catch (error) {
    console.error("Error listing models:", error);
    res.status(500).json({ error: "Failed to list models" });
  }
});

// 🖼️ IMAGE GENERATION ENDPOINT - Using Gemini 2.0 Flash Experimental
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, style, numberOfImages = 1 } = req.body;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ 
        error: "Prompt is required and must be meaningful." 
      });
    }

    // Validate number of images
    if (numberOfImages < 1 || numberOfImages > 4) {
      return res.status(400).json({ 
        error: "Number of images must be between 1 and 4" 
      });
    }

    // Style the prompt if needed
    const styledPrompt = style && style !== "none"
      ? `Generate an image in the style of "${style}". ${prompt}`
      : prompt;

    console.log(`🎨 Generating ${numberOfImages} image(s) with prompt: ${styledPrompt}`);

    // METHOD 1: Using Gemini 2.0 Flash Experimental (correct model name)
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // ✅ Fixed: Using the correct experimental model
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

    if (!imageBuffer) {
      return res.status(500).json({ error: "No image generated" });
    }

    // ✅ Return image data without saving to disk
    res.json({
      message: "🖼️ Image generated successfully!",
      description: textResponse,
      image: `data:image/png;base64,${imageBuffer.toString("base64")}`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Error generating image:", err);
    
    // More detailed error handling
    let errorMessage = "Failed to generate image.";
    let statusCode = 500;
    
    if (err.message.includes("API key")) {
      errorMessage = "Invalid API key";
      statusCode = 401;
    } else if (err.message.includes("quota")) {
      errorMessage = "API quota exceeded";
      statusCode = 429;
    } else if (err.message.includes("model")) {
      errorMessage = "Model not available. Try using Imagen instead.";
      statusCode = 400;
    } else if (err.message.includes("404")) {
      errorMessage = "Model not found. The experimental model might not be available in your region.";
      statusCode = 404;
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      suggestion: "Try the /generate-image-imagen endpoint instead"
    });
  }
});

// 🎨 Alternative endpoint using Imagen 3 (more stable)
app.post("/generate-image-imagen", async (req, res) => {
  try {
    const { prompt, numberOfImages = 1 } = req.body;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ 
        error: "Prompt is required and must be meaningful." 
      });
    }

    console.log(`🎨 Generating ${numberOfImages} image(s) with Imagen 3: ${prompt}`);

    // METHOD 2: Using Imagen 3 (more stable and reliable)
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001', // ✅ Using Imagen 3
      prompt: prompt,
      config: {
        numberOfImages: Math.min(numberOfImages, 4),
      },
    });

    const images = [];
    for (const generatedImage of response.generatedImages) {
      const imgBytes = generatedImage.image.imageBytes;
      const base64Image = `data:image/png;base64,${imgBytes}`;
      images.push(base64Image);
    }

    res.json({
      message: "🖼️ Images generated successfully with Imagen 3!",
      images: images,
      count: images.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Error generating image with Imagen:", err);
    
    let errorMessage = "Failed to generate image with Imagen.";
    let statusCode = 500;
    
    if (err.message.includes("billing")) {
      errorMessage = "Imagen requires a paid Google Cloud account with billing enabled.";
      statusCode = 402;
    } else if (err.message.includes("quota")) {
      errorMessage = "API quota exceeded";
      statusCode = 429;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 🎨 Fallback endpoint using standard Gemini with image understanding (if above fails)
app.post("/generate-image-fallback", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ 
        error: "Prompt is required and must be meaningful." 
      });
    }

    console.log(`🎨 Attempting fallback image generation: ${prompt}`);

    // METHOD 3: Using standard Gemini models (fallback)
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Standard Gemini 2.0 Flash
      contents: `Create a detailed description for generating an image: ${prompt}. Provide a comprehensive visual description that could be used by an image generation AI.`,
    });

    const description = response.candidates[0].content.parts[0].text;

    res.json({
      message: "🖼️ Image description generated (fallback mode)",
      description: description,
      note: "This is a text description. For actual image generation, use the primary endpoints.",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Error in fallback mode:", err);
    res.status(500).json({ 
      error: "All image generation methods failed.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 🔗 Mount other routes
app.use("/api/gemini", geminiRoute);

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🔥 Server running at http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎨 Available endpoints:`);
  console.log(`   - POST /generate-image (Gemini 2.0 Flash Experimental)`);
  console.log(`   - POST /generate-image-imagen (Imagen 3)`);
  console.log(`   - POST /generate-image-fallback (Text description)`);
  console.log(`   - GET /models (List available models)`);
  
  // Check for required environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.error("⚠️  WARNING: GEMINI_API_KEY not found in environment variables");
  }
  if (!process.env.INTERNAL_SECRET) {
    console.error("⚠️  WARNING: INTERNAL_SECRET not found in environment variables");
  }
});