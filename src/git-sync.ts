import { execFileSync } from "node:child_process";

function git(args: string[], repoPath: string): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    stdio: "pipe",
    timeout: 30_000,
  }).toString();
}

/** Блокирующая пауза без busy-wait: Atomics.wait доступен на главном потоке Node. */
function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Сетевые git-команды (fetch/push) ретраим: GitHub изредка отдаёт HTTP 500 на fetch. */
function gitNetwork(args: string[], repoPath: string, attempts = 3): string {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return git(args, repoPath);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        console.error(`[git] retry ${i + 1}/${attempts - 1} after: ${(e as Error).message}`);
        sleepMs(1000 * (i + 1));
      }
    }
  }
  throw lastErr;
}

export function gitPull(repoPath: string): void {
  gitNetwork(["fetch", "origin"], repoPath);
  git(["reset", "--hard", "origin/main"], repoPath);
}

export function gitCommitAndPush(repoPath: string, message: string): void {
  const safeMessage = message.replace(/[\n"']/g, " ").slice(0, 200);
  git(["add", "-A"], repoPath);
  git(["commit", "-m", safeMessage, "--allow-empty"], repoPath);
  gitNetwork(["push"], repoPath);
}
