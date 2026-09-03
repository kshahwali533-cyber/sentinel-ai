async function generateProfessionalReport(button) {
  if (!latestScan) {
    alert("Please run a security scan first.");
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Generating Report...";

  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        website:
          latestScan.website ||
          latestScan.finalUrl ||
          "",

        securityScore: Number(
          latestScan.securityScore ??
          latestScan.score ??
          0
        ),

        riskLevel:
          latestScan.riskLevel ||
          "Unknown",

        checks:
          Array.isArray(latestScan.checks)
            ? latestScan.checks
            : [],

        scanId:
          latestScan.scanId ||
          ""
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Report generation failed."
      );
    }

    if (!data.report) {
      throw new Error(
        "Report data was not returned."
      );
    }

    const report = data.report;

    const reportWindow = window.open(
      "",
      "_blank"
    );

    if (!reportWindow) {
      throw new Error(
        "Please allow pop-ups for Sentinel AI."
      );
    }

    const safe = value =>
      escapeHTML(
        value === null ||
        value === undefined
          ? ""
          : String(value)
      );

    const findingsHTML =
      Array.isArray(report.priorityFindings)
        ? report.priorityFindings.map(
            finding => `
              <div class="report-card">
                <h3>
                  Priority ${safe(finding.priority)}:
                  ${safe(finding.title)}
                </h3>

                <p>
                  <strong>Status:</strong>
                  ${safe(finding.status)}
                </p>

                <p>
                  ${safe(finding.message)}
                </p>

                <p>
                  <strong>Recommended Fix:</strong>
                  ${safe(finding.fix)}
                </p>
              </div>
            `
          ).join("")
        : "";

    const recommendationsHTML =
      Array.isArray(report.recommendations)
        ? report.recommendations.map(
            item => `
              <li>${safe(item)}</li>
            `
          ).join("")
        : "";

    const nextStepsHTML =
      Array.isArray(report.nextSteps)
        ? report.nextSteps.map(
            item => `
              <li>${safe(item)}</li>
            `
          ).join("")
        : "";

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">

        <title>
          Sentinel AI Security Report
        </title>

        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #172033;
            background: #f7f9fc;
          }

          h1 {
            margin-bottom: 5px;
          }

          h2 {
            margin-top: 30px;
          }

          .header {
            background: white;
            padding: 25px;
            border-radius: 14px;
            margin-bottom: 20px;
          }

          .score {
            font-size: 38px;
            font-weight: bold;
          }

          .meta {
            color: #596579;
          }

          .report-card {
            background: white;
            padding: 18px;
            margin: 12px 0;
            border-radius: 12px;
            border: 1px solid #e2e7ef;
          }

          li {
            margin-bottom: 8px;
          }

          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
          }

          @media print {
            .print-button {
              display: none;
            }

            body {
              background: white;
              margin: 0;
            }
          }
        </style>
      </head>

      <body>

        <button
          class="print-button"
          onclick="window.print()"
        >
          📄 Print / Save PDF
        </button>

        <div class="header">

          <h1>🛡️ Sentinel AI</h1>

          <p>
            Professional Security-Awareness Report
          </p>

          <p class="meta">
            Website:
            <strong>${safe(report.website)}</strong>
          </p>

          <p class="meta">
            Scan ID:
            ${safe(report.scanId || "N/A")}
          </p>

          <p class="meta">
            Generated:
            ${safe(report.generatedAt)}
          </p>

          <div class="score">
            ${safe(report.securityScore)}/100
          </div>

          <p>
            Risk Level:
            <strong>
              ${safe(report.riskLevel)}
            </strong>
          </p>

        </div>

        <h2>📊 Executive Summary</h2>

        <div class="report-card">

          <p>
            <strong>Total Checks:</strong>
            ${safe(report.executiveSummary?.totalChecks)}
          </p>

          <p>
            <strong>Passed:</strong>
            ${safe(report.executiveSummary?.passed)}
          </p>

          <p>
            <strong>Warnings:</strong>
            ${safe(report.executiveSummary?.warnings)}
          </p>

          <p>
            <strong>Informational:</strong>
            ${safe(report.executiveSummary?.informational)}
          </p>

          <p>
            <strong>Priority Issues:</strong>
            ${safe(report.executiveSummary?.priorityIssues)}
          </p>

        </div>

        <h2>🎯 Priority Findings</h2>

        ${findingsHTML || `
          <div class="report-card">
            No WARNING findings were reported.
          </div>
        `}

        <h2>🚀 Recommendations</h2>

        <div class="report-card">
          <ul>
            ${recommendationsHTML}
          </ul>
        </div>

        <h2>📋 Next Steps</h2>

        <div class="report-card">
          <ol>
            ${nextStepsHTML}
          </ol>
        </div>

        <h2>⚠️ Limitations</h2>

        <div class="report-card">
          <p>
            This report checks publicly observable
            HTTPS and security configuration signals.
          </p>

          <p>
            It does not perform exploitation or
            unauthorized penetration testing.
          </p>

          <p>
            A complete professional security assessment
            may require additional application,
            infrastructure and manual testing.
          </p>
        </div>

        <h2>🛡️ Disclaimer</h2>

        <div class="report-card">
          ${safe(report.disclaimer)}
        </div>

      </body>
      </html>
    `);

    reportWindow.document.close();

  } catch (error) {

    console.error(
      "Professional Report Error:",
      error
    );

    alert(
      error?.message ||
      "Professional Security Report could not be generated."
    );

  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
