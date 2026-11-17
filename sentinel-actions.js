/* Sentinel AI delegated actions. Keeps behavior out of HTML attributes. */
(function () {
  "use strict";

  function closestAction(event, action) {
    const target = event.target instanceof Element
      ? event.target.closest("[data-action]")
      : null;
    return target && (!action || target.dataset.action === action) ? target : null;
  }

  function exportSecurityReportCsv() {
    const dataNode = document.getElementById("sentinelReportData");
    if (!dataNode) {
      window.alert("Report data is unavailable. Generate the report again.");
      return;
    }

    let data;
    try {
      data = JSON.parse(dataNode.textContent || "{}");
    } catch {
      window.alert("The report data could not be read.");
      return;
    }

    const report = data.report && typeof data.report === "object" ? data.report : {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const cell = value => {
      let text = value == null ? "" : String(value);
      if (/^\s*[=+@\-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    };

    const rows = [
      ["Website", report.website],
      ["Scan ID", report.scanId],
      ["Generated", report.generatedAt],
      ["Security score", report.securityScore],
      ["Risk level", report.riskLevel],
      [],
      ["Check", "Status", "Message", "Recommended fix", "Evidence source", "Observed", "Expected"]
    ];

    for (const check of checks) {
      const evidence = check && check.evidence && typeof check.evidence === "object" ? check.evidence : {};
      rows.push([
        check?.name || check?.title || "Security Check",
        check?.status || "INFO",
        check?.message || check?.description || "",
        check?.fix || check?.recommendation || "",
        evidence.source || "",
        evidence.observed || "",
        evidence.expected || ""
      ]);
    }

    const csv = "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sentinel-security-report.csv";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener("click", function (event) {
    const target = closestAction(event);
    if (!target) return;

    const data = target.dataset;
    switch (data.action) {
      case "toggle-password": window.togglePassword(); break;
      case "reset-password": window.resetPassword(); break;
      case "sign-up-user": window.signUpUser(); break;
      case "sign-in-user": window.signInUser(); break;
      case "update-password": window.updatePassword(); break;
      case "sign-out-user": window.signOutUser(); break;
      case "run-security-scan": {
        const result = document.getElementById("result");
        if (typeof window.runSecurityScan !== "function") {
          if (result) {
            result.classList.remove("is-hidden");
            result.textContent = "❌ Scanner could not start because its script did not load. Please refresh and try again.";
          }
          console.error("Sentinel scanner handler is unavailable.");
          break;
        }
        Promise.resolve().then(() => window.runSecurityScan(data.rescan === "true")).catch((error) => {
          if (result) {
            result.classList.remove("is-hidden");
            result.textContent = "❌ Scanner could not start: " + (error?.message || "Unexpected error.");
          }
          console.error("Sentinel scanner launch error:", error);
        });
        break;
      }
      case "clear-scan-history": window.clearScanHistory(); break;
      case "add-monitoring-site": window.addMonitoringSite(); break;
      case "lookup-vulnerability": window.lookupVulnerability(); break;
      case "create-research-project": window.createResearchProject(); break;
      case "create-research-finding": window.createResearchFinding(); break;
      case "create-organization": window.createOrganization(); break;
      case "accept-organization-invitation": window.acceptOrganizationInvitation(); break;
      case "ask-security-mentor": window.askSecurityMentor(Number(data.index)); break;
      case "generate-professional-report": window.generateProfessionalReport(target); break;
      case "print-report": window.print(); break;
      case "export-security-report-csv": exportSecurityReportCsv(); break;
      case "export-research-project": window.exportResearchProject(data.projectId); break;
      case "set-research-project-status": window.setResearchProjectStatus(data.projectId, data.status); break;
      case "delete-research-project": window.deleteResearchProject(data.projectId); break;
      case "add-research-note": window.addResearchNote(data.findingId); break;
      case "delete-research-finding": window.deleteResearchFinding(data.findingId); break;
      case "verify-monitoring-site": window.verifyMonitoringSite(data.siteId); break;
      case "change-monitoring-site": window.changeMonitoringSite(data.siteId, data.siteAction); break;
      case "remove-monitoring-site": window.removeMonitoringSite(data.siteId); break;
      case "mark-monitoring-alert-read": window.markMonitoringAlertRead(data.alertId); break;
      case "change-organization-role": window.changeOrganizationRole(data.organizationId, data.userId); break;
      case "remove-organization-member": window.removeOrganizationMember(data.organizationId, data.userId); break;
      case "revoke-organization-invitation": window.revokeOrganizationInvitation(data.organizationId, data.invitationId); break;
      case "invite-organization-member": window.inviteOrganizationMember(data.organizationId); break;
      case "save-organization-policy": window.saveOrganizationPolicy(data.organizationId); break;
      case "export-organization-audit": window.exportOrganizationAudit(data.organizationId); break;
      case "remove-organization-asset": window.removeOrganizationAsset(data.organizationId, data.assetId); break;
      case "share-organization-asset": window.shareOrganizationAsset(data.organizationId); break;
      case "copy-organization-invite": window.copyOrganizationInvite(data.inviteUrl); break;
      default: return;
    }
  });

  document.addEventListener("change", function (event) {
    const target = closestAction(event, "update-research-finding-status");
    if (target) window.updateResearchFindingStatus(target.dataset.findingId, target.value);
  });
})();
