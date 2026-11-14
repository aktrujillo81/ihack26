import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const DEFAULT_MESSAGE = "Your requested command has finished.";

function localNotification(title, message) {
  if (process.platform !== "darwin") return Promise.resolve();
  return new Promise((resolve) => {
    const child = spawn("osascript", ["-e", `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`], {
      stdio: "ignore",
    });
    child.once("error", resolve);
    child.once("exit", resolve);
  });
}

async function localEnv() {
  const contents = await readFile(".env.local", "utf8");
  const variables = new Map();
  for (const line of contents.split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) variables.set(match[1], match[2].trim());
  }
  return variables;
}

async function pushoverNotification(title, message) {
  const variables = await localEnv();
  const token = variables.get("PUSHOVER_APP_TOKEN");
  const user = variables.get("PUSHOVER_USER_KEY");
  if (!token || !user) throw new Error("Pushover keys are missing from .env.local");

  const body = new URLSearchParams({ token, user, title, message });
  const response = await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body });
  if (!response.ok) throw new Error(`Pushover rejected the notification (HTTP ${response.status})`);
}

export async function sendCommandNotification(message, title = "Codex command complete") {
  await localNotification(title, message);
  await pushoverNotification(title, message);
}

const message = process.argv.slice(2).join(" ").trim() || DEFAULT_MESSAGE;
if (process.argv[1]?.endsWith("notify-command-complete.mjs")) {
  await sendCommandNotification(message);
  console.log("Command-complete notifications sent.");
}
