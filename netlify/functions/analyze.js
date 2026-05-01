const OpenAI = require("openai");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_error) {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const imageDataUrl = payload?.imageDataUrl;
  if (!imageDataUrl || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageDataUrl)) {
    return json(400, { ok: false, error: "imageDataUrl must be a valid base64 image data URL." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(200, {
      ok: true,
      data: {
        source: "fallback",
        summary: "Set OPENAI_API_KEY in Netlify environment variables for real AI analysis.",
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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await client.chat.completions.create({
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
              image_url: { url: imageDataUrl }
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

    return json(200, { ok: true, data: parsed });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error?.message || "Unexpected error during image analysis."
    });
  }
};
