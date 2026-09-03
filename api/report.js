async function generateProfessionalReport(button) {

  if (!latestScan) {
    alert("Please run a security scan first.");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "📄 Generating Report...";
  }

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
          latestScan.score ??
          latestScan.securityScore ??
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

    if (!data?.report) {
      throw new Error(
        "Report data was not returned."
      );
    }

    const report = data.report;

    const escape = (value) =>
      escapeHTML(
        value === null ||
        value === undefined
          ? ""
          : String(value)
      );

    const priorityFindings =
      Array.isArray(report.priorityFindings)
        ? report.priorityFindings
        : [];

    const recommendations =
      Array.isArray(report.recommendations)
        ? report.recommendations
        : [];

    const nextSteps =
      Array.isArray(report.nextSteps)
        ? report.nextSteps
        : [];

    const findingsHTML =
      priorityFindings.map((item) => `
        <div class="report-card">

          <h3>
            Priority ${escape(item.priority)}:
            ${escape(item.title)}
          </h3>

          <p>
            <strong>Status:</strong>
            ${escape(item.status)}
          </p>

          <p>
            ${escape(item.message)}
          </p>

          <p>
            <strong>Recommended Fix:</strong><br>
            ${escape(item.fix)}
          </p>

        </div>
      `).join("");

    const recommendationsHTML =
      recommendations.map((item) => `
        <li>${escape(item)}</li>
      `).join("");

    const nextStepsHTML =
      nextSteps.map((item) => `
        <li>${escape(item)}</li>
      `).join("");

    const reportWindow =
      window.open("", "_blank");

    if (!reportWindow) {
      throw new Error(
        "Please allow pop-ups for Sentinel AI."
      );
    }

    reportWindow.document.write(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>
Sentinel AI Security Report
</title>

<style>

body {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  max-width: 900px;

  margin: 0 auto;

  padding: 30px;

  line-height: 1.6;

  color: #172033;

  background: #f5f7fb;
}

.header {
  background: white;

  padding: 30px;

  border-radius: 16px;

  margin-bottom: 25px;

  box-shadow:
    0 4px 20px rgba(0,0,0,0.06);
}

.logo {
  font-size: 28px;

  font-weight: bold;
}

.score {
  font-size: 46px;

  font-weight: bold;

  margin-top: 15px;
}

.meta {
  color: #667085;
}

.section {
  margin-top: 25px;
}

.report-card {
  background: white;

  padding: 20px;

  margin: 12px 0;

  border-radius: 12px;

  border: 1px solid #e3e7ee;
}

.report-card h3 {
  margin-top: 0;
}

li {
  margin-bottom: 10px;
}

.print-button {
  position: fixed;

  top: 20px;

  right: 20px;

  padding: 11px 18px;

  border: none;

  border-radius: 9px;

  cursor: pointer;

  font-weight: bold;

  background: #172033;

  color: white;
}

.footer {
  margin-top: 35px;

  padding-top: 20px;

  border-top: 1px solid #ddd;

  color: #667085;

  font-size: 14px;
}

@media print {

  body {
    background: white;

    padding: 0;
  }

  .print-button {
    display: none;
  }

  .header,
  .report-card {
    box-shadow: none;
  }

}

</style>

</head>

<body>

<button
  class="print-button"
  onclick="window.print()">

  📄 Print / Save PDF

</button>

<div class="header">

  <div class="logo">
    🛡️ Sentinel AI
  </div>

  <h1>
    Professional Security-Awareness Report
  </h1>

  <p class="meta">
    Website:
    <strong>
      ${escape(report.website)}
    </strong>
  </p>

  <p class="meta">
    Scan ID:
    ${escape(report.scanId || "N/A")}
  </p>

  <p class="meta">
    Generated:
    ${escape(report.generatedAt)}
  </p>

  <div class="score">
    ${escape(report.securityScore)}/100
  </div>

  <p>
    Risk Level:
    <strong>
      ${escape(report.riskLevel)}
    </strong>
  </p>

</div>

<div class="section">

  <h2>
    📊 Executive Summary
  </h2>

  <div class="report-card">

    <p>
      <strong>Total Checks:</strong>
      ${escape(
        report.executiveSummary?.totalChecks
      )}
    </p>

    <p>
      <strong>Passed:</strong>
      ${escape(
        report.executiveSummary?.passed
      )}
    </p>

    <p>
      <strong>Warnings:</strong>
      ${escape(
        report.executiveSummary?.warnings
      )}
    </p>

    <p>
      <strong>Informational:</strong>
      ${escape(
        report.executiveSummary?.informational
      )}
    </p>

    <p>
      <strong>Priority Issues:</strong>
      ${escape(
        report.executiveSummary?.priorityIssues
      )}
    </p>

  </div>

</div>

<div class="section">

  <h2>
    🎯 Priority Findings
  </h2>

  ${
    findingsHTML ||
    `
    <div class="report-card">
      No WARNING findings were reported.
    </div>
    `
  }

</div>

<div class="section">

  <h2>
    🚀 Recommendations
  </h2>

  <div class="report-card">

    <ul>
      ${recommendationsHTML}
    </ul>

  </div>

</div>

<div class="section">

  <h2>
    📋 Next Steps
  </h2>

  <div class="report-card">

    <ol>
      ${nextStepsHTML}
    </ol>

  </div>

</div>

<div class="section">

  <h2>
    ⚠️ Limitations
  </h2>

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

</div>

<div class="section">

  <h2>
    🛡️ Disclaimer
  </h2>

  <div class="report-card">

    ${escape(report.disclaimer)}

  </div>

</div>

<div class="footer">

  Sentinel AI · AI Cybersecurity Scanner &
  Security Education Platform

</div>

</body>

</html>
    `);

    reportWindow.document.close();

  } catch (error) {

    console.error(
      "Report Error:",
      error
    );

    alert(
      "❌ " +
      (
        error?.message ||
        "Unable to generate the report right now."
      )
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "📄 Generate Professional Security Report";
    }
  }
}
