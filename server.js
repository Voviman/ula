require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const preferredPort = Number(process.env.PORT || 3000);
const maxPortRetries = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are supported."));
    }
    cb(null, true);
  }
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Image file is required." });
    }

    if (!openai) {
      return res.json({
        ok: true,
        data: {
          source: "fallback",
          summary: "Set OPENAI_API_KEY to get real AI clothing analysis.",
          items: [
            {
              garmentType: "unknown",
              category: "unknown",
              brand: { name: null, confidence: 0, evidence: null },
              composition: [],
              colors: [],
              pattern: null,
              season: [],
              styleTags: [],
              confidence: 0
            }
          ],
          metadata: {
            imageQuality: "unknown",
            shootType: "unknown",
            notes: ["No AI key configured. Response is a placeholder."]
          }
        }
      });
    }

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a fashion metadata extraction assistant. Return strict JSON only. " +
            "If a value is unknown, use null (or empty array where appropriate). " +
            "Never invent exact composition if not visible; include confidence values between 0 and 1."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this clothing image and return JSON with this structure: " +
                "{summary:string,items:[{garmentType:string,category:string,genderTarget:string|null," +
                "brand:{name:string|null,confidence:number,evidence:string|null}," +
                "composition:[{material:string,percent:number|null,confidence:number}]," +
                "colors:string[],pattern:string|null,season:string[],styleTags:string[]," +
                "logosText:string[],condition:string|null,confidence:number}]," +
                "metadata:{imageQuality:string,shootType:string,notes:string[]}}"
            },
            {
              type: "image_url",
              image_url: { url: dataUrl }
            }
          ]
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { summary: raw };
    }

    return res.json({ ok: true, data: parsed });
  } catch (error) {
    const message = error?.message || "Unexpected error during image analysis.";
    return res.status(500).json({ ok: false, error: message });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: err.message });
  }
  return res.status(400).json({ ok: false, error: err.message || "Invalid upload." });
});

function startServer(port, retriesLeft) {
  const server = app.listen(port, () => {
    console.log(`Picturize app is running on http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Trying ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    if (error?.code === "EADDRINUSE") {
      console.error(
        `Failed to start server: no free port in range ${preferredPort}-${preferredPort + maxPortRetries}.`
      );
      return process.exit(1);
    }

    console.error("Failed to start server:", error);
    return process.exit(1);
  });
}

startServer(preferredPort, maxPortRetries);
