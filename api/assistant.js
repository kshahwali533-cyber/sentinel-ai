import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed.",
    });
  }

  try {
    const { finding, severity, website } = req.body || {};

    if (!finding) {
      return res.status(400).json({
        error: "Security finding is required.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured.",
      });
    }

    const prompt = `
You are Sentinel AI, a defensive cybersecurity mentor.

Analyze this website security finding and provide beginner-friendly,
accurate, defensive guidance.

Website: ${website || "Unknown"}
Finding: ${finding}
Severity: ${severity || "Unknown"}

Return ONLY valid JSON with exactly these fields:
{
  "title": "finding title",
  "severity": "severity level",
  "explanation": "simple explanation of what the finding means",
  "why_it_matters": "why this matters for website security",
  "defensive_action": "specific defensive action the website owner should take",
  "steps": [
    "step 1",
    "step 2",
    "step 3",
    "step 4"
  ],
  "verification": "how to safely verify the fix"
}

Important:
- Give defensive guidance only.
- Do not provide instructions for attacking, exploiting, bypassing, or compromising systems.
- Do not invent facts about the website beyond the supplied finding.
- Keep the language simple and practical.
`;

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: prompt,
    });

    const text = response.output_text?.trim();

    if (!text) {
      return res.status(500).json({
        error: "AI returned an empty response.",
      });
    }

    let assistant;

    try {
      assistant = JSON.parse(text);
    } catch {
      assistant = {
        title: finding,
        severity: severity || "Unknown",
        explanation: text,
        why_it_matters:
          "Review this security finding and apply an appropriate defensive configuration.",
        defensive_action:
          "Review the affected security setting and apply a safe configuration appropriate for the website.",
        steps: [
          "Identify the affected security setting.",
          "Review the website or server configuration.",
          "Apply the appropriate defensive configuration.",
          "Run the Sentinel AI scan again to verify the result.",
        ],
        verification:
          "Re-scan the website and confirm that the finding has been resolved.",
      };
    }

    return res.status(200).json({
      success: true,
      assistant,
    });
  } catch (error) {
    console.error("Sentinel AI Assistant Error:", error);

    return res.status(500).json({
      error: "AI Assistant request failed.",
      message: error?.message || "Unknown error",
    });
  }
}
