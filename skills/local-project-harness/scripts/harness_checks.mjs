#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const ACTIVE_STATUSES = new Set([
  "spawned",
  "assigned",
  "running",
  "report_received",
  "consumed",
  "close_pending",
]);

const TERMINAL_STATUSES = new Set([
  "closed",
  "blocked",
  "validation_failed",
  "security_failed",
  "budget_exceeded",
  "consensus_failed",
]);

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-proj-[A-Za-z0-9_-]{20,}/g,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[^'"\s]{12,}/gi,
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  return 1;
}

function ok(message) {
  console.log(`PASS: ${message}`);
  return 0;
}

function usage() {
  console.error(`Usage:
  node skills/local-project-harness/scripts/harness_checks.mjs audit-scope --assignment <delegation.json> --report <worker-report.json> [--workspace <path>] [--allow-delete]
  node skills/local-project-harness/scripts/harness_checks.mjs secret-scan <file> [<file> ...]
  node skills/local-project-harness/scripts/harness_checks.mjs audit-close --lifecycle-log <events.jsonl>
  node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json>
  node skills/local-project-harness/scripts/harness_checks.mjs sync-check --source README.md --copy skills/local-project-harness/references/harness-readme.md`);
  return 2;
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return undefined;
  return args[index + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readJsonl(path) {
  return readText(path)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: invalid JSONL: ${error.message}`);
      }
    });
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.startsWith("~") || value.startsWith("/") || value.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(value)) return false;
  if (/[*?\[\]]/.test(value)) return false;
  if (/%[A-Za-z_][A-Za-z0-9_]*%/.test(value)) return false;
  if (/\$\{?(env:)?[A-Za-z_][A-Za-z0-9_]*\}?/.test(value)) return false;
  return true;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function comparablePath(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function realpathExisting(value) {
  return realpathSync.native ? realpathSync.native(value) : realpathSync(value);
}

function isWithinWorkspace(targetPath, workspacePath) {
  const relative = path.relative(comparablePath(workspacePath), comparablePath(targetPath));
  return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function nearestExistingPath(absPath) {
  let current = absPath;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return current;
}

function auditWorkspacePath(workspaceReal, relativePath, label) {
  const absPath = path.resolve(workspaceReal, relativePath);
  if (!isWithinWorkspace(absPath, workspaceReal)) {
    return `${label} path escapes workspace: ${relativePath}`;
  }

  const existingPath = existsSync(absPath) ? absPath : nearestExistingPath(path.dirname(absPath));
  if (!existingPath) return undefined;

  const realPath = realpathExisting(existingPath);
  if (!isWithinWorkspace(realPath, workspaceReal)) {
    return `${label} path resolves outside workspace: ${relativePath}`;
  }
  return undefined;
}

function auditScope(args) {
  const assignmentPath = option(args, "--assignment");
  const reportPath = option(args, "--report");
  if (!assignmentPath || !reportPath) return usage();

  const workspacePath = option(args, "--workspace") ?? process.cwd();
  const workspaceReal = realpathExisting(path.resolve(workspacePath));
  const assignment = readJson(assignmentPath);
  const report = readJson(reportPath);
  const allowed = assignment.allowed_files;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return fail("assignment.allowed_files must be a non-empty list");
  }

  const allowedSet = new Set();
  for (const item of allowed) {
    if (!isSafeRelativePath(item)) return fail(`unsafe allowed_files path: ${String(item)}`);
    const workspaceError = auditWorkspacePath(workspaceReal, item, "allowed_files");
    if (workspaceError) return fail(workspaceError);
    allowedSet.add(normalizePath(item));
  }

  const changedFiles = report.changed_files ?? [];
  if (!Array.isArray(changedFiles)) return fail("report.changed_files must be a list");

  for (const change of changedFiles) {
    if (typeof change !== "object" || change === null) {
      return fail("each changed_files item must be an object");
    }
    const path = change.path;
    const action = change.action;
    if (!isSafeRelativePath(path)) return fail(`unsafe changed_files path: ${String(path)}`);
    const workspaceError = auditWorkspacePath(workspaceReal, path, "changed_files");
    if (workspaceError) return fail(workspaceError);
    if (!allowedSet.has(normalizePath(path))) {
      return fail(`changed file outside allowed_files: ${path}`);
    }
    if ((action === "deleted" || action === "reverted") && !hasFlag(args, "--allow-delete")) {
      return fail(`delete/revert requires explicit allowance: ${path}`);
    }
  }

  return ok("scope audit passed");
}

function secretScan(args) {
  if (args.length === 0) return usage();
  const findings = [];

  for (const path of args) {
    if (!statSync(path).isFile()) return fail(`not a file: ${path}`);
    const text = readText(path);
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        findings.push(`${path}:${line}`);
      }
    }
  }

  if (findings.length > 0) {
    return fail(`secret candidates found at ${findings.join(", ")}`);
  }
  return ok("secret scan passed");
}

function auditClose(args) {
  const logPath = option(args, "--lifecycle-log");
  if (!logPath) return usage();

  const events = readJsonl(logPath);
  const latest = new Map();
  for (const event of events) {
    if (typeof event.agent_id !== "string" || typeof event.status !== "string") {
      return fail("each lifecycle event requires string agent_id and status");
    }
    latest.set(event.agent_id, event);
  }

  const active = [];
  const badStatuses = [];
  const deferred = [];
  for (const [agentId, event] of latest.entries()) {
    if (ACTIVE_STATUSES.has(event.status)) active.push(`${agentId}:${event.status}`);
    if (!TERMINAL_STATUSES.has(event.status)) badStatuses.push(`${agentId}:${event.status}`);
    if (event.close_deferred_reason) deferred.push(agentId);
  }

  if (active.length > 0) return fail(`active subagents remain: ${active.join(", ")}`);
  if (badStatuses.length > 0) return fail(`unknown terminal statuses: ${badStatuses.join(", ")}`);
  if (deferred.length > 0) return fail(`unresolved close_deferred_reason: ${deferred.join(", ")}`);
  return ok("close audit passed");
}

const RUBRIC_WEIGHTS = {
  question_fulfillment: 25,
  functional_completeness: 20,
  scenario_flow_coverage: 30,
  edge_case_handling: 10,
  regression_safety: 5,
  verification_completeness: 10,
};

const VALID_WORK_TYPES = new Set(["code_change", "docs", "schema_policy", "app_product", "research", "other"]);

const APP_QUALITY_CHECK_KEYS = [
  "ux_workflow_completeness",
  "visual_polish",
  "responsive_desktop_mobile",
  "accessibility_basics",
  "error_loading_empty_states",
  "text_overlap_layout_stability",
  "domain_fit",
];

function checkEntries(checkGroup) {
  if (!checkGroup || typeof checkGroup !== "object" || Array.isArray(checkGroup)) return [];
  return Object.entries(checkGroup).filter(([, check]) => {
    return check && typeof check === "object" && !Array.isArray(check) && typeof check.status === "string";
  });
}

function appQualityEvidenceEntries(appQuality) {
  if (!appQuality || typeof appQuality !== "object" || !Array.isArray(appQuality.evidence)) return [];
  return appQuality.evidence.filter((item) => {
    return item && typeof item === "object" && typeof item.status === "string";
  });
}

function hasEvidence(check) {
  if (!check || typeof check !== "object") return false;
  if (typeof check.evidence === "string" && check.evidence.trim().length > 0) return true;
  if (Array.isArray(check.findings) && check.findings.length > 0) return true;
  if (typeof check.description === "string" && check.description.trim().length > 0) return true;
  if (typeof check.artifact === "string" && check.artifact.trim().length > 0) return true;
  if (Array.isArray(check.artifact) && check.artifact.length > 0) return true;
  return false;
}

function hasDescriptionOrArtifact(evidence) {
  if (!evidence || typeof evidence !== "object") return false;
  if (typeof evidence.description === "string" && evidence.description.trim().length > 0) return true;
  if (typeof evidence.artifact === "string" && evidence.artifact.trim().length > 0) return true;
  if (Array.isArray(evidence.artifact) && evidence.artifact.length > 0) return true;
  return false;
}

function scenarioFlowEvidenceText(flow) {
  return collectText([flow.evidence, flow.description, flow.artifact, flow.findings]).trim();
}

function auditScenarioFlowScores(scenarioFlowScores) {
  if (!Array.isArray(scenarioFlowScores)) {
    return "scenario_flow_scores must be a list";
  }
  if (scenarioFlowScores.length === 0) {
    return "scenario_flow_scores must contain at least one item";
  }

  for (const [index, flow] of scenarioFlowScores.entries()) {
    if (!flow || typeof flow !== "object" || Array.isArray(flow)) {
      return `scenario_flow_scores[${index}] must be an object`;
    }
    if (typeof flow.id !== "string" || flow.id.trim().length === 0) {
      return `scenario_flow_scores[${index}] must include id`;
    }
    if (typeof flow.passed !== "boolean") {
      return `scenario_flow_scores[${index}] must include boolean passed`;
    }
    if (scenarioFlowEvidenceText(flow).length === 0) {
      return `scenario_flow_scores[${index}] must include evidence-like text`;
    }
  }

  return undefined;
}

function auditAppQualityCompleteness(appQuality, isAppProduct, requirePassedAppQuality) {
  if (!Array.isArray(appQuality.evidence)) {
    return "app_quality_check.evidence must be an array";
  }
  if (appQuality.evidence.length === 0) {
    return "app_quality_check.evidence must contain at least one item";
  }

  for (const [index, evidence] of appQuality.evidence.entries()) {
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
      return `app_quality_check.evidence[${index}] must be an object`;
    }
    if (typeof evidence.status !== "string") {
      return `app_quality_check.evidence[${index}] must include status`;
    }
  }

  for (const key of APP_QUALITY_CHECK_KEYS) {
    const check = appQuality[key];
    if (!check || typeof check !== "object" || Array.isArray(check)) {
      return `app_quality_check.${key} must be present`;
    }
    if (typeof check.status !== "string") {
      return `app_quality_check.${key} must include status`;
    }
    if (!hasEvidence(check)) {
      return `app_quality_check.${key} must include non-empty evidence`;
    }

    if (isAppProduct && !["passed", "failed", "not_run", "not_applicable"].includes(check.status)) {
      return `app_product app_quality_check.${key} has unsupported status: ${check.status}`;
    }
    if (isAppProduct && requirePassedAppQuality && check.status !== "passed") {
      return `app_product app_quality_check.${key} must be passed`;
    }
    if (!isAppProduct && check.status !== "not_applicable") {
      return `non-app app_quality_check.${key} must be not_applicable`;
    }
  }

  if (isAppProduct && requirePassedAppQuality) {
    const hasPassedEvidence = appQuality.evidence.some((evidence) => {
      return evidence.status === "passed" && hasDescriptionOrArtifact(evidence);
    });
    if (!hasPassedEvidence) {
      return "app_product app_quality_check.evidence requires at least one passed item with description or artifact";
    }
  }

  return undefined;
}

function collectText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(collectText).join("\n");
  return "";
}

function riskText(report) {
  return collectText([
    report.risks_or_follow_up,
    report.risks,
    report.follow_up,
    report.unverified_checks,
    report.limitations,
    report.limitations_or_follow_up,
  ]);
}

function auditRubricScore(report) {
  const rubric = report.rubric_scores;
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) return undefined;

  let sum = 0;
  for (const [key, maxScore] of Object.entries(RUBRIC_WEIGHTS)) {
    const item = rubric[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    if (!Number.isInteger(item.score) || item.max_score !== maxScore) return undefined;
    sum += item.score;
  }

  if (sum !== report.overall_completion_score) {
    return `overall_completion_score ${report.overall_completion_score} does not match rubric score sum ${sum}`;
  }
  return undefined;
}

function reviewLogic(args) {
  const reportPath = option(args, "--report");
  if (!reportPath) return usage();

  const report = readJson(reportPath);
  const gates = report.blocking_gates ?? [];
  const rework = report.rework_items ?? [];
  const scenarioFlowScores = report.scenario_flow_scores;
  const appQuality = report.app_quality_check;
  const isAppProduct = report.work_type === "app_product";
  const requirePassedAppQuality =
    isAppProduct &&
    (report.status === "accepted" || report.recommendation === "accepted" || report.passed_threshold === true);

  if (!Number.isInteger(report.overall_completion_score) || !Number.isInteger(report.score_threshold)) {
    return fail("overall_completion_score and score_threshold must be integers");
  }
  if (!VALID_WORK_TYPES.has(report.work_type)) return fail("work_type must be present and valid");
  if (!Array.isArray(gates)) return fail("blocking_gates must be a list");
  if (!Array.isArray(rework)) return fail("rework_items must be a list");
  if (!appQuality || typeof appQuality !== "object" || Array.isArray(appQuality)) {
    return fail("app_quality_check must be present");
  }

  const appQualityEntries = checkEntries(appQuality);
  if (appQualityEntries.length === 0) return fail("app_quality_check must contain status items");

  const rubricError = auditRubricScore(report);
  if (rubricError) return fail(rubricError);

  const scenarioFlowError = auditScenarioFlowScores(scenarioFlowScores);
  if (scenarioFlowError) return fail(scenarioFlowError);

  const failedScenarioFlows = scenarioFlowScores.filter((flow) => flow.passed === false);
  if (failedScenarioFlows.length > 0 && !gates.includes("scenario_flow_failed")) {
    return fail("failed scenario_flow_scores require blocking gate: scenario_flow_failed");
  }

  const blockingAppQuality = appQualityEntries.filter(([, check]) => {
    return ["failed", "not_run"].includes(check.status) || (isAppProduct && check.status === "not_applicable");
  });
  if (blockingAppQuality.length > 0 && !gates.includes("app_quality_failed")) {
    return fail("failed, not_run, or inapplicable app_quality_check requires blocking gate: app_quality_failed");
  }

  if (gates.includes("app_quality_failed")) {
    const explainedGap = appQualityEntries.some(([, check]) => {
      return ["failed", "not_run", "not_applicable"].includes(check.status) && hasEvidence(check);
    });
    if (!explainedGap) {
      return fail("app_quality_failed requires a failed, not_run, or inapplicable app_quality_check item with evidence");
    }
  }

  const appQualityCompletenessError = auditAppQualityCompleteness(
    appQuality,
    isAppProduct,
    requirePassedAppQuality,
  );
  if (appQualityCompletenessError) return fail(appQualityCompletenessError);

  if (report.status === "accepted") {
    if (report.recommendation !== "accepted") return fail("accepted status requires accepted recommendation");
    if (report.passed_threshold !== true) return fail("accepted status requires passed_threshold true");
    if (gates.length > 0) return fail("accepted status requires empty blocking_gates");
    if (report.overall_completion_score < report.score_threshold) {
      return fail("accepted status requires score >= threshold");
    }
    for (const [key, check] of checkEntries(report.verification_check)) {
      if (check.status === "failed") return fail(`accepted status cannot include failed verification check: ${key}`);
    }
    for (const [key, check] of appQualityEntries.filter(([, check]) => check.status === "failed")) {
      return fail(`accepted status cannot include failed app_quality_check: ${key}`);
    }
    if (isAppProduct) {
      for (const [key, check] of appQualityEntries) {
        if (check.status === "not_run" || check.status === "not_applicable") {
          return fail(`accepted app_product status requires passed app_quality_check: ${key}`);
        }
      }
      const evidenceEntries = appQualityEvidenceEntries(appQuality);
      if (evidenceEntries.length === 0) {
        return fail("accepted app_product status requires app_quality evidence");
      }
      for (const [index, evidence] of evidenceEntries.entries()) {
        if (evidence.status !== "passed" || evidence.type === "not_applicable") {
          return fail(`accepted app_product status requires passed app_quality evidence: evidence[${index}]`);
        }
      }
    }
    for (const key of ["security_check", "secret_scan_result", "scope_diff_result", "scope_check"]) {
      const check = report[key];
      if (check && typeof check === "object" && check.status === "failed") {
        return fail(`accepted status cannot include failed ${key}`);
      }
    }
    if (report.independence === "simulated_same_context") {
      const text = riskText(report);
      if (!/(simulated|same[-_\s]?context|not independent|independent review|unverified|limitation)/i.test(text)) {
        return fail("accepted simulated_same_context review must preserve the independence limitation in risks_or_follow_up or similar");
      }
    }
  }

  if (gates.length > 0) {
    if (report.passed_threshold !== false) return fail("blocking_gates require passed_threshold false");
    if (report.status === "accepted" || report.recommendation === "accepted") {
      return fail("blocking_gates cannot be accepted");
    }
  }

  if (report.passed_threshold === false && !["blocked", "rejected"].includes(report.status) && rework.length === 0) {
    return fail("passed_threshold false requires rework_items unless blocked/rejected");
  }

  for (const [key, check] of Object.entries(report.verification_check ?? {})) {
    if (check && typeof check === "object" && check.status === "failed") {
      const expectedGate = `${key}_failed`;
      if (!gates.includes(expectedGate)) {
        return fail(`failed verification missing blocking gate: ${expectedGate}`);
      }
    }
  }

  return ok("review logic audit passed");
}

function syncCheck(args) {
  const sourcePath = option(args, "--source");
  const copyPath = option(args, "--copy");
  if (!sourcePath || !copyPath) return usage();

  const normalize = (text) => text.replace(/\r\n/g, "\n");
  const sourceHash = createHash("sha256").update(normalize(readText(sourcePath))).digest("hex");
  const copyHash = createHash("sha256").update(normalize(readText(copyPath))).digest("hex");
  if (sourceHash !== copyHash) return fail(`drift detected: ${sourcePath} != ${copyPath}`);
  return ok("README/reference sync check passed");
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case "audit-scope":
        return auditScope(args);
      case "secret-scan":
        return secretScan(args);
      case "audit-close":
        return auditClose(args);
      case "review-logic":
        return reviewLogic(args);
      case "sync-check":
        return syncCheck(args);
      default:
        return usage();
    }
  } catch (error) {
    return fail(error.message);
  }
}

process.exitCode = main();
