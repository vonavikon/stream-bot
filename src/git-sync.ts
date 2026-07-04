import { execFileSync } from "node:child_process";

function git(args: string[], repoPath: string): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    stdio: "pipe",
    timeout: 30_000,
  }).toString();
}

export function gitPull(repoPath: string): void {
  git(["fetch", "origin"], repoPath);
  git(["reset", "--hard", "origin/main"], repoPath);
}

export function gitCommitAndPush(repoPath: string, message: string): void {
  const safeMessage = message.replace(/[\n"']/g, " ").slice(0, 200);
  git(["add", "-A"], repoPath);
  git(["commit", "-m", safeMessage, "--allow-empty"], repoPath);
  git(["push"], repoPath);
}
