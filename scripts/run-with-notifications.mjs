import { spawn } from "node:child_process";

import { sendCommandNotification } from "./notify-command-complete.mjs";

const DEFAULT_AFTER_MS = 5 * 60 * 1000;
const command = process.argv.slice(2);
const afterMs = Number.parseInt(process.env.COMMAND_NOTIFICATION_AFTER_MS ?? "", 10) || DEFAULT_AFTER_MS;

if (command.length === 0) {
  console.error("Usage: npm run notify:command -- <command> [arguments]");
  process.exit(1);
}

let longRunningAlertSent = false;
const timer = setTimeout(() => {
  longRunningAlertSent = true;
  void sendCommandNotification("Your requested command is still running after five minutes.", "Codex command still running").catch(() => {
    console.error("Could not send the five-minute notification.");
  });
}, afterMs);

const child = spawn(command[0], command.slice(1), { stdio: "inherit" });
child.once("error", async () => {
  clearTimeout(timer);
  await sendCommandNotification("Your requested command could not start.", "Codex command failed");
  process.exit(1);
});
child.once("exit", async (code, signal) => {
  clearTimeout(timer);
  const outcome = code === 0 ? "finished successfully" : "finished with an error";
  const detail = longRunningAlertSent ? " A five-minute status alert was sent." : "";
  await sendCommandNotification(`Your requested command ${outcome}.${detail}`, code === 0 ? "Codex command complete" : "Codex command failed");
  process.exit(code ?? (signal ? 1 : 0));
});
