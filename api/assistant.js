export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {
    const {
      finding,
      severity,
      website
    } = req.body || {};

    if (!finding) {
      return res.status(400).json({
        error: "Security finding is required."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    /*
     * ---------------------------------------------------------
     * Built-in defensive fallback
     * ---------------------------------------------------------
     * If OpenAI credits are unavailable, Sentinel AI still
     * provides useful security guidance.
     */

    const fallbackGuidance = {
      "HSTS": {
        explanation:
          "HSTS tells browsers to use HTTPS when connecting to your website. Without it, browsers may still attempt an insecure HTTP connection.",
        why_it_matters:
          "It helps reduce the risk of downgrade and accidental insecure connections.",
        defensive_action:
          "Configure Strict-Transport-Security on the HTTPS response.",
        steps: [
          "Confirm that the entire website works correctly over HTTPS.",
          "Configure the Strict-Transport-Security response header.",
          "Start with an appropriate max-age value for your environment.",
          "Run Sentinel AI again and verify that HSTS is detected."
        ],
        verification:
          "Run another Sentinel AI scan and confirm that HSTS is reported as PASS."
      },

      "Content Security Policy": {
        explanation:
          "Content-Security-Policy helps control which sources a browser is allowed to load or execute.",
        why_it_matters:
          "A carefully designed CSP can reduce the impact of certain browser-side security problems.",
        defensive_action:
          "Create a CSP that matches the legitimate scripts, styles, images and other resources used by the website.",
        steps: [
          "Identify the legitimate resources used by the website.",
          "Create a restrictive CSP appropriate for those resources.",
          "Test the policy carefully before enforcing it.",
          "Run Sentinel AI again and verify the CSP header."
        ],
        verification:
          "Run another Sentinel AI scan and confirm that Content-Security-Policy is detected."
      },

      "Clickjacking Protection": {
        explanation:
          "Clickjacking protection prevents your pages from being embedded in unauthorized frames.",
        why_it_matters:
          "Unauthorized framing can make users interact with a page without realizing which page they are actually using.",
        defensive_action:
          "Configure X-Frame-Options or CSP frame-ancestors according to your legitimate embedding requirements.",
        steps: [
          "Determine whether your website needs to be embedded by another site.",
          "Choose an appropriate frame protection policy.",
          "Configure X-Frame-Options or CSP frame-ancestors.",
          "Run Sentinel AI again to verify the protection."
        ],
        verification:
          "Run another Sentinel AI scan and confirm that frame protection is detected."
      },

      "X-Content-Type-Options": {
        explanation:
          "X-Content-Type-Options with nosniff tells browsers not to guess a different content type.",
        why_it_matters:
          "It helps reduce risks caused by incorrect MIME-type interpretation.",
        defensive_action:
          "Add the X-Content-Type-Options: nosniff response header.",
        steps: [
          "Open your web server or hosting configuration.",
          "Add X-Content-Type-Options: nosniff.",
          "Deploy the configuration.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that X-Content-Type-Options is detected as PASS."
      },

      "Referrer-Policy": {
        explanation:
          "Referrer-Policy controls how much referring-page information browsers send with requests.",
        why_it_matters:
          "A restrictive policy can reduce unnecessary exposure of URL information.",
        defensive_action:
          "Configure an appropriate restrictive Referrer-Policy.",
        steps: [
          "Review whether your website needs referrer information.",
          "Choose an appropriate policy.",
          "Configure the Referrer-Policy response header.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that Referrer-Policy is detected by the scanner."
      },

      "Permissions-Policy": {
        explanation:
          "Permissions-Policy controls access to selected browser capabilities and features.",
        why_it_matters:
          "Restricting unnecessary browser features can reduce the website's exposed attack surface.",
        defensive_action:
          "Configure Permissions-Policy according to the features your website actually needs.",
        steps: [
          "Identify browser features used by your website.",
          "Disable unnecessary features.",
          "Configure Permissions-Policy.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that Permissions-Policy is detected."
      },

      "Server Information Exposure": {
        explanation:
          "The Server response header can reveal information about the software handling web requests.",
        why_it_matters:
          "Unnecessary software information can provide useful clues about the server environment.",
        defensive_action:
          "Minimize unnecessary server identification information.",
        steps: [
          "Check the response headers from your web server.",
          "Identify unnecessary server version information.",
          "Reduce or remove unnecessary identification where supported.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that unnecessary Server information is no longer exposed."
      },

      "Cookie Security": {
        explanation:
          "Security attributes such as Secure, HttpOnly and SameSite help protect browser cookies.",
        why_it_matters:
          "Appropriate cookie attributes can reduce exposure of session and authentication cookies.",
        defensive_action:
          "Review application cookies and configure appropriate security attributes.",
        steps: [
          "Identify authentication and session cookies.",
          "Use Secure for cookies that should only travel over HTTPS.",
          "Use HttpOnly where client-side JavaScript does not need cookie access.",
          "Use an appropriate SameSite policy."
        ],
        verification:
          "Run Sentinel AI again and review the Cookie Security result."
      },

      "Cache-Control": {
        explanation:
          "Cache-Control tells browsers and intermediary caches how a response should be stored and reused.",
        why_it_matters:
          "Correct caching rules help prevent sensitive responses from being stored or reused inappropriately.",
        defensive_action:
          "Configure caching according to whether the response contains public or sensitive information.",
        steps: [
          "Identify responses containing sensitive information.",
          "Review their caching requirements.",
          "Configure suitable Cache-Control directives.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that the website returns an appropriate Cache-Control policy."
      },

      "Cross-Origin-Opener-Policy": {
        explanation:
          "Cross-Origin-Opener-Policy controls how a document interacts with cross-origin browsing contexts.",
        why_it_matters:
          "It can provide additional isolation between browsing contexts.",
        defensive_action:
          "Consider an appropriate COOP policy for your application's architecture.",
        steps: [
          "Review whether your application needs cross-origin window relationships.",
          "Choose an appropriate COOP policy.",
          "Deploy the response header.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that the COOP header is detected."
      },

      "Cross-Origin-Resource-Policy": {
        explanation:
          "Cross-Origin-Resource-Policy controls which origins can load certain resources.",
        why_it_matters:
          "It can provide additional protection for resources that should not be broadly shared.",
        defensive_action:
          "Configure CORP according to your resource-sharing requirements.",
        steps: [
          "Identify resources that should be protected from cross-origin loading.",
          "Review legitimate cross-origin requirements.",
          "Configure an appropriate CORP policy.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that the CORP header is detected."
      },

      "Cross-Origin-Embedder-Policy": {
        explanation:
          "Cross-Origin-Embedder-Policy controls whether a document can load certain cross-origin resources.",
        why_it_matters:
          "It can provide stronger cross-origin isolation when used correctly.",
        defensive_action:
          "Consider COEP only after confirming that the website's required resources support the policy.",
        steps: [
          "Review cross-origin resources used by the website.",
          "Check compatibility with the desired policy.",
          "Configure COEP carefully.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that the COEP header is detected."
      },

      "Security.txt": {
        explanation:
          "security.txt provides a standard location where security researchers can find information about reporting security issues.",
        why_it_matters:
          "It can make responsible vulnerability reporting easier.",
        defensive_action:
          "Consider publishing a valid /.well-known/security.txt file.",
        steps: [
          "Create the security.txt file.",
          "Add an appropriate security contact.",
          "Publish it under /.well-known/security.txt.",
          "Run Sentinel AI again."
        ],
        verification:
          "Confirm that Sentinel AI can detect the security.txt resource."
      }
    };

    /*
     * Find built-in guidance.
     */

    const guidance =
      fallbackGuidance[finding] || {
        explanation:
          "Sentinel AI detected a security configuration finding that should be reviewed as part of the website's defensive security posture.",
        why_it_matters:
          "Reviewing security configuration helps reduce unnecessary exposure and improve the website's overall security posture.",
        defensive_action:
          "Review the affected configuration and apply an appropriate defensive setting.",
        steps: [
          "Identify the affected security setting.",
          "Review the website or server configuration.",
          "Apply an appropriate defensive configuration.",
          "Run Sentinel AI again to verify the result."
        ],
        verification:
          "Run another Sentinel AI scan and confirm whether the finding has been resolved."
      };

    /*
     * ---------------------------------------------------------
     * Try OpenAI first when credits are available.
     * ---------------------------------------------------------
     */

    if (apiKey) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "gpt-5.6-luna",
              input: `
You are Sentinel AI, a defensive cybersecurity mentor.

Analyze this website security finding.

Website: ${website || "Unknown"}
Finding: ${finding}
Severity: ${severity || "Unknown"}

Provide practical beginner-friendly defensive guidance.

Return ONLY valid JSON using this structure:

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

Defensive guidance only.
Do not provide exploitation instructions.
Do not invent facts about the website.
`
            })
          }
        );

        const data = await response.json();

        if (response.ok && data?.output_text) {
          let aiResult;

          try {
            aiResult = JSON.parse(
              data.output_text.trim()
            );
          } catch {
            aiResult = null;
          }

          if (aiResult) {
            return res.status(200).json({
              success: true,
              aiPowered: true,
              assistant: aiResult
            });
          }
        }

        /*
         * OpenAI failed — continue to built-in guidance.
         * Do NOT return an error to the user.
         */

        console.warn(
          "OpenAI unavailable. Using Sentinel AI built-in defensive guidance."
        );

      } catch (openAIError) {
        console.warn(
          "OpenAI connection failed. Using built-in guidance.",
          openAIError?.message
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * Free fallback response
     * ---------------------------------------------------------
     */

    return res.status(200).json({
      success: true,
      aiPowered: false,
      fallback: true,
      assistant: {
        title: finding,
        severity: severity || "Unknown",
        explanation: guidance.explanation,
        why_it_matters: guidance.why_it_matters,
        defensive_action: guidance.defensive_action,
        steps: guidance.steps,
        verification: guidance.verification
      }
    });

  } catch (error) {
    console.error(
      "Sentinel AI Assistant Error:",
      error
    );

    return res.status(500).json({
      error:
        "Security Mentor could not generate guidance."
    });
  }
}
