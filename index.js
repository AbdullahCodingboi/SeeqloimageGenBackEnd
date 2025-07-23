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
import { GoogleGenAI } from "@google/genai";
import geminiRoute from './routes/Gemini.js';

dotenv.config();

const app = express();

// 🌐 CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "https://seeqlo.com",
  "https://seeqlo-dev.vercel.app",
  "https://seeqloimagegen.netlify.app/"
  // Add more as needed
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("⛔ CORS blocked: Origin not allowed"));
    }
  },
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

// ✅ Initialize Google AI with VERTEX_KEY
const ai = new GoogleGenAI({
  apiKey: process.env.VERTEX_KEY,
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

// 🖼️ IMAGE GENERATION ENDPOINT - Using Imagen 4.0
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, style, numberOfImages = 1 } = req.body;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ 
        error: "Prompt is required and must be meaningful." 
      });
    }

    // Validate number of images (Imagen 4.0 supports up to 4)
    const imageCount = Math.min(Math.max(numberOfImages, 1), 4);

    // Style the prompt if needed
    const styledPrompt = style && style !== "none"
      ? `Generate an image in the style of "${style}". ${prompt}`
      : prompt;

    console.log(`🎨 Generating ${imageCount} image(s) with Imagen 4.0: ${styledPrompt}`);

    // Using Imagen 4.0 Generate Preview
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-preview-06-06',
      prompt: styledPrompt,
      config: {
        numberOfImages: imageCount,
      },
    });

    // Process generated images
    const images = [];
    let idx = 1;
    
    for (const generatedImage of response.generatedImages) {
      const imgBytes = generatedImage.image.imageBytes;
      const base64Image = `data:image/png;base64,${imgBytes}`;
      images.push({
        id: idx,
        data: base64Image,
        filename: `imagen-${idx}.png`
      });
      idx++;
    }

    res.json({
      message: `🖼️ ${images.length} image(s) generated successfully with Imagen 4.0!`,
      prompt: styledPrompt,
      images: images,
      count: images.length,
      model: "imagen-4.0-generate-preview-06-06",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Error generating image with Imagen 4.0:", err);
    
    let errorMessage = "Failed to generate image with Imagen 4.0.";
    let statusCode = 500;
    
    if (err.message.includes("API key") || err.message.includes("authentication")) {
      errorMessage = "Invalid VERTEX_KEY or authentication failed";
      statusCode = 401;
    } else if (err.message.includes("billing")) {
      errorMessage = "Imagen 4.0 requires a paid Google Cloud account with billing enabled.";
      statusCode = 402;
    } else if (err.message.includes("quota")) {
      errorMessage = "API quota exceeded";
      statusCode = 429;
    } else if (err.message.includes("model")) {
      errorMessage = "Imagen 4.0 model not available. Check if it's enabled in your project.";
      statusCode = 400;
    } else if (err.message.includes("404")) {
      errorMessage = "Imagen 4.0 model not found. It might not be available in your region.";
      statusCode = 404;
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      model: "imagen-4.0-generate-preview-06-06"
    });
  }
});

// 🎨 Alternative endpoint using Imagen 3 (fallback)
app.post("/generate-image-imagen3", async (req, res) => {
  try {
    const { prompt, style, numberOfImages = 1 } = req.body;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ 
        error: "Prompt is required and must be meaningful." 
      });
    }

    const imageCount = Math.min(Math.max(numberOfImages, 1), 4);
    
    // Style the prompt if needed
    const styledPrompt = style && style !== "none"
      ? `Generate an image in the style of "${style}". ${prompt}`
      : prompt;

    console.log(`🎨 Generating ${imageCount} image(s) with Imagen 3: ${styledPrompt}`);

    // Fallback to Imagen 3
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: styledPrompt,
      config: {
        numberOfImages: imageCount,
      },
    });

    const images = [];
    let idx = 1;
    
    for (const generatedImage of response.generatedImages) {
      const imgBytes = generatedImage.image.imageBytes;
      const base64Image = `data:image/png;base64,${imgBytes}`;
      images.push({
        id: idx,
        data: base64Image,
        filename: `imagen3-${idx}.png`
      });
      idx++;
    }

    res.json({
      message: `🖼️ ${images.length} image(s) generated successfully with Imagen 3!`,
      prompt: styledPrompt,
      images: images,
      count: images.length,
      model: "imagen-3.0-generate-001",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Error generating image with Imagen 3:", err);
    
    let errorMessage = "Failed to generate image with Imagen 3.";
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
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      model: "imagen-3.0-generate-001"
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
  console.log(`   - POST /generate-image (Imagen 4.0 - Primary)`);
  console.log(`   - POST /generate-image-imagen3 (Imagen 3.0 - Fallback)`);
  console.log(`   - GET /models (List available models)`);
  
  // Check for required environment variables
  if (!process.env.VERTEX_KEY) {
    console.error("⚠️  WARNING: VERTEX_KEY not found in environment variables");
  }
  if (!process.env.INTERNAL_SECRET) {
    console.error("⚠️  WARNING: INTERNAL_SECRET not found in environment variables");
  }
  
  console.log(`🔑 Using VERTEX_KEY for authentication`);
});