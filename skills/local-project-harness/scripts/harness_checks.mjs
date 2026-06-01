#!/usr/bin/env node
import { execFileSync } from "node:child_process";
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
  node skills/local-project-harness/scripts/harness_checks.mjs goal-logic --contract <goal.json>
  node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json> --contract <goal.json>
  node skills/local-project-harness/scripts/harness_checks.mjs app-evidence --review <review.json>
  node skills/local-project-harness/scripts/harness_checks.mjs summary-logic --summary <summary.json> --review <review.json>
  node skills/local-project-harness/scripts/harness_checks.mjs runner-policy-sync [--root harness/runner_policy.yaml] [--skill skills/local-project-harness/references/policies/runner_policy.yaml]
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
  const text = readFileSync(path, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function stripYamlComment(line) {
  let quote = undefined;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote) {
        if (quote === "'" && line[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      } else if (quote === '"' && char === "\\") {
        index += 1;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

function yamlKeySeparatorIndex(text) {
  let quote = undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) {
        if (quote === "'" && text[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      } else if (quote === '"' && char === "\\") {
        index += 1;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ":") return index;
  }
  return -1;
}

function parseYamlScalar(value, filePath, lineNumber) {
  if (value === "") return "";
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?(?:\d+\.\d+|\d+\.|\.\d+)$/.test(value)) return Number.parseFloat(value);
  if (value.startsWith('"') || value.startsWith("'")) {
    if (!value.endsWith(value[0])) {
      throw new Error(`${filePath}:${lineNumber}: unterminated quoted scalar`);
    }
    if (value[0] === '"') {
      return JSON.parse(value);
    }
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function parseYamlSubset(text, filePath) {
  const logicalLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw, index) => ({
      lineNumber: index + 1,
      text: stripYamlComment(raw.replace(/\r$/, "")),
    }))
    .filter((line) => line.text.trim().length > 0);

  const root = {};
  const stack = [{ indent: -1, value: root, kind: "map" }];

  function nextContainerKind(index, indent) {
    for (let nextIndex = index + 1; nextIndex < logicalLines.length; nextIndex += 1) {
      const nextLine = logicalLines[nextIndex].text;
      const nextIndent = nextLine.match(/^ */)[0].length;
      if (nextIndent <= indent) return "map";
      return nextLine.slice(nextIndent).startsWith("- ") ? "array" : "map";
    }
    return "map";
  }

  for (const [index, line] of logicalLines.entries()) {
    if (/^\t+/.test(line.text)) {
      throw new Error(`${filePath}:${line.lineNumber}: tabs are not supported in YAML indentation`);
    }
    const indent = line.text.match(/^ */)[0].length;
    const content = line.text.slice(indent);

    while (stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];

    if (content.startsWith("- ")) {
      if (parent.kind !== "array") {
        throw new Error(`${filePath}:${line.lineNumber}: list item has no list parent`);
      }
      parent.value.push(parseYamlScalar(content.slice(2).trim(), filePath, line.lineNumber));
      continue;
    }

    if (parent.kind !== "map") {
      throw new Error(`${filePath}:${line.lineNumber}: map entry has no map parent`);
    }
    const separatorIndex = yamlKeySeparatorIndex(content);
    if (separatorIndex <= 0) {
      throw new Error(`${filePath}:${line.lineNumber}: expected YAML key/value pair`);
    }

    const key = content.slice(0, separatorIndex).trim();
    const scalarText = content.slice(separatorIndex + 1).trim();
    if (scalarText.length > 0) {
      parent.value[key] = parseYamlScalar(scalarText, filePath, line.lineNumber);
      continue;
    }

    const childKind = nextContainerKind(index, indent);
    const child = childKind === "array" ? [] : {};
    parent.value[key] = child;
    stack.push({ indent, value: child, kind: childKind });
  }

  return root;
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
  if (/(^|[\\/])\.([\\/]|$)/.test(value)) return false;
  if (/[*?\[\]]/.test(value)) return false;
  if (/%[A-Za-z_][A-Za-z0-9_]*%/.test(value)) return false;
  if (/\$\{?(env:)?[A-Za-z_][A-Za-z0-9_]*\}?/.test(value)) return false;
  const normalized = path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\/+|\/+$/g, "");
  if (normalized === "" || normalized === ".") return false;
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

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...options,
  });
}

function parseGitStatusPorcelainZ(output) {
  const records = output.split("\0");
  if (records[records.length - 1] === "") records.pop();

  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4) {
      throw new Error("unexpected git status record");
    }

    const indexStatus = record[0];
    const worktreeStatus = record[1];
    const status = `${indexStatus}${worktreeStatus}`;
    const repoPath = record.slice(3);
    if (!repoPath) {
      throw new Error("empty git status path");
    }

    const isRename = indexStatus === "R" || worktreeStatus === "R";
    const isCopy = indexStatus === "C" || worktreeStatus === "C";
    if (isRename || isCopy) {
      const sourcePath = records[index + 1];
      if (!sourcePath) {
        throw new Error("missing git status rename/copy source path");
      }
      index += 1;
      changes.push({
        repoPath,
        status,
        kind: isCopy ? "copy destination" : "rename destination",
        requiresDelete: false,
      });
      changes.push({
        repoPath: sourcePath,
        status,
        kind: isCopy ? "copy source" : "rename source",
        requiresDelete: isRename,
      });
      continue;
    }

    changes.push({
      repoPath,
      status,
      kind: "change",
      requiresDelete: indexStatus === "D" || worktreeStatus === "D",
    });
  }

  return changes;
}

function parseGitDiffNameStatusZ(output) {
  const records = output.split("\0");
  if (records[records.length - 1] === "") records.pop();

  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const status = records[index];
    if (!status) continue;
    const code = status[0];

    if (code === "R" || code === "C") {
      const sourcePath = records[index + 1];
      const repoPath = records[index + 2];
      if (!sourcePath || !repoPath) {
        throw new Error("missing git diff rename/copy path");
      }
      index += 2;
      changes.push({
        repoPath,
        status,
        kind: code === "C" ? "copy destination" : "rename destination",
        requiresDelete: false,
      });
      changes.push({
        repoPath: sourcePath,
        status,
        kind: code === "C" ? "copy source" : "rename source",
        requiresDelete: code === "R",
      });
      continue;
    }

    const repoPath = records[index + 1];
    if (!repoPath) {
      throw new Error("missing git diff path");
    }
    index += 1;
    changes.push({
      repoPath,
      status,
      kind: "change",
      requiresDelete: code === "D",
    });
  }

  return changes;
}

function gitRepoPathToWorkspacePath(gitRootReal, workspaceReal, repoPath) {
  if (!isSafeRelativePath(repoPath)) {
    return { error: `unsafe git-visible path: ${String(repoPath)}` };
  }

  const absPath = path.resolve(gitRootReal, repoPath);
  if (!isWithinWorkspace(absPath, workspaceReal)) {
    return { error: `git-visible path outside workspace: ${repoPath}` };
  }

  const relativePath = normalizePath(path.relative(workspaceReal, absPath));
  if (!isSafeRelativePath(relativePath)) {
    return { error: `unsafe git-visible workspace path: ${String(relativePath)}` };
  }

  const workspaceError = auditWorkspacePath(workspaceReal, relativePath, "git-visible");
  if (workspaceError) return { error: workspaceError };
  return { path: relativePath };
}

function inspectGitScope(workspaceReal) {
  let gitRootPath;
  try {
    gitRootPath = runGit(["-C", workspaceReal, "rev-parse", "--show-toplevel"]).trim();
  } catch {
    return { available: false, reason: "workspace is not inside a readable git repository" };
  }

  if (!gitRootPath) {
    return { available: false, reason: "git rev-parse returned no repository root" };
  }

  let gitRootReal;
  try {
    gitRootReal = realpathExisting(path.resolve(workspaceReal, gitRootPath));
  } catch {
    return { available: false, reason: "git repository root could not be resolved" };
  }

  if (!isWithinWorkspace(workspaceReal, gitRootReal)) {
    return { error: "git repository root does not contain workspace" };
  }

  let statusOutput;
  try {
    statusOutput = runGit(["-C", gitRootReal, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--renames"]);
  } catch {
    return { available: false, reason: "git status could not be read" };
  }

  let changes;
  try {
    changes = parseGitStatusPorcelainZ(statusOutput);
  } catch (error) {
    return { available: false, reason: error.message };
  }

  if (changes.some((change) => change.status[0] === "A")) {
    let copyOutput;
    try {
      copyOutput = runGit([
        "-C",
        gitRootReal,
        "diff",
        "--name-status",
        "-z",
        "--cached",
        "--find-copies",
        "--find-copies-harder",
      ]);
    } catch {
      return { available: false, reason: "git copy detection could not be read" };
    }

    try {
      changes.push(...parseGitDiffNameStatusZ(copyOutput).filter((change) => change.status[0] === "C"));
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  const workspaceChanges = [];
  for (const change of changes) {
    const conversion = gitRepoPathToWorkspacePath(gitRootReal, workspaceReal, change.repoPath);
    if (conversion.error) return { error: conversion.error };
    workspaceChanges.push({ ...change, path: conversion.path });
  }

  return { available: true, changes: workspaceChanges };
}

function auditChangedPath({ allowedSet, allowDelete, path: changedPath, action, label }) {
  if (!allowedSet.has(normalizePath(changedPath))) {
    return `${label} outside allowed_files: ${changedPath}`;
  }
  if ((action === "deleted" || action === "reverted") && !allowDelete) {
    return `delete/revert requires explicit allowance: ${changedPath}`;
  }
  return undefined;
}

const AUDIT_SCOPE_HARD_GATE_KEYS = ["security_check", "secret_scan_result", "scope_diff_result"];
const AUDIT_SCOPE_BUDGET_COUNTER_KEYS = [
  "iterations",
  "rework_iterations",
  "consensus_rounds",
  "subagents_started",
  "open_subagents",
];

function isObjectRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function auditScopePassedCheckObject(report, key) {
  const check = report[key];
  if (!isObjectRecord(check)) return `report.${key} must be an object`;
  if (check.status !== "passed") return `report.${key}.status must be "passed"`;
  if (typeof check.evidence !== "string") return `report.${key}.evidence must be a string`;
  return undefined;
}

function auditScopeWorkerReportHardGates(report) {
  for (const key of AUDIT_SCOPE_HARD_GATE_KEYS) {
    const error = auditScopePassedCheckObject(report, key);
    if (error) return error;
  }

  if (!Array.isArray(report.command_audit)) return "report.command_audit must be an array";

  if (!isObjectRecord(report.budget_used)) return "report.budget_used must be an object";
  for (const key of AUDIT_SCOPE_BUDGET_COUNTER_KEYS) {
    const value = report.budget_used[key];
    if (!Number.isInteger(value) || value < 0) {
      return `report.budget_used.${key} must be a non-negative integer`;
    }
  }

  return undefined;
}

function auditScope(args) {
  const assignmentPath = option(args, "--assignment");
  const reportPath = option(args, "--report");
  if (!assignmentPath || !reportPath) return usage();

  const workspacePath = option(args, "--workspace") ?? process.cwd();
  const workspaceReal = realpathExisting(path.resolve(workspacePath));
  const allowDelete = hasFlag(args, "--allow-delete");
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

  const hardGateError = auditScopeWorkerReportHardGates(report);
  if (hardGateError) return fail(hardGateError);

  for (const change of changedFiles) {
    if (typeof change !== "object" || change === null) {
      return fail("each changed_files item must be an object");
    }
    const path = change.path;
    const action = change.action;
    if (!isSafeRelativePath(path)) return fail(`unsafe changed_files path: ${String(path)}`);
    const workspaceError = auditWorkspacePath(workspaceReal, path, "changed_files");
    if (workspaceError) return fail(workspaceError);
    const changeError = auditChangedPath({
      allowedSet,
      allowDelete,
      path,
      action,
      label: "changed file",
    });
    if (changeError) {
      return fail(changeError);
    }
  }

  const gitScope = inspectGitScope(workspaceReal);
  if (gitScope.error) return fail(gitScope.error);
  if (!gitScope.available) {
    return ok(
      `scope audit passed using report.changed_files only; git-visible workspace changes were not inspected (${gitScope.reason}); ignored files are outside git-visible scope`,
    );
  }

  for (const change of gitScope.changes) {
    const changeError = auditChangedPath({
      allowedSet,
      allowDelete,
      path: change.path,
      action: change.requiresDelete ? "deleted" : "modified",
      label: `git-visible ${change.kind}`,
    });
    if (changeError) return fail(changeError);
  }

  return ok(
    `scope audit passed; git-visible changes checked (${gitScope.changes.length} path entries); ignored files are outside git-visible scope`,
  );
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
const RUBRIC_AXIS_KEYS = Object.keys(RUBRIC_WEIGHTS);
const MIN_ACCEPTED_SCENARIO_FLOW_SCORE = 85;

const VALID_WORK_TYPES = new Set(["code_change", "docs", "schema_policy", "app_product", "research", "other"]);
const VALID_REVIEW_STATUSES = new Set([
  "accepted",
  "rejected",
  "needs_rework",
  "blocked",
  "validation_failed",
  "security_failed",
  "budget_exceeded",
  "consensus_failed",
]);
const VALID_RECOMMENDATIONS = new Set(["accepted", "needs_rework", "blocked", "rejected"]);
const VALID_REVIEW_INDEPENDENCE = new Set(["real_subagent", "simulated_same_context"]);
const VALID_APP_EVIDENCE_TYPES = new Set([
  "screenshot",
  "manual_behavior_check",
  "automated_test",
  "accessibility_check",
  "responsive_check",
  "not_applicable",
]);
const REQUIRED_SUMMARY_KEYS = [
  "\uBA85\uB839",
  "\uC218\uD589 \uC0AC\uC804 \uC791\uC5C5",
  "\uC218\uD589 \uB0B4\uC6A9",
  "\uC218\uD589 \uACB0\uACFC",
];
const MOJIBAKE_SUMMARY_KEY_PATTERNS = [
  /[?\uFFFD]/u,
  /[\uF900-\uFAFF]/u,
  /[寃筌]/u,
  /낅졊|섑뻾|묒뾽|댁슜|곌낵/u,
];

const APP_QUALITY_CHECK_KEYS = [
  "ux_workflow_completeness",
  "visual_polish",
  "responsive_desktop_mobile",
  "accessibility_basics",
  "error_loading_empty_states",
  "text_overlap_layout_stability",
  "domain_fit",
];
const APP_QUALITY_GATE_KEYS = [...APP_QUALITY_CHECK_KEYS, "evidence_requirements"];
const ACCEPTED_TOP_LEVEL_CHECK_KEYS = [
  "scope_check",
  "goal_contract_check",
  "security_check",
  "secret_scan_result",
  "scope_diff_result",
];
const REQUIRED_VERIFICATION_CHECK_KEYS = ["build", "lint", "test", "run", "behavior_check"];
const COMMAND_BASED_VERIFICATION_KEYS = ["build", "lint", "test"];
const APP_RUNTIME_VERIFICATION_KEYS = ["run", "behavior_check"];
const VALID_CHECK_STATUSES = new Set(["passed", "failed", "not_run", "not_applicable"]);

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

function checkEvidenceText(check) {
  return collectText([check?.evidence, check?.description, check?.artifact, check?.findings]).trim();
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
    if (isGenericEvidenceText(scenarioFlowEvidenceText(flow))) {
      return `scenario_flow_scores[${index}] evidence is generic`;
    }
  }

  return undefined;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function auditContractScenarioFlowCoverage(report, contract) {
  const contractFlows = contract.scenario_flows;
  if (!Array.isArray(contractFlows)) {
    return "contract.scenario_flows must be a list";
  }

  const contractIds = [];
  for (const [index, flow] of contractFlows.entries()) {
    if (!flow || typeof flow !== "object" || Array.isArray(flow)) {
      return `contract.scenario_flows[${index}] must be an object`;
    }
    if (typeof flow.id !== "string" || flow.id.trim().length === 0) {
      return `contract.scenario_flows[${index}] must include id`;
    }
    contractIds.push(flow.id);
  }

  const duplicateContractIds = duplicateValues(contractIds);
  if (duplicateContractIds.length > 0) {
    return `contract.scenario_flows must not contain duplicate ids: ${duplicateContractIds.join(", ")}`;
  }

  const reviewIds = report.scenario_flow_scores.map((flow) => flow.id);
  const duplicateReviewIds = duplicateValues(reviewIds);
  if (duplicateReviewIds.length > 0) {
    return `scenario_flow_scores must not contain duplicate ids: ${duplicateReviewIds.join(", ")}`;
  }

  const contractIdSet = new Set(contractIds);
  const reviewIdSet = new Set(reviewIds);
  const unknownReviewIds = reviewIds.filter((id) => !contractIdSet.has(id));
  const missingContractIds = contractIds.filter((id) => !reviewIdSet.has(id));
  const coverageErrors = [];
  if (unknownReviewIds.length > 0) {
    coverageErrors.push(`ids not present in contract.scenario_flows: ${unknownReviewIds.join(", ")}`);
  }
  if (missingContractIds.length > 0) {
    coverageErrors.push(`missing contract scenario flow ids: ${missingContractIds.join(", ")}`);
  }
  if (coverageErrors.length > 0) {
    return `scenario_flow_scores contract coverage mismatch; ${coverageErrors.join("; ")}`;
  }

  if (report.status === "accepted" || report.recommendation === "accepted") {
    const contractFlowById = new Map(contractFlows.map((flow) => [flow.id, flow]));
    const isAppProduct = report.work_type === "app_product" || contract.work_type === "app_product";
    for (const flow of report.scenario_flow_scores) {
      if (flow.passed !== true) {
        return `accepted contract-linked review requires passed scenario_flow_scores id: ${flow.id}`;
      }
      if (!Number.isInteger(flow.score) || flow.score < 0 || flow.score > 100) {
        return `accepted contract-linked review requires scenario_flow_scores id ${flow.id} integer score between 0 and 100`;
      }
      if (flow.score < MIN_ACCEPTED_SCENARIO_FLOW_SCORE) {
        return `accepted contract-linked review requires scenario_flow_scores id ${flow.id} score >= ${MIN_ACCEPTED_SCENARIO_FLOW_SCORE}`;
      }
      if (isAppProduct && !hasConcreteScenarioFlowEvidence(flow, contractFlowById.get(flow.id), contract)) {
        return `accepted contract-linked app_product review requires scenario_flow_scores id ${flow.id} concrete action/result evidence with domain or workflow detail`;
      }
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
    if (isAppProduct && requirePassedAppQuality && !hasConcreteAppEvidenceText(check.evidence)) {
      return `app_quality_check.${key} must include concrete domain, UI, workflow, or state evidence`;
    }
    if (isAppProduct && requirePassedAppQuality && key === "domain_fit" && !hasConcreteDomainEvidence(check.evidence)) {
      return "app_quality_check.domain_fit must name concrete product/domain entities or vocabulary";
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

const GENERIC_EVIDENCE_PATTERNS = [
  /^\s*(passed(?: with evidence)?|checked|verified|done|ok|works?|working|tested|all good|looks good|looks fine|manual check passed|check passed|layout visible|screenshot inspected|responsive|polished|seems fine|accessibility considered|standard app|best practices|as needed)\s*\.?\s*$/i,
  /^\s*(desktop|mobile|responsive|accessibility|state|workflow|behavior|layout|ui|screenshot)?\s*(checked|passed|inspected|verified|visible|done|works?|working|tested)\s*\.?\s*$/i,
  /^\s*(통과|확인|확인함|확인 완료|완료|정상|작동|작동함|테스트 완료|문제 없음|좋아 보임|괜찮음|레이아웃 표시|스크린샷 확인|반응형|접근성 고려|표준 앱|모범 사례|필요 시)\s*\.?\s*$/iu,
  /^\s*(데스크톱|데스크탑|모바일|반응형|접근성|상태|워크플로|동작|레이아웃|ui|ux|스크린샷)?\s*(확인|통과|검사|검수|표시|완료|작동|테스트)\s*\.?\s*$/iu,
  /\b(lorem ipsum|placeholder[-\s]?only|only placeholder|placeholder ui|feature list only|dummy ui)\b/i,
  /\b(boilerplate|generic evidence|standard app|best practices|as needed)\b/i,
  /(로렘 입숨|플레이스홀더만|더미 UI|일반적인 증거|표준 앱|모범 사례|필요 시)/iu,
];

const WEAK_GOAL_PATTERNS = [
  /^\s*(simple|modern|nice|clean|intuitive|user[-\s]?friendly|productivity|dashboard|app|tool|website|items?)\s*\.?\s*$/i,
  /^\s*(간단한|심플한|모던한|좋은|깔끔한|직관적인|사용자 친화적인|생산성|대시보드|앱|어플|도구|웹사이트|항목|아이템|화면|페이지)\s*\.?\s*$/iu,
  /\busers? (can )?(manage|track|view|create|edit|update|organize) (things|items|stuff|data|content)\b/i,
  /\b(manage|track|view|create|edit|update|organize) (things|items|stuff|data|content)\b/i,
  /사용자(?:는|가)?\s*(?:것|항목|아이템|데이터|콘텐츠|내용|작업)(?:을|를)?\s*(?:관리|추적|보기|확인|생성|수정|업데이트|정리)/iu,
  /(?:것|항목|아이템|데이터|콘텐츠|내용|작업)(?:을|를)?\s*(?:관리|추적|보기|확인|생성|수정|업데이트|정리)/iu,
];

const GENERIC_BRIEF_TOKENS = new Set([
  "app",
  "application",
  "as",
  "avoid",
  "basic",
  "best",
  "clean",
  "content",
  "create",
  "dashboard",
  "data",
  "edit",
  "friendly",
  "generic",
  "intuitive",
  "item",
  "items",
  "manage",
  "modern",
  "needed",
  "nice",
  "none",
  "product",
  "productivity",
  "practices",
  "simple",
  "standard",
  "stuff",
  "thing",
  "things",
  "tool",
  "track",
  "update",
  "user",
  "users",
  "view",
  "website",
  "workflow",
  "ui",
  "ux",
  "간단한",
  "간단",
  "심플한",
  "심플",
  "모던한",
  "모던",
  "좋은",
  "좋게",
  "깔끔한",
  "깔끔",
  "직관적인",
  "사용자",
  "사용자는",
  "사용자가",
  "친화적인",
  "생산성",
  "앱",
  "어플",
  "애플리케이션",
  "도구",
  "제품",
  "프로덕트",
  "웹사이트",
  "사이트",
  "대시보드",
  "화면",
  "페이지",
  "인터페이스",
  "항목",
  "항목을",
  "아이템",
  "데이터",
  "콘텐츠",
  "내용",
  "작업",
  "관리",
  "관리할",
  "추적",
  "확인",
  "보기",
  "생성",
  "수정",
  "업데이트",
  "정리",
  "기본",
  "일반",
  "표준",
  "필요",
  "필요시",
  "워크플로",
]);

const GENERIC_BRIEF_FILLER_PATTERNS = [
  /^\s*(n\/?a|none|not applicable|tbd|to be decided|as needed|standard|standard app assumptions|best practices|passed|checked|verified|done|ok|looks good|layout visible)\s*\.?\s*$/i,
  /^\s*(no assumptions|no specific assumptions|no non[-\s]?goals|no extra features|avoid scope creep)\s*\.?\s*$/i,
  /^\s*(해당 없음|없음|미정|필요 시|필요시|표준|기본|일반|표준 앱 가정|모범 사례|통과|확인|확인 완료|완료|문제 없음|레이아웃 표시)\s*\.?\s*$/iu,
  /^\s*(가정 없음|구체적 가정 없음|비목표 없음|추가 기능 없음|범위 확장 방지)\s*\.?\s*$/iu,
  /\b(generic|placeholder|standard app|typical app|simple app|modern ui|best practices|as needed)\b/i,
  /\b(users? (can )?(manage|track|view|create|edit|update|organize) (things|items|stuff|data|content))\b/i,
  /(일반적인|플레이스홀더|표준 앱|전형적인 앱|간단한 앱|모던 UI|모범 사례|필요 시)/iu,
  /사용자(?:는|가)?\s*(?:것|항목|아이템|데이터|콘텐츠|내용|작업)(?:을|를)?\s*(?:관리|추적|보기|확인|생성|수정|업데이트|정리)/iu,
];

const PRODUCT_PAGE_NOUN_PATTERN =
  "(?:pricing|home|sign[-\\s]?up|onboarding|checkout|profile|settings|marketing|landing|sales|subscription|account|billing|product|plan|plans|feature|contact|about|help|admin|team|customer)\\s+page|homepage";
const KOREAN_PRODUCT_PAGE_NOUN_PATTERN =
  "(?:가격|홈|가입|온보딩|체크아웃|프로필|설정|마케팅|랜딩|영업|구독|계정|청구|상품|제품|요금제|기능|문의|소개|도움말|관리자|팀|고객)\\s*페이지";
const KOREAN_APP_PRODUCT_NOUN_PATTERN =
  `(?:웹\\s*앱|앱|어플|애플리케이션|웹사이트|사이트|게임|도구|제품|프로덕트|대시보드|편집기|생성기|트래커|추적기|플래너|포털|플랫폼|경험|인터페이스|UI|UX|프론트엔드|보드|빌더|계산기|시각화|스케줄러|캘린더|타이머|스톱워치|위젯|카운터|퀴즈|오디오\\s*플레이어|비디오\\s*플레이어|미디어\\s*플레이어|플레이어|칸반|스토어프론트|상점|쇼핑몰|작업공간|워크스페이스|콘솔|CRM|CMS|ERP|POS|재고|예약|마켓플레이스|포트폴리오|브라우저\\s*확장|크롬\\s*확장|파이어폭스\\s*확장|확장|슬랙\\s*봇|디스코드\\s*봇|팀즈\\s*봇|지원\\s*봇|고객\\s*지원\\s*봇|챗\\s*봇|챗봇|봇|코파일럿|할\\s*일\\s*목록|작업\\s*목록|체크리스트|관리자\\s*패널|고객\\s*포털|클라이언트\\s*포털|지식\\s*베이스|헬프\\s*데스크|티켓팅|이커머스|전자상거래|스토어|결제|분석|리포팅|폼\\s*빌더|설문|LMS|강의\\s*포털|멤버십|디렉터리|채용\\s*게시판|이슈\\s*트래커|인보이스|주문\\s*관리|자산\\s*관리|창고|물류|영업\\s*파이프라인|고객\\s*관계\\s*관리|리드\\s*관리|견적\\s*계산기|접수\\s*폼|고객\\s*접수|연락처\\s*관리|딜\\s*트래커|제안서\\s*빌더|주문\\s*폼|예약\\s*폼|인수인계\\s*앱|인수인계\\s*보드|인수인계\\s*대시보드|교대\\s*인수인계|${KOREAN_PRODUCT_PAGE_NOUN_PATTERN})`;
const CONTEXTUAL_AGENT_ASSISTANT_NOUN_PATTERN =
  "(?:support|customer|chat|help|sales|shopping|virtual)\\s+assistant|assistant\\s+(?:app|application|ui|interface|dashboard|workspace|portal|tool)|agent\\s+(?:dashboard|workspace|console|portal|desktop|interface|ui)";
const APP_PRODUCT_NOUN_PATTERN =
  `(?:\\b(app|application|web\\s*app|website|site|game|tool|product|dashboard|editor|generator|tracker|habit\\s+tracker|planner|portal|platform|experience|interface|ui|ux|frontend|board|builder|calculator|visualizer|scheduler|calendar|timer|pomodoro|stopwatch|widget|counter|quiz|audio\\s+player|video\\s+player|media\\s+player|player|kanban|storefront|shop|workspace|console|crm|cms|erp|pos|inventory|booking|reservation|marketplace|portfolio|browser\\s+extension|chrome\\s+extension|firefox\\s+extension|extension|slack\\s+bot|discord\\s+bot|teams\\s+bot|support\\s+bot|chat\\s*bot|bot|copilot|${CONTEXTUAL_AGENT_ASSISTANT_NOUN_PATTERN}|to[-\\s]?do\\s+list|task\\s+list|checklist|${PRODUCT_PAGE_NOUN_PATTERN}|admin\\s+panel|client\\s+portal|customer\\s+portal|knowledge\\s+base|help\\s+desk|ticketing|ecommerce|e-commerce|store|checkout|analytics|reporting|form\\s+builder|survey|lms|course\\s+portal|membership|directory|job\\s+board|issue\\s+tracker|invoice|billing|order\\s+management|asset\\s+management|warehouse|logistics|sales\\s+pipeline|customer\\s+relationship\\s+manager|lead\\s+manager|quote\\s+estimator|intake\\s+form|client\\s+intake|contact\\s+manager|deal\\s+tracker|proposal\\s+builder|order\\s+form|booking\\s+form)\\b|${KOREAN_APP_PRODUCT_NOUN_PATTERN})`;
const APP_CREATION_VERB_PATTERN =
  "\\b(add|build|create|make|design|develop|scaffold|prototype|implement|launch|ship|generate|spin\\s+up|set\\s+up)\\b";
const KOREAN_APP_CREATION_VERB_PATTERN =
  "(?:만들어\\s*줘|만들어줘|만들어|만들기|제작해\\s*줘|제작|구현해\\s*줘|구현|개발해\\s*줘|개발|설계해\\s*줘|설계|디자인해\\s*줘|디자인|프로토타입|출시|런칭|스캐폴드)";
const IMPLEMENTATION_ONLY_OBJECT_PATTERN =
  "(?:(?:[\\w-]+\\s+){0,3}(?:tests?|unit\\s+tests?|integration\\s+tests?|regression\\s+tests?|e2e|specs?|coverage|test\\s+coverage|docs?|documentation|readme|changelog|config|configuration|settings|dependencies?|packages?|lockfiles?|package-lock|pnpm-lock|yarn\\.lock|schema|policy|lint|format|ci|github\\s+actions\\s+workflow|refactor|cleanup|clean\\s+up))";
const CREATION_VERB_COMMAND_SEQUENCE_GUARD =
  "(?!\\s*(?:[,/]|(?:and\\s+)?(?:build|lint|test|run)\\b))";
const APP_CREATION_VERB_TARGET_PATTERN =
  `\\b(add|build|create|make|design|develop|scaffold|prototype|implement|launch|ship|generate|spin\\s+up|set\\s+up)\\b${CREATION_VERB_COMMAND_SEQUENCE_GUARD}(?!\\s+(?:out\\s+)?(?:a\\s+|an\\s+|the\\s+|this\\s+|that\\s+|these\\s+|those\\s+|existing\\s+|current\\s+)?${IMPLEMENTATION_ONLY_OBJECT_PATTERN}\\b)`;
const APP_CREATION_VERB_TARGET_WITHOUT_ADD_PATTERN =
  `\\b(build|create|make|design|develop|scaffold|prototype|implement|launch|ship|generate|spin\\s+up|set\\s+up)\\b${CREATION_VERB_COMMAND_SEQUENCE_GUARD}(?!\\s+(?:out\\s+)?(?:a\\s+|an\\s+|the\\s+|this\\s+|that\\s+|these\\s+|those\\s+|existing\\s+|current\\s+)?${IMPLEMENTATION_ONLY_OBJECT_PATTERN}\\b)`;
const STRONG_APP_CREATION_PATTERNS = [
  new RegExp(`${APP_CREATION_VERB_TARGET_PATTERN}[\\s\\S]{0,100}${APP_PRODUCT_NOUN_PATTERN}`, "i"),
  new RegExp(`${APP_PRODUCT_NOUN_PATTERN}[\\s\\S]{0,80}${APP_CREATION_VERB_TARGET_PATTERN}`, "i"),
  new RegExp(`\\b(i\\s+need|i\\s+want|make\\s+me|give\\s+me)\\b[\\s\\S]{0,80}${APP_PRODUCT_NOUN_PATTERN}`, "i"),
  new RegExp(`${APP_PRODUCT_NOUN_PATTERN}\\s+for\\b`, "i"),
  new RegExp(`${KOREAN_APP_CREATION_VERB_PATTERN}[\\s\\S]{0,100}${APP_PRODUCT_NOUN_PATTERN}`, "iu"),
  new RegExp(`${APP_PRODUCT_NOUN_PATTERN}[\\s\\S]{0,80}${KOREAN_APP_CREATION_VERB_PATTERN}`, "iu"),
];
const STRONG_APP_CREATION_PATTERNS_WITHOUT_ADD = [
  new RegExp(`${APP_CREATION_VERB_TARGET_WITHOUT_ADD_PATTERN}[\\s\\S]{0,100}${APP_PRODUCT_NOUN_PATTERN}`, "i"),
  new RegExp(`${APP_PRODUCT_NOUN_PATTERN}[\\s\\S]{0,80}${APP_CREATION_VERB_TARGET_WITHOUT_ADD_PATTERN}`, "i"),
  new RegExp(`\\b(i\\s+need|i\\s+want|make\\s+me|give\\s+me)\\b[\\s\\S]{0,80}${APP_PRODUCT_NOUN_PATTERN}`, "i"),
  new RegExp(`${APP_PRODUCT_NOUN_PATTERN}\\s+for\\b`, "i"),
  new RegExp(`${KOREAN_APP_CREATION_VERB_PATTERN}[\\s\\S]{0,100}${APP_PRODUCT_NOUN_PATTERN}`, "iu"),
  new RegExp(`${APP_PRODUCT_NOUN_PATTERN}[\\s\\S]{0,80}${KOREAN_APP_CREATION_VERB_PATTERN}`, "iu"),
];
const APP_CREATION_VERB_TARGET_REGEX = new RegExp(`(?:${APP_CREATION_VERB_TARGET_PATTERN}|${KOREAN_APP_CREATION_VERB_PATTERN})`, "iu");
const KOREAN_APP_PRODUCT_SURFACE_NOUN_PATTERN =
  `(?:${KOREAN_APP_PRODUCT_NOUN_PATTERN}|사용자\\s*경험|시각\\s*디자인|인터랙션\\s*디자인|제품\\s*표면|첫\\s*화면|화면|스크린|페이지|워크플로|흐름|플로우|내비게이션|네비게이션|레이아웃|체크아웃|랜딩\\s*페이지|대시보드|온보딩)`;
const APP_PRODUCT_SURFACE_NOUN_PATTERN =
  `(?:${APP_PRODUCT_NOUN_PATTERN}|\\b(user\\s+experience|ux|ui|visual\\s+design|interaction\\s+design|product\\s+surface|first[-\\s]?screen|screen|screens|page|pages|workflow|flow|navigation|layout|checkout|landing\\s+page|dashboard|onboarding)\\b|${KOREAN_APP_PRODUCT_SURFACE_NOUN_PATTERN})`;
const APP_IMPROVEMENT_VERB_TARGET_PATTERN =
  `\\b(improve|enhance|polish|redesign|revamp|modernize|refresh|upgrade)\\b${CREATION_VERB_COMMAND_SEQUENCE_GUARD}(?!\\s+(?:out\\s+)?(?:a\\s+|an\\s+|the\\s+|this\\s+|that\\s+|these\\s+|those\\s+|existing\\s+|current\\s+)?${IMPLEMENTATION_ONLY_OBJECT_PATTERN}\\b)`;
const KOREAN_APP_IMPROVEMENT_VERB_PATTERN =
  "(?:개선해\\s*줘|개선|향상|다듬어\\s*줘|다듬기|다듬어|리디자인|재디자인|개편|고도화|리프레시|새로\\s*고침|업그레이드|더\\s*좋게|좋게\\s*해\\s*줘|좋게)";
const STRONG_APP_PRODUCT_IMPROVEMENT_PATTERNS = [
  new RegExp(`${APP_IMPROVEMENT_VERB_TARGET_PATTERN}[\\s\\S]{0,100}${APP_PRODUCT_SURFACE_NOUN_PATTERN}`, "i"),
  new RegExp(`${APP_PRODUCT_SURFACE_NOUN_PATTERN}[\\s\\S]{0,80}${APP_IMPROVEMENT_VERB_TARGET_PATTERN}`, "i"),
  /\bmake\s+(?:the\s+|this\s+|that\s+|existing\s+|current\s+)?(?:app|application|website|site|dashboard|landing page|checkout|ui|ux|user experience|interface|page|screen|workflow|flow)\s+(?:feel\s+)?better\b/i,
  /\bmake\s+(?:it|this|that)\s+(?:feel\s+)?better\b/i,
  new RegExp(`${KOREAN_APP_IMPROVEMENT_VERB_PATTERN}[\\s\\S]{0,100}${APP_PRODUCT_SURFACE_NOUN_PATTERN}`, "iu"),
  new RegExp(`${APP_PRODUCT_SURFACE_NOUN_PATTERN}[\\s\\S]{0,80}${KOREAN_APP_IMPROVEMENT_VERB_PATTERN}`, "iu"),
];
const USER_FACING_CONTEXT_PATTERN =
  /\b(user[-\s]?facing|target users?|users?\s+can|visitors?\s+can|players?\s+can|customers?\s+can|clients?\s+can|students?\s+can|first[-\s]?screen|single[-\s]?page|browser[-\s]?based|desktop|mobile|responsive|ui|ux|user experience|interface|frontend|screen|screens|keyboard focus|accessibility)\b|(?:사용자\s*대상|사용자(?:는|가)?|방문자(?:는|가)?|고객(?:은|이)?|클라이언트(?:는|가)?|학생(?:은|이)?|첫\s*화면|단일\s*페이지|브라우저\s*기반|데스크톱|데스크탑|모바일|반응형|사용자\s*경험|인터페이스|프론트엔드|화면|스크린|키보드\s*포커스|접근성)/iu;
const APP_PRODUCT_RUNTIME_OR_UI_PATTERN =
  /\b(user[-\s]?facing scenario|scenario flows?|runtime behavior|behavior check|ui|ux|user experience|interface|visual polish|design polish|first[-\s]?screen|screen|responsive|desktop|mobile|empty state|loading state|error state|validation state|state coverage|keyboard focus|accessibility)\b|(?:사용자\s*시나리오|시나리오\s*흐름|런타임\s*동작|동작\s*확인|사용자\s*경험|인터페이스|시각\s*완성도|디자인\s*완성도|첫\s*화면|화면|반응형|데스크톱|데스크탑|모바일|빈\s*상태|로딩\s*상태|오류\s*상태|에러\s*상태|검증\s*상태|유효성\s*상태|상태\s*커버리지|키보드\s*포커스|접근성)/iu;
const APP_PRODUCT_INTERACTION_PATTERN =
  /\b(add|edit|save|filter|start|pause|reset|play|toggle|complete)\b[\s\S]{0,100}\b(card|record|item|task|project|entry|form|view|screen|button|control|session|timer|counter|quiz|question|answer|player|playlist|audio|video|widget|habit|state|mode)\b|(?:추가|편집|수정|저장|필터|시작|일시정지|초기화|재생|토글|완료)[\s\S]{0,100}(?:카드|기록|레코드|항목|아이템|작업|태스크|프로젝트|엔트리|폼|보기|뷰|화면|버튼|컨트롤|세션|타이머|카운터|퀴즈|질문|답변|플레이어|재생목록|오디오|비디오|위젯|습관|상태|모드)/iu;
const WEAK_APP_PRODUCT_PATTERNS = [
  new RegExp(APP_PRODUCT_NOUN_PATTERN, "i"),
  /\b(first usable screen|responsive desktop|responsive mobile|empty state|loading state|error state|validation state|accessibility|keyboard focus|ux|user experience|visual polish|design polish)\b/i,
  /\b(add|edit|filter|submit|save|delete|drag|drop|complete)\b[\s\S]{0,80}\b(card|record|item|task|project|entry|form|view|screen)\b/i,
  /(?:첫\s*사용\s*화면|반응형\s*데스크톱|반응형\s*모바일|빈\s*상태|로딩\s*상태|오류\s*상태|에러\s*상태|검증\s*상태|유효성\s*상태|접근성|키보드\s*포커스|사용자\s*경험|시각\s*완성도|디자인\s*완성도)/iu,
  /(?:추가|편집|수정|필터|제출|저장|삭제|드래그|드롭|완료)[\s\S]{0,80}(?:카드|기록|레코드|항목|아이템|작업|태스크|프로젝트|엔트리|폼|보기|뷰|화면)/iu,
];
const IMPLEMENTATION_ONLY_PATTERNS = [
  /\b(fix|bugfix|patch|debug|repair|regression|crash|exception|failing|broken|defect)\b/i,
  /\b(refactor|cleanup|clean up|rename|reorganize|migrate|upgrade|dependency|dependencies)\b/i,
  /\b(add|write|update|create|fix|repair|improve)\b[\s\S]{0,40}\b(tests|unit tests|integration tests|e2e|spec|coverage)\b/i,
  /\b(add|write|update|create|build|set up|fix|repair|improve)\b[\s\S]{0,40}\b(docs?|documentation|readme|changelog|config|configuration|settings|schema|policy|lint|format|ci|build pipeline|deployment pipeline|github actions workflow)\b/i,
  /\b(existing|current|repo|repository|codebase)\b[\s\S]{0,80}\b(fix|bug|refactor|test|docs?|config|schema|lint|ci)\b/i,
];
const EXISTING_CODEBASE_CONTEXT_PATTERNS = [
  /\b(existing|current)\b[\s\S]{0,60}\b(app|application|web\s*app|website|site|game|tool|product|dashboard|editor|generator|tracker|planner|portal|platform|bot|assistant|agent|repo|repository|codebase|code base|project)\b/i,
  /\b(this|the)\b[\s\S]{0,30}\b(app|application|web\s*app|website|site|game|tool|product|dashboard|editor|generator|tracker|planner|portal|platform|bot|assistant|agent|repo|repository|codebase|code base|project)\b/i,
  /\b(repo|repository|codebase|code base)\b/i,
];
const DESKTOP_VISUAL_EVIDENCE_PATTERN =
  /\b(desktop|1440|1280|wide viewport)\b|(?:데스크톱|데스크탑|넓은\s*뷰포트|와이드\s*뷰포트)/iu;
const MOBILE_VISUAL_EVIDENCE_PATTERN =
  /\b(mobile|390|375|narrow viewport|phone)\b|(?:모바일|휴대폰|폰|좁은\s*뷰포트)/iu;
const VISUAL_ARTIFACT_OR_INSPECTION_PATTERN =
  /\b(screenshot|visual|inspection|inspect|inspected|artifact)\b|(?:스크린샷|캡처|시각|화면\s*검사|검사|검수|아티팩트|산출물)/iu;
const APP_EVIDENCE_DETAIL_PATTERNS = [
  /\b(board|card|cards|form|field|filter|control|button|panel|table|row|list|grid|lane|badge|count|counts|message|layout|screen|viewport|desktop|mobile|phone|keyboard|focus|labels?|aria|contrast|workflow|task|tasks)\b/i,
  /\b(empty|loading|error|validation|disabled|success|saved|state|overlap|clipping|clipped|wrap|wrapped|stacked|responsive)\b/i,
  /\b(add|edit|create|save|submit|filter|complete|open|close|search|sort|select|navigate|inspect|exercise)\b/i,
  /(?:보드|카드|폼|필드|필터|컨트롤|버튼|패널|테이블|행|목록|리스트|그리드|레인|배지|카운트|메시지|레이아웃|화면|뷰포트|데스크톱|데스크탑|모바일|휴대폰|폰|키보드|포커스|레이블|라벨|대비|워크플로|흐름|작업|태스크|인수인계|환자|병동|교대|알림|준비상태)/iu,
  /(?:빈|로딩|오류|에러|검증|유효성|비활성|성공|저장|상태|겹침|잘림|줄바꿈|스택|반응형)/iu,
  /(?:추가|편집|수정|생성|저장|제출|필터|완료|열기|닫기|검색|정렬|선택|이동|탐색|검사|검수|확인|실행)/iu,
];
const APP_EVIDENCE_OBSERVED_PATTERNS = [
  /\b(visible|rendered|opened|created|saved|submitted|filtered|completed|updated|appeared|show|shows|showed|displayed|stacked|wrapped|reached|triggered|disabled|enabled|inspect|inspects|inspected|confirmed|passed|remained|generated|contains|uses|use|matches|exercised|recoverable)\b/i,
  /\b(no overlap|without overlap|without clipping|without clipped|not clipped|not overlap)\b/i,
  /(?:보임|보였|표시|표시됨|렌더링|열림|열렸|생성됨|생성됐|저장됨|저장됐|제출됨|필터링됨|완료됨|완료됐|업데이트됨|나타남|나타났|쌓임|줄바꿈됨|도달|트리거|비활성화|활성화|검사됨|검수됨|확인됨|통과|유지됨|생성했|포함|사용|일치|실행됨|복구 가능)/iu,
  /(?:겹침\s*없|잘림\s*없|겹치지\s*않|잘리지\s*않)/iu,
];
const APP_BEHAVIOR_ACTION_PATTERN =
  /\b(add|added|adds|adding|create|created|creates|creating|edit|edited|edits|editing|save|saved|saves|saving|filter|filtered|filters|filtering|submit|submitted|submits|submitting|complete|completed|completes|completing|open|opened|opens|opening|close|closed|closes|closing|search|searched|searches|searching|sort|sorted|sorts|sorting|select|selected|selects|selecting|navigate|navigated|navigates|navigating|click|clicked|clicks|clicking|enter|entered|enters|entering|type|typed|types|typing|trigger|triggered|triggers|triggering|reset|resets|resetting|clear|cleared|clears|clearing|delete|deleted|deletes|deleting|drag|dragged|drags|dragging|drop|dropped|drops|dropping|move|moved|moves|moving)\b|(?:추가|생성|편집|수정|저장|필터|제출|완료|열기|닫기|검색|정렬|선택|탐색|이동|클릭|입력|타이핑|트리거|초기화|지우기|삭제|드래그|드롭)/iu;
const APP_BEHAVIOR_RESULT_PATTERN =
  /\b(created|added|saved|filtered|updated|confirmed|submitted|completed|changed|cleared|reset|deleted|removed|moved|selected|sorted|searched|triggered|validated|disabled|enabled|preserved|recovered|recoverable|appeared|shown|showed|reached|count(?:s)?\s+updated|status(?:es)?\s+updated|labels?\s+updated)\b|(?:생성됨|추가됨|저장됨|필터링됨|업데이트됨|확인됨|제출됨|완료됨|변경됨|지워짐|초기화됨|삭제됨|제거됨|이동됨|선택됨|정렬됨|검색됨|트리거됨|검증됨|유효성\s*표시|비활성화됨|활성화됨|유지됨|복구됨|복구\s*가능|나타남|표시됨|도달함|카운트\s*업데이트|상태\s*업데이트|레이블\s*업데이트|라벨\s*업데이트)/iu;
const APP_WORKFLOW_CONTEXT_PATTERN =
  /\b(behavior|workflow|flow|interaction|manual check|automated test|end[-\s]?to[-\s]?end|e2e|user journey)\b|(?:동작|행동|워크플로|흐름|플로우|상호작용|수동\s*확인|수동\s*검사|자동\s*테스트|사용자\s*여정)/iu;
const APP_ACCESSIBILITY_SPECIFIC_PATTERN =
  /\b(keyboard|tab(?:\s+order)?|focus|labels?|aria(?:-[a-z]+)?|contrast|screen\s+reader|axe|wcag|roles?|semantic|alt\s+text)\b|(?:키보드|탭\s*순서|포커스|레이블|라벨|대비|스크린\s*리더|역할|시맨틱|대체\s*텍스트|접근성)/iu;
const APP_STATE_COVERAGE_PATTERN =
  /\b(empty|first-run|loading|error|success|saved-success|disabled|validation|state coverage|state)\b|(?:빈|최초|첫\s*실행|로딩|오류|에러|성공|저장\s*성공|비활성|검증|유효성|상태\s*커버리지|상태)/iu;
const APP_STATE_EVIDENCE_CONTEXT_PATTERN =
  /\b(state|coverage|test|check|evidence|artifact|inspection|inspect|manual|automated)\b|(?:상태|커버리지|테스트|확인|증거|아티팩트|산출물|검사|검수|수동|자동)/iu;
const APP_EVIDENCE_ARTIFACT_OR_CHECK_PATTERN =
  /\b(screenshot|artifact|inspection|inspect|inspected|check|checked|manual|automated|test|notes?|recording|trace|report|evidence)\b|(?:스크린샷|캡처|아티팩트|산출물|검사|검수|확인|수동|자동|테스트|노트|기록|트레이스|보고서|증거)/iu;
const FLOW_EDGE_CASE_DETAIL_PATTERN =
  /\b(empty|first-run|loading|error|validation|invalid|required|missing|disabled|edge|failure|fail|failed|offline|permission|denied|timeout|retry|recover|recoverable|unavailable|conflict|duplicate|overflow|overlap|clipping|clipped|wrap|wrapped|long|boundary|limit|rate|unauthorized|blocked)\b|(?:빈|첫\s*실행|로딩|오류|에러|검증|유효성|유효하지\s*않|필수|누락|비활성|엣지|경계|실패|오프라인|권한|거부|타임아웃|재시도|복구|사용\s*불가|충돌|중복|오버플로|겹침|잘림|줄바꿈|긴|제한|차단)/iu;
const WEAK_EDGE_CASE_PATTERNS = [
  /^\s*(n\/?a|none|not applicable|happy path only|happy-path only|no edge cases?|no failure cases?|no failures?|not needed|as needed|standard)\s*\.?\s*$/i,
  /^\s*(해당 없음|없음|필요 없음|필요시|필요 시|표준|해피 패스만|실패 없음|엣지 케이스 없음|경계 사례 없음)\s*\.?\s*$/iu,
];
const APP_GATE_DETAIL_PATTERNS = [
  ...APP_EVIDENCE_DETAIL_PATTERNS,
  /\b(workflow|hierarchy|priority|readiness|task|record|entity|entities|artifact|screenshot|behavior|accessibility|state coverage)\b/i,
  /\b(sample|terms?|vocabulary|domain|interactions?)\b/i,
  /(?:워크플로|흐름|계층|우선순위|준비상태|작업|태스크|기록|레코드|엔티티|아티팩트|산출물|스크린샷|동작|행동|접근성|상태\s*커버리지)/iu,
  /(?:샘플|용어|어휘|도메인|상호작용)/iu,
];
const DOMAIN_GENERIC_TOKENS = new Set([
  ...GENERIC_BRIEF_TOKENS,
  "action",
  "actions",
  "artifact",
  "artifacts",
  "basic",
  "basics",
  "behavior",
  "browser",
  "button",
  "buttons",
  "card",
  "cards",
  "check",
  "checked",
  "checks",
  "client",
  "complete",
  "concrete",
  "control",
  "controls",
  "data",
  "desktop",
  "details",
  "domain",
  "entry",
  "entries",
  "evidence",
  "field",
  "fields",
  "filter",
  "filters",
  "first",
  "fit",
  "fits",
  "form",
  "forms",
  "interaction",
  "interactions",
  "label",
  "labels",
  "layout",
  "local",
  "mobile",
  "name",
  "names",
  "primary",
  "record",
  "records",
  "responsive",
  "sample",
  "samples",
  "screen",
  "screens",
  "state",
  "states",
  "status",
  "statuses",
  "term",
  "terms",
  "ui",
  "usable",
  "user",
  "users",
  "viewport",
  "viewports",
  "visible",
  "work",
  "workflow",
  "workflows",
  "스크린샷",
  "캡처",
  "아티팩트",
  "산출물",
  "증거",
  "확인",
  "검사",
  "검수",
  "수동",
  "자동",
  "테스트",
  "보고서",
  "데스크톱",
  "데스크탑",
  "모바일",
  "뷰포트",
  "반응형",
  "화면",
  "스크린",
  "레이아웃",
  "보드",
  "카드",
  "폼",
  "필드",
  "필터",
  "컨트롤",
  "버튼",
  "패널",
  "테이블",
  "목록",
  "리스트",
  "그리드",
  "배지",
  "카운트",
  "메시지",
  "키보드",
  "포커스",
  "레이블",
  "라벨",
  "대비",
  "워크플로",
  "흐름",
  "플로우",
  "상호작용",
  "상태",
  "상태커버리지",
  "커버리지",
  "빈",
  "로딩",
  "오류",
  "에러",
  "검증",
  "유효성",
  "비활성",
  "성공",
  "저장",
  "겹침",
  "잘림",
  "줄바꿈",
  "사용자",
  "고객",
  "방문자",
  "대상",
  "앱",
  "어플",
  "애플리케이션",
  "도구",
  "제품",
  "프로덕트",
  "웹사이트",
  "사이트",
  "대시보드",
  "페이지",
  "인터페이스",
  "데이터",
  "콘텐츠",
  "항목",
  "아이템",
  "작업",
  "태스크",
  "엔티티",
  "레코드",
  "기록",
  "도메인",
  "용어",
  "어휘",
  "샘플",
  "기본",
  "일반",
  "표준",
  "필요",
  "필요시",
  "추가",
  "생성",
  "편집",
  "수정",
  "저장됨",
  "업데이트",
  "선택",
  "이동",
  "표시",
  "표시됨",
]);
const DOMAIN_TOKEN_PATTERN =
  /[\p{Script=Latin}\p{Script=Hangul}][\p{Script=Latin}\p{Script=Hangul}\p{Number}_-]*/gu;
const HANGUL_TOKEN_PATTERN = /\p{Script=Hangul}/u;
const DOMAIN_TOKEN_TRAILING_KOREAN_PARTICLE_PATTERN = /[은는이가을를의에와과로도만]$/u;

function normalizeDomainToken(token) {
  let normalized = token.toLowerCase();
  if (HANGUL_TOKEN_PATTERN.test(normalized) && Array.from(normalized).length > 2) {
    normalized = normalized.replace(DOMAIN_TOKEN_TRAILING_KOREAN_PARTICLE_PATTERN, "");
  }
  return normalized;
}

function hasMinimumDomainTokenLength(token) {
  if (HANGUL_TOKEN_PATTERN.test(token)) return Array.from(token).length >= 2;
  return token.length >= 3;
}

function unicodeDomainTokens(value) {
  const text = normalizedText(value).toLowerCase();
  return (text.match(DOMAIN_TOKEN_PATTERN) ?? [])
    .map(normalizeDomainToken)
    .filter((token) => hasMinimumDomainTokenLength(token));
}

function isGenericEvidenceText(value) {
  const text = collectText(value).trim();
  if (text.length === 0) return true;
  return GENERIC_EVIDENCE_PATTERNS.some((pattern) => pattern.test(text));
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizedText(value) {
  return collectText(value).replace(/\s+/g, " ").trim();
}

function meaningfulDomainTokens(value) {
  return unicodeDomainTokens(value).filter((token) => !DOMAIN_GENERIC_TOKENS.has(token));
}

function hasConcreteAppEvidenceText(value) {
  const text = normalizedText(value);
  if (text.length < 50) return false;
  if (isGenericEvidenceText(text)) return false;
  if (!containsAny(text, APP_EVIDENCE_DETAIL_PATTERNS)) return false;
  if (!containsAny(text, APP_EVIDENCE_OBSERVED_PATTERNS)) return false;
  return true;
}

function hasBehaviorEvidenceText(value) {
  const text = normalizedText(value);
  return APP_BEHAVIOR_ACTION_PATTERN.test(text) && APP_BEHAVIOR_RESULT_PATTERN.test(text);
}

function hasConcreteBehaviorEvidenceText(value) {
  return hasConcreteAppEvidenceText(value) && hasBehaviorEvidenceText(value);
}

function hasAccessibilityEvidenceText(value) {
  return APP_ACCESSIBILITY_SPECIFIC_PATTERN.test(normalizedText(value));
}

function hasConcreteAccessibilityEvidenceText(value) {
  return hasConcreteAppEvidenceText(value) && hasAccessibilityEvidenceText(value);
}

function hasConcreteStateEvidenceText(value) {
  const text = normalizedText(value);
  return hasConcreteAppEvidenceText(text) && APP_STATE_COVERAGE_PATTERN.test(text) && APP_STATE_EVIDENCE_CONTEXT_PATTERN.test(text);
}

function hasConcreteScenarioFlowEvidence(flow, contractFlow, contract) {
  const text = scenarioFlowEvidenceText(flow);
  if (!hasConcreteBehaviorEvidenceText(text)) return false;
  const evidenceTokens = new Set(meaningfulDomainTokens(text));
  const contractTokens = new Set(meaningfulDomainTokens([
    contract.concrete_goal,
    contract.product_brief,
    contractFlow,
  ]));
  return [...evidenceTokens].some((token) => contractTokens.has(token));
}

function hasConcreteDomainEvidence(value) {
  return new Set(meaningfulDomainTokens(value)).size >= 2;
}

function hasDomainSpecificSignal(value) {
  return meaningfulDomainTokens(value).length > 0;
}

function isGenericBriefText(value, minLength = 20) {
  const text = normalizedText(value);
  if (text.length < minLength) return true;
  if (GENERIC_BRIEF_FILLER_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (WEAK_GOAL_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return !hasDomainSpecificSignal(text);
}

function listHasSpecificEntries(value, minCount, label) {
  if (!Array.isArray(value) || value.length < minCount) {
    return `${label} must contain at least ${minCount} concrete item${minCount === 1 ? "" : "s"}`;
  }
  const generic = value.find((item) => isGenericBriefText(item));
  if (generic) return `${label} contains a generic item: ${String(generic)}`;
  return undefined;
}

function auditAppQualityGates(contract) {
  const gates = contract.app_quality_gates;
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
    return "app_product contracts require app_quality_gates";
  }

  for (const key of APP_QUALITY_GATE_KEYS) {
    const entries = gates[key];
    if (!Array.isArray(entries) || entries.length === 0) {
      return `app_quality_gates.${key} must be a non-empty array`;
    }
    for (const [index, entry] of entries.entries()) {
      const text = normalizedText(entry);
      if (typeof entry !== "string" || text.length === 0) {
        return `app_quality_gates.${key}[${index}] must be a non-empty string`;
      }
      if (
        text.length < 35 ||
        isGenericEvidenceText(text) ||
        !containsAny(text, APP_GATE_DETAIL_PATTERNS)
      ) {
        return `app_quality_gates.${key}[${index}] must be concrete and non-generic`;
      }
    }
  }

  const domainFitText = normalizedText(gates.domain_fit);
  const domainFitTokens = new Set(meaningfulDomainTokens(domainFitText));
  const contractTokens = new Set(meaningfulDomainTokens([contract.concrete_goal, contract.product_brief]));
  const sharedDomainTokens = [...domainFitTokens].filter((token) => contractTokens.has(token));
  if (domainFitTokens.size < 2 || sharedDomainTokens.length === 0) {
    return "app_quality_gates.domain_fit must name concrete product/domain entities or vocabulary";
  }

  return undefined;
}

function hasPlanDomainOrWorkflowDetail(value, contract) {
  const planTokens = new Set(meaningfulDomainTokens(value));
  const contractTokens = new Set(meaningfulDomainTokens([
    contract.concrete_goal,
    contract.success_criteria,
    contract.scope_in,
    contract.product_brief,
    contract.scenario_flows,
  ]));
  return [...planTokens].some((token) => contractTokens.has(token));
}

function hasUniqueEvidencePlanAssignment(categoryMatches) {
  const orderedMatches = [...categoryMatches].sort((left, right) => left.matches.length - right.matches.length);
  const used = new Set();
  const visit = (index) => {
    if (index === orderedMatches.length) return true;
    for (const matchIndex of orderedMatches[index].matches) {
      if (used.has(matchIndex)) continue;
      used.add(matchIndex);
      if (visit(index + 1)) return true;
      used.delete(matchIndex);
    }
    return false;
  };
  return visit(0);
}

function auditAcceptanceEvidencePlan(contract) {
  const plan = contract.acceptance_evidence_plan;
  if (!Array.isArray(plan) || plan.length < 5) {
    return "acceptance_evidence_plan must contain separate entries for desktop visual evidence, mobile visual evidence, behavior evidence, accessibility evidence, and state coverage evidence";
  }

  const entries = plan.map((entry) => normalizedText(entry));
  for (const [index, entry] of plan.entries()) {
    const text = entries[index];
    if (typeof entry !== "string" || text.length === 0) {
      return `acceptance_evidence_plan[${index}] must be a non-empty string`;
    }
    if (isGenericEvidenceText(text)) {
      return `acceptance_evidence_plan[${index}] is generic`;
    }
  }

  const categories = [
    {
      label: "desktop visual evidence",
      matches: (text) => DESKTOP_VISUAL_EVIDENCE_PATTERN.test(text) && VISUAL_ARTIFACT_OR_INSPECTION_PATTERN.test(text),
    },
    {
      label: "mobile visual evidence",
      matches: (text) => MOBILE_VISUAL_EVIDENCE_PATTERN.test(text) && VISUAL_ARTIFACT_OR_INSPECTION_PATTERN.test(text),
    },
    {
      label: "primary workflow behavior evidence",
      matches: (text) => APP_WORKFLOW_CONTEXT_PATTERN.test(text) && hasBehaviorEvidenceText(text),
    },
    {
      label: "accessibility basics evidence",
      matches: (text) => APP_ACCESSIBILITY_SPECIFIC_PATTERN.test(text) && hasAccessibilityEvidenceText(text),
    },
    {
      label: "state coverage evidence",
      matches: (text) => APP_STATE_COVERAGE_PATTERN.test(text) && APP_STATE_EVIDENCE_CONTEXT_PATTERN.test(text),
    },
  ];

  const categoryMatches = categories.map((category) => {
    const matches = entries
      .map((text, index) => {
        if (!category.matches(text)) return undefined;
        if (!APP_EVIDENCE_ARTIFACT_OR_CHECK_PATTERN.test(text)) return undefined;
        if (!hasPlanDomainOrWorkflowDetail(text, contract)) return undefined;
        return index;
      })
      .filter((index) => index !== undefined);
    return { label: category.label, matches };
  });

  const missing = categoryMatches.find((category) => category.matches.length === 0);
  if (missing) {
    return `acceptance_evidence_plan missing concrete ${missing.label}`;
  }
  if (!hasUniqueEvidencePlanAssignment(categoryMatches)) {
    return "acceptance_evidence_plan must use separate category-specific entries with artifact/check language and product workflow detail";
  }

  return undefined;
}

function auditScenarioFlowEdgeCases(flows) {
  for (const [index, flow] of flows.entries()) {
    if (!Array.isArray(flow.failure_or_edge_cases) || flow.failure_or_edge_cases.length === 0) {
      return `scenario_flows[${index}] must include failure_or_edge_cases`;
    }
    for (const [edgeIndex, edgeCase] of flow.failure_or_edge_cases.entries()) {
      const text = normalizedText(edgeCase);
      if (typeof edgeCase !== "string" || text.length === 0) {
        return `scenario_flows[${index}].failure_or_edge_cases[${edgeIndex}] must be a non-empty string`;
      }
      if (WEAK_EDGE_CASE_PATTERNS.some((pattern) => pattern.test(text))) {
        return `scenario_flows[${index}].failure_or_edge_cases[${edgeIndex}] is not meaningful`;
      }
    }
    if (!FLOW_EDGE_CASE_DETAIL_PATTERN.test(normalizedText(flow.failure_or_edge_cases))) {
      return `scenario_flows[${index}].failure_or_edge_cases must include meaningful edge, state, or failure detail`;
    }
  }
  return undefined;
}

function isImplementationOnlyRequest(contract) {
  const text = normalizedText([
    contract.raw_user_request,
    contract.concrete_goal,
    contract.success_criteria,
    contract.completion_criteria,
    contract.scope_in,
    contract.scope_out,
  ]);
  return containsAny(text, IMPLEMENTATION_ONLY_PATTERNS) && containsAny(text, EXISTING_CODEBASE_CONTEXT_PATTERNS);
}

function hasGuardedUserFacingAppIntent(contract) {
  const text = normalizedText([
    contract.raw_user_request,
    contract.concrete_goal,
    contract.success_criteria,
    contract.scope_in,
    contract.verification_matrix,
    contract.acceptance_evidence_plan,
    contract.scenario_flows,
  ]);
  return (
    APP_CREATION_VERB_TARGET_REGEX.test(text) &&
    USER_FACING_CONTEXT_PATTERN.test(text) &&
    (APP_PRODUCT_RUNTIME_OR_UI_PATTERN.test(text) || APP_PRODUCT_INTERACTION_PATTERN.test(text))
  );
}

function hasAppProductImprovementIntent(contract) {
  const text = normalizedText([
    contract.raw_user_request,
    contract.concrete_goal,
    contract.success_criteria,
    contract.completion_criteria,
    contract.scope_in,
    contract.scope_out,
    contract.verification_matrix,
    contract.acceptance_evidence_plan,
    contract.scenario_flows,
  ]);
  const hasProductSurface = new RegExp(APP_PRODUCT_SURFACE_NOUN_PATTERN, "i").test(text);
  if (!hasProductSurface) return false;
  return STRONG_APP_PRODUCT_IMPROVEMENT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasAppProductCreationIntent(contract) {
  const text = normalizedText([
    contract.raw_user_request,
    contract.concrete_goal,
    contract.success_criteria,
    contract.completion_criteria,
    contract.scope_in,
    contract.verification_matrix,
    contract.acceptance_evidence_plan,
    contract.scenario_flows,
  ]);
  if (hasAppProductImprovementIntent(contract)) return true;

  const implementationOnly = isImplementationOnlyRequest(contract);
  if (implementationOnly) {
    const directIntentText = normalizedText([
      contract.raw_user_request,
      contract.concrete_goal,
      contract.success_criteria,
      contract.completion_criteria,
      contract.scope_in,
      contract.scenario_flows,
    ]);
    return STRONG_APP_CREATION_PATTERNS_WITHOUT_ADD.some((pattern) => pattern.test(directIntentText));
  }
  if (containsAny(text, STRONG_APP_CREATION_PATTERNS)) return true;
  if (hasGuardedUserFacingAppIntent(contract)) return true;

  const matchedSignals = WEAK_APP_PRODUCT_PATTERNS.filter((pattern) => pattern.test(text)).length;
  return matchedSignals >= 2;
}

function auditAppProductWorkTypeClassification(contract) {
  if (contract.work_type === "app_product") return undefined;
  if (hasAppProductCreationIntent(contract)) {
    return "likely app/site/game/tool/product creation or product-surface improvement intent must use work_type: app_product unless it is clearly only a bugfix, refactor, test, docs, config, or other implementation-only change to an existing codebase";
  }
  return undefined;
}

function auditAppProductGoalContract(contract) {
  if (contract.work_type !== "app_product") return undefined;

  const brief = contract.product_brief;
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) {
    return "app_product contracts require product_brief";
  }
  if (Object.hasOwn(brief, "state_model_assumptions")) {
    return "product_brief.state_model_assumptions is not schema-compatible; fold state assumptions into content_data_model_assumptions or evidence gates";
  }

  if (isGenericBriefText(contract.concrete_goal, 50)) {
    return "app_product concrete_goal must be specific to the product domain, users, and workflow";
  }

  const targetError = listHasSpecificEntries(brief.target_users, 1, "product_brief.target_users");
  if (targetError) return targetError;
  if (isGenericBriefText(brief.core_problem, 40)) {
    return "product_brief.core_problem must name a concrete user problem";
  }
  const workflowError = listHasSpecificEntries(brief.primary_workflows, 1, "product_brief.primary_workflows");
  if (workflowError) return workflowError;
  const domainError = listHasSpecificEntries(brief.domain_assumptions, 1, "product_brief.domain_assumptions");
  if (domainError) return domainError;
  const modelText = normalizedText(brief.content_data_model_assumptions);
  if (
    modelText.length < 80 ||
    !/\b(entity|entities|field|fields|record|records|relationship|status|state|empty|loading|error|validation|success|disabled)\b|(?:엔티티|필드|레코드|기록|관계|상태|빈|로딩|오류|에러|검증|유효성|성공|비활성)/iu.test(modelText)
  ) {
    return "product_brief.content_data_model_assumptions must cover concrete data entities/fields and state assumptions";
  }
  const nonGoalError = listHasSpecificEntries(brief.non_goals, 1, "product_brief.non_goals");
  if (nonGoalError) return nonGoalError;

  const appQualityGateError = auditAppQualityGates(contract);
  if (appQualityGateError) return appQualityGateError;

  const flows = contract.scenario_flows;
  if (!Array.isArray(flows) || flows.length < 2) {
    return "app_product scenario_flows must cover multiple primary, state, or edge flows";
  }
  const flowEdgeCaseError = auditScenarioFlowEdgeCases(flows);
  if (flowEdgeCaseError) return flowEdgeCaseError;

  const evidencePlanError = auditAcceptanceEvidencePlan(contract);
  if (evidencePlanError) return evidencePlanError;

  const broadQuestions = (contract.open_questions ?? []).filter((question) => {
    const text = normalizedText(question);
    return !/\b(security|regulated|payment|external cost|production|destructive|data loss|credential|secret|legal|irreversible)\b/i.test(text);
  });
  if (broadQuestions.length > 0) {
    return `open_questions contains non-blocker product questions: ${broadQuestions.join("; ")}`;
  }

  return undefined;
}

function auditGoalContractLogic(contract) {
  return auditAppProductWorkTypeClassification(contract) ?? auditAppProductGoalContract(contract);
}

function goalLogic(args) {
  const contractPath = option(args, "--contract");
  if (!contractPath) return usage();

  const contract = readJson(contractPath);
  const error = auditGoalContractLogic(contract);
  if (error) return fail(error);
  return ok("goal logic audit passed");
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

const SIMULATED_REVIEW_DISCLOSURE_PATTERN =
  /\b(simulated|same[-_\s]?context|not independent|non[-_\s]?independent|independent review (?:unavailable|not available|was unavailable)|no independent review|without independent review|independent reviewer unavailable|independence limitation)\b/i;
const INDEPENDENT_REVIEW_COMPLETION_CLAIM_PATTERN =
  /\bindependent review\s+(?:was\s+|is\s+|has been\s+)?(?:completed|complete|performed|finished|done|passed|accepted|verified|confirmed)\b/gi;

function claimsIndependentReviewCompletion(text) {
  for (const match of text.matchAll(INDEPENDENT_REVIEW_COMPLETION_CLAIM_PATTERN)) {
    const prefix = text.slice(Math.max(0, match.index - 24), match.index);
    if (!/\b(no|not|without)\s+$/i.test(prefix)) return true;
  }
  return false;
}

function auditSimulatedReviewDisclosure(report) {
  const text = riskText(report);
  if (claimsIndependentReviewCompletion(text)) {
    return "simulated_same_context review must not claim independent review completion";
  }
  if (!SIMULATED_REVIEW_DISCLOSURE_PATTERN.test(text)) {
    return "simulated_same_context review must disclose same-context or non-independent review limitation in risks_or_follow_up or similar";
  }
  return undefined;
}

function isGenericRubricEvidenceText(value) {
  const text = normalizedText(value);
  if (text.length === 0) return true;
  if (isGenericEvidenceText(text)) return true;
  return /^\s*(n\/?a|none|not applicable|tbd|same as above|see above)\s*\.?\s*$/i.test(text);
}

function auditRubricScore(report, { requireStrict = false } = {}) {
  const rubric = report.rubric_scores;
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) {
    return requireStrict ? "accepted review requires rubric_scores object" : undefined;
  }

  let sum = 0;
  if (requireStrict) {
    const unsupportedKeys = Object.keys(rubric).filter((key) => !RUBRIC_AXIS_KEYS.includes(key));
    if (unsupportedKeys.length > 0) {
      return `accepted review rubric_scores contains unsupported axis: ${unsupportedKeys.join(", ")}`;
    }
  }

  for (const key of RUBRIC_AXIS_KEYS) {
    const maxScore = RUBRIC_WEIGHTS[key];
    const item = rubric[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return requireStrict ? `accepted review requires rubric_scores.${key} object` : undefined;
    }
    if (item.max_score !== maxScore) {
      return requireStrict
        ? `accepted review requires rubric_scores.${key}.max_score ${maxScore}`
        : undefined;
    }
    if (!Number.isInteger(item.score)) {
      return requireStrict
        ? `accepted review requires rubric_scores.${key}.score integer between 0 and ${maxScore}`
        : undefined;
    }
    if (item.score < 0 || item.score > maxScore) {
      return requireStrict
        ? `accepted review requires rubric_scores.${key}.score integer between 0 and ${maxScore}`
        : undefined;
    }
    if (requireStrict && (typeof item.evidence !== "string" || isGenericRubricEvidenceText(item.evidence))) {
      return `accepted review requires non-generic rubric_scores.${key}.evidence`;
    }
    sum += item.score;
  }

  if (sum !== report.overall_completion_score) {
    return `overall_completion_score ${report.overall_completion_score} does not match rubric score sum ${sum}`;
  }
  return undefined;
}

function commandAuditMatchesKey(entry, key) {
  if (!entry || typeof entry !== "object" || entry.exit_code !== 0) return false;
  const text = normalizedText([entry.command, entry.purpose, entry.output_summary]);
  const patterns = {
    build: /\b(build|bundle|compile)\b/i,
    lint: /\b(lint|eslint|biome|stylelint|static check)\b/i,
    test: /\b(test|vitest|jest|playwright|pytest|cargo test|go test|dotnet test)\b/i,
  };
  return patterns[key]?.test(text) === true;
}

function commandCheckDocumentsNoAvailableCommand(check) {
  const text = normalizedText(check);
  const noRunnableWithAvailability =
    /\b(no|missing|not available|unavailable|not present|does not have|doesn't have|no configured|not configured|could not find|not found|does not exist|doesn't exist|absent)\b[\s\S]{0,80}\b(command|script|harness|check|build|lint|test|runner|verification)\b/i;
  const runnableWithUnavailable =
    /\b(command|script|harness|check|build|lint|test|runner|verification)\b[\s\S]{0,80}\b(missing|not available|unavailable|not present|not found|not configured|does not exist|doesn't exist|absent|none)\b/i;
  const noSpecificRunnable =
    /\bno\b[\s\S]{0,80}\b(build|lint|test)\b[\s\S]{0,80}\b(exists?|available|present|configured|found|defined|script|command|harness|check)\b/i;
  const withoutRunnableNoun =
    /\bwithout\b[\s\S]{0,60}\b((build|lint|test)\s+)?(command|script|harness|check)\b/i;
  return (
    noRunnableWithAvailability.test(text) ||
    runnableWithUnavailable.test(text) ||
    noSpecificRunnable.test(text) ||
    withoutRunnableNoun.test(text)
  );
}

function commandCheckDocumentsNoCommand(check) {
  const text = normalizedText(check);
  const unavailableThenRunnable =
    /\b(no|missing|not available|unavailable|not present|does not have|doesn't have|no configured|not configured|could not find|not found|does not exist|doesn't exist|absent)\b[\s\S]{0,50}\b(command|script|harness|check|build|lint|test|runner|verification)\b/i;
  const runnableThenUnavailable =
    /\b(command|script|harness|check|build|lint|test|runner|verification)\b[\s\S]{0,50}\b(missing|not available|unavailable|not present|not found|not configured|does not exist|doesn't exist|absent)\b/i;
  const runnableNotRun =
    /\b(command|script|harness|check|build|lint|test|runner|verification)\b[\s\S]{0,50}\b(not run|not executed|was not run|were not run|was not executed|were not executed|skipped|could not run|unable to run)\b/i;
  return commandCheckDocumentsNoAvailableCommand(check) || unavailableThenRunnable.test(text) || runnableThenUnavailable.test(text) || runnableNotRun.test(text);
}

function auditCheckObject(label, check, { rejectPassedUnavailable = false } = {}) {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    return `${label} must be an object`;
  }
  if (typeof check.status !== "string") {
    return `${label} must include status`;
  }
  if (!VALID_CHECK_STATUSES.has(check.status)) {
    return `${label} has unsupported status: ${check.status}`;
  }
  if (!hasEvidence(check)) {
    return `${label} must include non-empty concrete evidence`;
  }
  if (isGenericEvidenceText(checkEvidenceText(check))) {
    return `${label} must include concrete evidence`;
  }
  if (rejectPassedUnavailable && check.status === "passed" && commandCheckDocumentsNoCommand(check)) {
    return `${label} cannot be passed when evidence says no command, check, script, or harness was available or run`;
  }
  return undefined;
}

function auditPresentReviewCheckObjects(report, options = {}) {
  for (const groupKey of ["verification_check", "app_quality_check"]) {
    const group = report[groupKey];
    if (group === undefined) continue;
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      return `${groupKey} must be an object`;
    }
    for (const [key, check] of Object.entries(group)) {
      if (key === "evidence") continue;
      if (!check || typeof check !== "object" || Array.isArray(check)) {
        return `${groupKey}.${key} must be an object`;
      }
      const error = auditCheckObject(`${groupKey}.${key}`, check, options);
      if (error) return error;
    }
  }

  for (const key of ACCEPTED_TOP_LEVEL_CHECK_KEYS) {
    const check = report[key];
    if (check === undefined) continue;
    const error = auditCheckObject(key, check, options);
    if (error) return error;
  }

  return undefined;
}

function auditAcceptedRequiredReviewChecks(report, { isAppProduct = false } = {}) {
  if (!report.verification_check || typeof report.verification_check !== "object" || Array.isArray(report.verification_check)) {
    return "accepted status requires verification_check object";
  }
  for (const key of REQUIRED_VERIFICATION_CHECK_KEYS) {
    const check = report.verification_check[key];
    const error = auditCheckObject(`verification_check.${key}`, check, {
      rejectPassedUnavailable: true,
    });
    if (error) return error;
    if (
      COMMAND_BASED_VERIFICATION_KEYS.includes(key) &&
      check.status === "not_applicable" &&
      !commandCheckDocumentsNoAvailableCommand(check)
    ) {
      return `accepted status allows verification_check.${key} not_applicable only when evidence says no command, script, check, or harness exists`;
    }
    if (isAppProduct && APP_RUNTIME_VERIFICATION_KEYS.includes(key) && check.status !== "passed") {
      return `accepted app_product status requires passed verification_check.${key}`;
    }
  }

  for (const key of ACCEPTED_TOP_LEVEL_CHECK_KEYS) {
    const check = report[key];
    const error = auditCheckObject(key, check, { rejectPassedUnavailable: true });
    if (error) return error;
    if (check.status !== "passed") {
      return `accepted status requires ${key} to be passed`;
    }
  }

  if (isAppProduct) {
    const behaviorText = checkEvidenceText(report.verification_check.behavior_check);
    if (!hasConcreteBehaviorEvidenceText(behaviorText)) {
      return "accepted app_product verification_check.behavior_check requires workflow/action terms and observed-result evidence";
    }
    const accessibilityText = checkEvidenceText(report.app_quality_check?.accessibility_basics);
    if (!hasAccessibilityEvidenceText(accessibilityText)) {
      return "accepted app_product app_quality_check.accessibility_basics requires accessibility-specific evidence";
    }
  }

  return undefined;
}

function auditAcceptedCommandAudit(report) {
  const commandAudit = report.command_audit;
  if (!Array.isArray(commandAudit)) return "command_audit must be an array";

  for (const key of COMMAND_BASED_VERIFICATION_KEYS) {
    const check = report.verification_check?.[key];
    if (!check || check.status !== "passed" || commandCheckDocumentsNoCommand(check)) continue;
    const hasCommand = commandAudit.some((entry) => commandAuditMatchesKey(entry, key));
    if (!hasCommand) {
      return `accepted status requires command_audit entry with exit_code 0 for passed ${key} check`;
    }
  }

  return undefined;
}

function appEvidenceCoverage(report, { forceAppProduct = false } = {}) {
  if (!forceAppProduct && report.work_type !== "app_product") return { error: undefined, coverage: undefined };
  const appQuality = report.app_quality_check;
  if (!appQuality || typeof appQuality !== "object" || !Array.isArray(appQuality.evidence)) {
    return { error: "app_product review requires app_quality_check.evidence array", coverage: undefined };
  }

  const evidenceEntries = appQualityEvidenceEntries(appQuality);
  if (evidenceEntries.length < 5) {
    return { error: "app_product review requires at least five concrete evidence entries", coverage: undefined };
  }

  const coverage = {
    desktop: false,
    mobile: false,
    behavior: false,
    accessibility: false,
    state: false,
  };
  const generic = [];

  for (const [index, evidence] of evidenceEntries.entries()) {
    const type = String(evidence.type ?? "");
    const text = normalizedText(evidence);
    if (!VALID_APP_EVIDENCE_TYPES.has(type)) {
      return { error: `app_quality_check.evidence[${index}] has unsupported type: ${type}`, coverage };
    }
    if (evidence.status !== "passed") {
      return { error: `app_quality_check.evidence[${index}] must be passed`, coverage };
    }
    if (!hasConcreteAppEvidenceText(evidence.description)) generic.push(index);

    if (type === "screenshot" && DESKTOP_VISUAL_EVIDENCE_PATTERN.test(text)) coverage.desktop = true;
    if (type === "screenshot" && MOBILE_VISUAL_EVIDENCE_PATTERN.test(text)) coverage.mobile = true;
    if (type === "responsive_check" && DESKTOP_VISUAL_EVIDENCE_PATTERN.test(text)) coverage.desktop = true;
    if (type === "responsive_check" && MOBILE_VISUAL_EVIDENCE_PATTERN.test(text)) coverage.mobile = true;
    if (
      ["manual_behavior_check", "automated_test"].includes(type) &&
      APP_WORKFLOW_CONTEXT_PATTERN.test(text) &&
      hasConcreteBehaviorEvidenceText(text)
    ) {
      coverage.behavior = true;
    }
    if (type === "accessibility_check" && hasConcreteAccessibilityEvidenceText(text)) {
      coverage.accessibility = true;
    }
    if (
      ["manual_behavior_check", "automated_test"].includes(type) &&
      hasConcreteStateEvidenceText(text)
    ) {
      coverage.state = true;
    } else if (type !== "screenshot" && hasConcreteStateEvidenceText(text)) {
      coverage.state = true;
    }
  }

  if (generic.length > 0) {
    return { error: `app_quality_check.evidence has generic or placeholder evidence at index ${generic[0]}`, coverage };
  }

  const appQualityText = normalizedText(appQuality);
  if (/\b(lorem ipsum|placeholder[-\s]?only|only placeholder|placeholder ui|dummy ui)\b/i.test(appQualityText)) {
    return { error: "app_quality_check evidence describes placeholder or lorem-only UI", coverage };
  }

  for (const key of APP_QUALITY_CHECK_KEYS) {
    const check = appQuality[key];
    if (!check || check.status !== "passed" || !hasConcreteAppEvidenceText(check.evidence)) {
      return { error: `app_quality_check.${key} requires passed concrete evidence`, coverage };
    }
    if (key === "accessibility_basics" && !hasAccessibilityEvidenceText(check.evidence)) {
      return { error: "app_quality_check.accessibility_basics requires accessibility-specific evidence", coverage };
    }
    if (key === "domain_fit" && !hasConcreteDomainEvidence(check.evidence)) {
      return { error: "app_quality_check.domain_fit requires concrete domain vocabulary evidence", coverage };
    }
  }

  const missing = Object.entries(coverage)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  if (missing.length > 0) {
    return { error: `app evidence missing required coverage: ${missing.join(", ")}`, coverage };
  }

  return { error: undefined, coverage };
}

function appEvidence(args) {
  const reviewPath = option(args, "--review");
  if (!reviewPath) return usage();

  const report = readJson(reviewPath);
  const { error } = appEvidenceCoverage(report);
  if (error) return fail(error);
  return ok("app evidence audit passed");
}

function reviewLogic(args) {
  const reportPath = option(args, "--report");
  if (!reportPath) return usage();

  const report = readJson(reportPath);
  const contractPath = option(args, "--contract");
  const contract = contractPath ? readJson(contractPath) : undefined;
  const gates = report.blocking_gates ?? [];
  const rework = report.rework_items ?? [];
  const scenarioFlowScores = report.scenario_flow_scores;
  const appQuality = report.app_quality_check;
  const isAppProduct = report.work_type === "app_product" || contract?.work_type === "app_product";
  const requirePassedAppQuality =
    isAppProduct &&
    (report.status === "accepted" || report.recommendation === "accepted" || report.passed_threshold === true);

  if (!Number.isInteger(report.overall_completion_score) || !Number.isInteger(report.score_threshold)) {
    return fail("overall_completion_score and score_threshold must be integers");
  }
  if (report.overall_completion_score < 0 || report.overall_completion_score > 100) {
    return fail("overall_completion_score must be between 0 and 100");
  }
  if (report.score_threshold < 85 || report.score_threshold > 100) {
    return fail("score_threshold must be an integer between 85 and 100");
  }
  if (!VALID_WORK_TYPES.has(report.work_type)) return fail("work_type must be present and valid");
  if (contract && !VALID_WORK_TYPES.has(contract.work_type)) return fail("contract.work_type must be present and valid");
  if (contract && report.work_type !== contract.work_type) {
    return fail(`report.work_type (${report.work_type}) must match contract.work_type (${contract.work_type})`);
  }
  if (contract) {
    const contractGoalLogicError = auditGoalContractLogic(contract);
    if (contractGoalLogicError) return fail(`contract goal logic failed: ${contractGoalLogicError}`);
  }
  if (!VALID_REVIEW_STATUSES.has(report.status)) return fail("status must be present and valid");
  if (!VALID_RECOMMENDATIONS.has(report.recommendation)) return fail("recommendation must be present and valid");
  if ((report.status === "accepted" || report.recommendation === "accepted") && !contractPath) {
    return fail("accepted review requires --contract <goal.json>");
  }
  if (!VALID_REVIEW_INDEPENDENCE.has(report.independence)) return fail("independence must be present and valid");
  if (report.independence === "simulated_same_context") {
    const simulatedDisclosureError = auditSimulatedReviewDisclosure(report);
    if (simulatedDisclosureError) return fail(simulatedDisclosureError);
  }
  if (typeof report.passed_threshold !== "boolean") return fail("passed_threshold must be boolean");
  if (!Array.isArray(gates)) return fail("blocking_gates must be a list");

  if (report.recommendation === "accepted") {
    if (report.status !== "accepted") return fail("accepted recommendation requires accepted status");
    if (report.passed_threshold !== true) return fail("accepted recommendation requires passed_threshold true");
    if (gates.length > 0) return fail("accepted recommendation requires empty blocking_gates");
    if (report.overall_completion_score < 85) {
      return fail("accepted recommendation requires overall_completion_score >= 85");
    }
    if (report.overall_completion_score < report.score_threshold) {
      return fail("accepted recommendation requires score >= threshold");
    }
  }

  if (!Array.isArray(rework)) return fail("rework_items must be a list");
  if (!appQuality || typeof appQuality !== "object" || Array.isArray(appQuality)) {
    return fail("app_quality_check must be present");
  }

  const appQualityEntries = checkEntries(appQuality);
  if (appQualityEntries.length === 0) return fail("app_quality_check must contain status items");

  const reviewCheckError = auditPresentReviewCheckObjects(report, {
    rejectPassedUnavailable: report.status === "accepted",
  });
  if (reviewCheckError) return fail(reviewCheckError);

  const rubricError = auditRubricScore(report, {
    requireStrict: report.status === "accepted" || report.recommendation === "accepted",
  });
  if (rubricError) return fail(rubricError);

  const scenarioFlowError = auditScenarioFlowScores(scenarioFlowScores);
  if (scenarioFlowError) return fail(scenarioFlowError);

  if (contract) {
    const contractScenarioFlowError = auditContractScenarioFlowCoverage(report, contract);
    if (contractScenarioFlowError) return fail(contractScenarioFlowError);
  }

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
    if (report.overall_completion_score < 85) {
      return fail("accepted status requires overall_completion_score >= 85");
    }
    if (report.overall_completion_score < report.score_threshold) {
      return fail("accepted status requires score >= threshold");
    }
    const acceptedCheckError = auditAcceptedRequiredReviewChecks(report, { isAppProduct });
    if (acceptedCheckError) return fail(acceptedCheckError);
    for (const [key, check] of checkEntries(report.verification_check)) {
      if (["failed", "not_run"].includes(check.status)) {
        return fail(`accepted status cannot include ${check.status} verification check: ${key}`);
      }
    }
    for (const [key, check] of appQualityEntries.filter(([, check]) => ["failed", "not_run"].includes(check.status))) {
      return fail(`accepted status cannot include ${check.status} app_quality_check: ${key}`);
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
      const { error: appEvidenceError } = appEvidenceCoverage(report, { forceAppProduct: isAppProduct });
      if (appEvidenceError) return fail(appEvidenceError);
    }
    for (const key of ACCEPTED_TOP_LEVEL_CHECK_KEYS) {
      const check = report[key];
      if (check && typeof check === "object" && ["failed", "not_run"].includes(check.status)) {
        return fail(`accepted status cannot include ${check.status} ${key}`);
      }
    }
    const commandAuditError = auditAcceptedCommandAudit(report);
    if (commandAuditError) return fail(commandAuditError);
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

function checkResultEntriesFromReport(report) {
  const entries = [];
  for (const groupKey of ["verification_check", "app_quality_check"]) {
    for (const [key, check] of checkEntries(report[groupKey])) {
      entries.push({ groupKey, key, check });
    }
  }
  for (const key of ["security_check", "secret_scan_result", "scope_diff_result", "scope_check", "goal_contract_check"]) {
    const check = report[key];
    if (check && typeof check === "object" && typeof check.status === "string") {
      entries.push({ groupKey: "top_level", key, check });
    }
  }
  return entries;
}

const RUNNABLE_ACCESS_CONTEXT_PATTERN =
  /\b(runnable|run|running|open|opened|serve|served|server|dev server|preview|url|link|localhost|static|artifact|access|launch|visit)\b/i;
const CONCRETE_RUNNABLE_URL_PATTERN =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9.-]+)(?::\d{2,5})?(?:[/?#][^\s"'<>)]*)?/i;
const CONCRETE_LOCALHOST_PATTERN = /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d{2,5}\b/i;
const STATIC_HTML_PATH_PATTERN =
  /(?:^|[\s`"'])(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|\/|[\w.-]+[\\/])[\w .\\/()[\]-]+\.html\b/i;
const RUNNABLE_COMMAND_PATTERN =
  /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|preview|serve)\b|\bpython\s+-m\s+http\.server\b|\bnpx\s+(?:vite|serve|http-server)\b|\bvite\s+(?:--host|--open|preview)?\b/i;

function hasRunnableAccessDisclosure(summaryText) {
  const text = normalizedText(summaryText);
  const hasTarget =
    CONCRETE_RUNNABLE_URL_PATTERN.test(text) ||
    CONCRETE_LOCALHOST_PATTERN.test(text) ||
    STATIC_HTML_PATH_PATTERN.test(text);
  if (!hasTarget) return false;
  return RUNNABLE_ACCESS_CONTEXT_PATTERN.test(text) || RUNNABLE_COMMAND_PATTERN.test(text);
}

function summaryLogic(args) {
  const summaryPath = option(args, "--summary");
  const reviewPath = option(args, "--review");
  if (!summaryPath || !reviewPath) return usage();

  const summary = readJson(summaryPath);
  const review = readJson(reviewPath);
  const missingSummaryKeys = REQUIRED_SUMMARY_KEYS.filter((key) => {
    return !Array.isArray(summary[key]) || summary[key].length === 0;
  });
  if (missingSummaryKeys.length > 0) {
    const keys = Object.keys(summary);
    const hasMojibakeKeys = keys.some((key) => MOJIBAKE_SUMMARY_KEY_PATTERNS.some((pattern) => pattern.test(key)));
    if (hasMojibakeKeys) {
      return fail("summary must use Korean keys 명령, 수행 사전 작업, 수행 내용, 수행 결과; mojibake keys are not accepted");
    }
    return fail(`summary missing required Korean keys: ${missingSummaryKeys.join(", ")}`);
  }
  const text = normalizedText(summary);
  const reviewAccepted =
    review.status === "accepted" && review.recommendation === "accepted" && review.passed_threshold === true;
  const acceptedAppProduct = reviewAccepted && review.work_type === "app_product";

  if (!reviewAccepted) {
    if (summary.status === "completed") return fail("summary cannot mark completed when linked review is not accepted");
    if (!/\b(needs_rework|rejected|blocked|not accepted|blocking gate|failed)\b/i.test(text)) {
      return fail("summary must disclose non-accepted review status");
    }
  } else if (acceptedAppProduct && !hasRunnableAccessDisclosure(text)) {
    return fail("accepted app_product summary must disclose runnable access with a concrete URL, localhost address, static HTML path, preview URL, or command plus target");
  }

  const hiddenChecks = checkResultEntriesFromReport(review).filter(({ check }) => {
    return ["failed", "not_run"].includes(check.status);
  });
  if (hiddenChecks.length > 0 && !/\b(failed|not_run|not run|unverified|not verified|unable|blocked)\b/i.test(text)) {
    return fail("summary must disclose failed or unrun checks");
  }

  if (review.independence === "simulated_same_context") {
    if (!/\b(simulated|same[-\s]?context|not independent|independent review unavailable|limitation)\b/i.test(text)) {
      return fail("summary must disclose simulated_same_context review limitation");
    }
  }

  return ok("summary logic audit passed");
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

const ROOT_RUNNER_HELPER_PATH = "skills/local-project-harness/scripts/harness_checks.mjs";
const SKILL_RUNNER_HELPER_PATH = "scripts/harness_checks.mjs";
const ROOT_HARNESS_README_COPY_PATH = "skills/local-project-harness/references/harness-readme.md";
const SKILL_HARNESS_README_COPY_PATH = "references/harness-readme.md";
const ROOT_ONLY_HELPER_AUDIT_COMMANDS = new Set([
  `node ${SKILL_RUNNER_HELPER_PATH} runner-policy-sync`,
  `node ${SKILL_RUNNER_HELPER_PATH} sync-check --source README.md --copy ${SKILL_HARNESS_README_COPY_PATH}`,
]);

function normalizeRunnerPolicySchemas(policy, { label, expectedPrefix }) {
  const normalized = JSON.parse(JSON.stringify(policy));
  const schemas = normalized?.schema_validation?.schemas;
  if (!schemas || typeof schemas !== "object" || Array.isArray(schemas)) {
    throw new Error(`${label} runner policy missing schema_validation.schemas map`);
  }

  for (const [name, schemaPath] of Object.entries(schemas)) {
    if (typeof schemaPath !== "string") {
      throw new Error(`${label} schema_validation.schemas.${name} must be a string`);
    }
    const normalizedPath = schemaPath.replaceAll("\\", "/");
    const expectedPattern = new RegExp(`^${expectedPrefix.replace("/", "\\/")}([A-Za-z0-9_-]+\\.schema\\.json)$`);
    const match = normalizedPath.match(expectedPattern);
    if (!match) {
      throw new Error(
        `${label} schema_validation.schemas.${name} must use ${expectedPrefix}<name>.schema.json: ${schemaPath}`,
      );
    }
    const expectedFileName = `${name}.schema.json`;
    if (match[1] !== expectedFileName) {
      throw new Error(
        `${label} schema_validation.schemas.${name} must reference ${expectedPrefix}${expectedFileName}: ${schemaPath}`,
      );
    }
    schemas[name] = `schemas/${match[1]}`;
  }

  return normalized;
}

function normalizePolicyPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function normalizeRunnerPolicyHelperPaths(
  policy,
  { label, expectedHelperPath, expectedHarnessReadmeCopyPath, allowRootOnlyHelperOmissions = false },
) {
  const normalized = JSON.parse(JSON.stringify(policy));
  const auditHelper = normalized?.policy?.audit_helper;
  if (typeof auditHelper !== "string") {
    throw new Error(`${label} runner policy missing policy.audit_helper`);
  }
  if (normalizePolicyPath(auditHelper) !== expectedHelperPath) {
    throw new Error(`${label} policy.audit_helper must use ${expectedHelperPath}: ${auditHelper}`);
  }
  normalized.policy.audit_helper = SKILL_RUNNER_HELPER_PATH;

  const helperCommands = normalized?.commands?.helper_audit;
  if (!Array.isArray(helperCommands)) {
    throw new Error(`${label} runner policy missing commands.helper_audit list`);
  }
  for (const [index, command] of helperCommands.entries()) {
    if (typeof command !== "string") {
      throw new Error(`${label} commands.helper_audit[${index}] must be a string`);
    }
    const normalizedCommand = command.replaceAll("\\", "/");
    if (/harness_checks\.mjs/.test(normalizedCommand) && !normalizedCommand.includes(expectedHelperPath)) {
      throw new Error(`${label} commands.helper_audit[${index}] must use ${expectedHelperPath}: ${command}`);
    }
    helperCommands[index] = normalizedCommand
      .replaceAll(expectedHelperPath, SKILL_RUNNER_HELPER_PATH)
      .replaceAll(expectedHarnessReadmeCopyPath, SKILL_HARNESS_README_COPY_PATH);
    if (!allowRootOnlyHelperOmissions && ROOT_ONLY_HELPER_AUDIT_COMMANDS.has(helperCommands[index])) {
      throw new Error(
        `${label} commands.helper_audit[${index}] lists repo-root maintenance helper not usable from an installed skill: ${command}`,
      );
    }
  }

  if (allowRootOnlyHelperOmissions) {
    normalized.commands.helper_audit = helperCommands.filter((command) => {
      return !ROOT_ONLY_HELPER_AUDIT_COMMANDS.has(command);
    });
  }

  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function valueSummary(value) {
  if (value === undefined) return "<missing>";
  return JSON.stringify(value);
}

function firstValueDiff(left, right, pathLabel = "$") {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return pathLabel;
    if (left.length !== right.length) return `${pathLabel}.length`;
    for (let index = 0; index < left.length; index += 1) {
      const diff = firstValueDiff(left[index], right[index], `${pathLabel}[${index}]`);
      if (diff) return diff;
    }
    return undefined;
  }
  if (left && typeof left === "object" && right && typeof right === "object") {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) return `${pathLabel}.${key}`;
      const diff = firstValueDiff(left[key], right[key], `${pathLabel}.${key}`);
      if (diff) return diff;
    }
    return undefined;
  }
  return Object.is(left, right) ? undefined : pathLabel;
}

function valueAtPath(value, pathLabel) {
  const parts = pathLabel
    .replace(/^\$\./, "")
    .replace(/^\$/, "")
    .split(".")
    .filter(Boolean);
  let current = value;
  for (const part of parts) {
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current?.[arrayMatch[1]]?.[Number.parseInt(arrayMatch[2], 10)];
    } else if (part === "length" && Array.isArray(current)) {
      current = current.length;
    } else {
      current = current?.[part];
    }
  }
  return current;
}

function runnerPolicySync(args) {
  const rootPath = option(args, "--root") ?? "harness/runner_policy.yaml";
  const skillPath =
    option(args, "--skill") ?? "skills/local-project-harness/references/policies/runner_policy.yaml";

  const rootPolicy = parseYamlSubset(readText(rootPath), rootPath);
  const skillPolicy = parseYamlSubset(readText(skillPath), skillPath);
  const rootComparable = stableValue(
    normalizeRunnerPolicyHelperPaths(
      normalizeRunnerPolicySchemas(rootPolicy, { label: "root", expectedPrefix: "schemas/" }),
      {
        label: "root",
        expectedHelperPath: ROOT_RUNNER_HELPER_PATH,
        expectedHarnessReadmeCopyPath: ROOT_HARNESS_README_COPY_PATH,
        allowRootOnlyHelperOmissions: true,
      },
    ),
  );
  const skillComparable = stableValue(
    normalizeRunnerPolicyHelperPaths(
      normalizeRunnerPolicySchemas(skillPolicy, { label: "skill", expectedPrefix: "references/schemas/" }),
      {
        label: "skill",
        expectedHelperPath: SKILL_RUNNER_HELPER_PATH,
        expectedHarnessReadmeCopyPath: SKILL_HARNESS_README_COPY_PATH,
      },
    ),
  );
  const diffPath = firstValueDiff(rootComparable, skillComparable);
  if (diffPath) {
    return fail(
      `runner policy drift detected at ${diffPath}: root=${valueSummary(valueAtPath(rootComparable, diffPath))} skill=${valueSummary(valueAtPath(skillComparable, diffPath))}`,
    );
  }
  return ok("runner policy sync check passed");
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
      case "goal-logic":
        return goalLogic(args);
      case "review-logic":
        return reviewLogic(args);
      case "app-evidence":
        return appEvidence(args);
      case "summary-logic":
        return summaryLogic(args);
      case "runner-policy-sync":
        return runnerPolicySync(args);
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
