import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";

// Exercise the actual library worker against the branded ticket PNG, without
// opening a camera or consuming a ticket in a database.
export function qrWorkerDecoder() {
  const require = createRequire(import.meta.url);
  const path = join(dirname(require.resolve("qr-scanner")), "qr-scanner-worker.min.js");
  let workerCode = "";
  runInNewContext(readFileSync(path, "utf8").replace("export const createWorker", "const createWorker") + "\ncreateWorker();", {
    Blob: class { constructor(parts: string[]) { workerCode = parts.join(""); } },
    URL: { createObjectURL: () => "test-worker" },
    Worker: class {},
  });
  let result: string | null = null;
  const scope = { self: {
    onmessage: (event: unknown) => { void event; },
    postMessage: (message: { data: string | null }) => { result = message.data; },
    close: () => {},
  } };
  runInNewContext(workerCode, scope);
  return (data: Uint8ClampedArray, width: number, height: number): string | null => {
    result = null;
    scope.self.onmessage({ data: { id: 1, type: "decode", data: { data, width, height } } });
    return result;
  };
}

