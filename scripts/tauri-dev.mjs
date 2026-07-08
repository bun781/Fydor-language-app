import { spawn } from "node:child_process";
import net from "node:net";

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });
}

function findAvailablePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Unable to allocate a development server port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

const port = await findAvailablePort();
const devUrl = `http://127.0.0.1:${port}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const tauriConfig = JSON.stringify({
  build: {
    beforeDevCommand: "",
    devUrl
  }
});

console.log(`Starting Vite dev server on ${devUrl}`);

const devServer = run(npmCommand, ["exec", "vite", "--", "--port", String(port), "--host", "127.0.0.1", "--strictPort"]);

let tauri = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (tauri && !tauri.killed) tauri.kill();
  if (!devServer.killed) devServer.kill();
  process.exit(code);
}

devServer.once("exit", (code) => {
  if (!shuttingDown) {
    console.error(`Vite dev server exited with code ${code ?? "unknown"}.`);
    shutdown(code ?? 1);
  }
});

tauri = run(npmCommand, ["exec", "tauri", "--", "dev", "--config", tauriConfig]);

tauri.once("exit", (code) => {
  shutdown(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => shutdown(0));
}
