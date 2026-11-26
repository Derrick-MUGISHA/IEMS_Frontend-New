import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const folders: string[] = [];
afterEach(() => { folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })); });
function start(mode: string, existingPort: number) {
  const folder = mkdtempSync(join(tmpdir(), "iems-startup-")); folders.push(folder);
  const log = join(folder, "commands.jsonl");
  const preload = join(folder, "fetch.mjs");
  writeFileSync(join(folder, "docker"), `#!${process.execPath}\nimport('node:fs').then(({appendFileSync})=>appendFileSync(process.env.STARTUP_TEST_LOG,JSON.stringify({args:process.argv.slice(2),url:process.env.IEMS_PUBLIC_APP_URL,publicUrl:process.env.NEXT_PUBLIC_APP_URL})+'\\n'));\n`, { mode: 0o755 });
  writeFileSync(preload, `import {appendFileSync} from 'node:fs';
globalThis.fetch=async(url,options={})=>{
 appendFileSync(process.env.STARTUP_TEST_LOG,JSON.stringify({request:String(url)})+'\\n');
 if(String(url).endsWith('/api/endpoints')){
  if(options.method==='PUT'){appendFileSync(process.env.STARTUP_TEST_LOG,JSON.stringify({endpoint:JSON.parse(options.body)})+'\\n'); return Response.json({url:'https://iems-test.ngrok.app'});}
  return Response.json({endpoints:[{name:'iems',url:'https://iems-test.ngrok.app',upstream:{url:'http://localhost:${existingPort}'},inspect:true}]});
 }
 return Response.json({status:'ok'});
};`);
  const result = spawnSync(process.execPath, ["--import", preload, resolve("scripts/start-with-ngrok.mjs"), ...(mode === "dev" ? ["--dev"] : [])], {
    env: { ...process.env, PATH: `${folder}:${process.env.PATH}`, STARTUP_TEST_LOG: log, IEMS_PORT: "3002", IEMS_DEV_PORT: "3003" }, encoding: "utf8", timeout: 10_000,
  });
  return { result, commands: readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) };
}
it("starts production with the existing HTTPS URL wired into the build and runtime", () => {
  const { result, commands } = start("production", 3002);
  expect(result.status).toBe(0);
  const up = commands.find((command) => command.args?.includes("up"));
  expect(up.args).toContain("compose.ngrok.yaml"); expect(up.args).toContain("--wait");
  expect(up.url).toBe("https://iems-test.ngrok.app"); expect(up.publicUrl).toBe(up.url);
  expect(commands.some((command) => command.request === "https://iems-test.ngrok.app/api/health")).toBe(true);
  expect(commands.some((command) => command.endpoint)).toBe(false);
});
it("switches only the IEMS endpoint to development and starts the development container", () => {
  const { result, commands } = start("dev", 3002);
  expect(result.status).toBe(0);
  expect(commands.find((command) => command.endpoint).endpoint).toMatchObject({ name: "iems", url: "https://iems-test.ngrok.app", upstream: { url: "http://localhost:3003" }, inspect: true });
  const up = commands.find((command) => command.args?.includes("up"));
  expect(up.args).toContain("compose.dev.yaml"); expect(up.args).toContain("--renew-anon-volumes");
  expect(commands.some((command) => command.request === "http://localhost:3003/")).toBe(true);
});
it("leaves another application's ngrok tunnel untouched", () => {
  const { result, commands } = start("dev", 9000);
  expect(result.status).toBe(1);
  expect(commands.some((command) => command.endpoint || command.args?.includes("up"))).toBe(false);
});
