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

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured in Vercel.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: `
You are Sentinel AI, a defensive cybersecurity mentor.

Analyze the following website security finding.

Website: ${website || "Unknown"}
Finding: ${finding}
Severity: ${severity || "Unknown"}

Give a clear, beginner-friendly defensive security explanation.

Return ONLY valid JSON in this exact structure:

{
  "title": "finding title",
  "severity": "severity level",
  "explanation": "simple explanation",
  "why_it_matters": "why this matters",
  "defensive_action": "specific defensive action",
  "steps": [
    "step 1",
    "step 2",
    "step 3",
    "step 4"
  ],
  "verification": "how to verify the fix"
}

Rules:
- Defensive cybersecurity guidance only.
- Do not provide exploitation or attack instructions.
- Do not invent facts about the website.
- Keep the advice practical and easy to understand.
`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error: "OpenAI API request failed.",
        details: data?.error?.message || "Unknown OpenAI error.",
      });
    }

    const text = data.output_text?.trim();

    if (!text) {
      return res.status(500).json({
        error: "OpenAI returned an empty response.",
      });
    }

    let assistant;

    try {
      assistant = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);

      assistant = {
        title: finding,
        severity: severity || "Unknown",
        explanation: text,
        why_it_matters:
          "This security finding should be reviewed and addressed as part of the website's defensive security configuration.",
        defensive_action:
          "Review the affected security setting and apply an appropriate defensive configuration.",
        steps: [
          "Identify the affected security setting.",
          "Review the website or server configuration.",
          "Apply the appropriate defensive configuration.",
          "Run Sentinel AI again to verify the result."
        ],
        verification:
          "Run another Sentinel AI scan and confirm that the finding has been resolved."
      };
    }

    return res.status(200).json({
      success: true,
      assistant,
      aiPowered: true
    });

  } catch (error) {
    console.error("Sentinel AI Assistant Error:", error);

    return res.status(500).json({
      error: "AI Assistant request failed.",
      details: error?.message || "Unknown server error."
    });
  }
}
