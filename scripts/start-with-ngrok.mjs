import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const settings = parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"));
  for (const key of ["IEMS_PORT", "IEMS_DEV_PORT", "IEMS_ENV_FILE", "IEMS_NGROK_URL"]) {
    if (process.env[key] === undefined && settings[key] !== undefined) process.env[key] = settings[key];
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
const development = process.argv.includes("--dev");
const port = Number(process.env[development ? "IEMS_DEV_PORT" : "IEMS_PORT"] || (development ? 3003 : 3002));
const agent = "http://127.0.0.1:4040/api";
let child;
let stopping = false;

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const task = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    task.once("error", reject);
    task.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed (${signal || code}).`)));
  });
}

async function endpoints() {
  try {
    const response = await fetch(`${agent}/endpoints`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`ngrok agent returned HTTP ${response.status}`);
    return (await response.json()).endpoints;
  } catch (error) {
    if (error.cause?.code === "ECONNREFUSED" || error.name === "TimeoutError") return null;
    throw error;
  }
}

function localPort(endpoint) {
  try {
    const url = new URL(endpoint.upstream?.url);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? Number(url.port) : null;
  } catch { return null; }
}

async function tunnel() {
  let active = await endpoints();
  if (active === null) {
    child = spawn("ngrok", ["http", `http://localhost:${port}`, "--log", "stdout", "--log-format", "json", ...(process.env.IEMS_NGROK_URL ? ["--url", process.env.IEMS_NGROK_URL] : [])], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let failure;
    child.once("error", (error) => { failure = error; });
    child.stdout.on("data", (buffer) => {
      for (const line of buffer.toString().trim().split("\n")) {
        try {
          const message = JSON.parse(line);
          if (message.lvl === "error" || message.lvl === "eror" || message.lvl === "warn") console.error(message.msg, message.err || "");
        } catch { console.error(line); }
      }
    });
    child.stderr.pipe(process.stderr);
    for (let attempt = 0; attempt < 60; attempt++) {
      if (failure) throw failure;
      if (child.exitCode !== null) throw new Error("ngrok stopped. Check `ngrok config check` and your ngrok account credentials.");
      active = await endpoints();
      if (active?.some((endpoint) => localPort(endpoint) === port && endpoint.url?.startsWith("https://"))) break;
      await delay(1000);
    }
  }
  const exact = active?.find((endpoint) => localPort(endpoint) === port && endpoint.url?.startsWith("https://"));
  if (exact) return exact.url;

  // One public URL switches between this project's development and production containers.
  const existing = active?.find((endpoint) => [Number(process.env.IEMS_PORT || 3002), Number(process.env.IEMS_DEV_PORT || 3003)].includes(localPort(endpoint)) && endpoint.url?.startsWith("https://"));
  if (!existing || existing.traffic_policy) throw new Error("ngrok is already running for another service. Stop it or use a separate ngrok configuration before starting IEMS.");
  const response = await fetch(`${agent}/endpoints`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: existing.name, url: existing.url, upstream: { url: `http://localhost:${port}` }, inspect: existing.inspect ?? true, pooling_enabled: existing.pooling_enabled ?? false }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Could not switch the IEMS tunnel: ${await response.text()}`);
  return existing.url;
}

async function ready(url) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { "ngrok-skip-browser-warning": "true" }, signal: AbortSignal.timeout(15_000) });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch { /* The first development request compiles the page. */ }
    await delay(1000);
  }
  throw new Error(`The application did not become ready at ${url}. Check Docker logs.`);
}

function stop() {
  if (stopping) return;
  stopping = true;
  child?.kill("SIGTERM");
  console.log("\nDocker stays running. Stop it with the Docker Compose commands in README.md.");
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The application port must be between 1 and 65535.");
  await run("docker", ["info", "--format", "Docker {{.ServerVersion}}"]);
  console.log("Connecting ngrok…");
  const publicUrl = await tunnel();
  console.log(`Starting ${development ? "development" : "production"} in Docker…`);
  const env = { ...process.env, IEMS_PUBLIC_APP_URL: publicUrl, NEXT_PUBLIC_APP_URL: publicUrl };
  await run("docker", ["compose", "-f", development ? "compose.dev.yaml" : "compose.yaml", "-f", "compose.ngrok.yaml", "up", "--build", "-d", ...(development ? ["--renew-anon-volumes"] : ["--wait"])], env);
  await ready(`http://localhost:${port}/`);
  await ready(`${publicUrl}/api/health`);
  console.log(`\nIEMS is ready: ${publicUrl}\nAdmin: ${publicUrl}/admin\nScanner: ${publicUrl}/scan\nLocal: http://localhost:${port}\n`);
  if (child) {
    console.log("Keep this terminal open for ngrok. Press Ctrl+C to close the tunnel.");
    child.once("exit", (code) => { if (!stopping) { console.error("ngrok stopped; the public URL is offline."); process.exitCode = code || 1; } });
  } else console.log("Using the existing ngrok agent; it must stay running for the public URL to work.");
} catch (error) {
  child?.kill("SIGTERM");
  console.error(`\nStartup failed: ${error.message}`);
  process.exitCode = 1;
}
