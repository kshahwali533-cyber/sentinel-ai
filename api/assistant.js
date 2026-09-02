export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  const { finding, severity, website } = req.body || {};

  if (!finding) {
    return res.status(400).json({
      error: "Security finding is required."
    });
  }

  const advice = {
    title: finding,
    severity: severity || "Unknown",
    website: website || "Unknown",
    explanation:
      "This security finding may weaken the security of the website. It should be reviewed and corrected according to the website's technology and deployment environment.",
    steps: [
      "Identify the affected security setting.",
      "Review the website/server configuration.",
      "Apply the recommended security configuration.",
      "Run the Sentinel AI scan again to verify the fix."
    ],
    note:
      "Do not apply security changes blindly. Test configuration changes before deploying them to production."
  };

  return res.status(200).json({
    success: true,
    assistant: advice
  });
}
