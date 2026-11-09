// El servidor local guarda los datos en archivos: deben seguir ahí al "reiniciar" (nueva instancia).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileFactory } from "../netlify/lib/db.mjs";

test("las cuentas y datos sobreviven a un reinicio del servidor local", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cbpilot-"));
  try {
    const a = fileFactory(dir)("users");
    const w = await a.setJSON("u/1", { name: "Carlos" }, { onlyIfNew: true });
    assert.equal(w.modified, true);
    assert.equal((await a.setJSON("u/1", { name: "Otro" }, { onlyIfNew: true })).modified, false, "respeta onlyIfNew");
    await a.set("bin", new Uint8Array([1, 2, 3]));
    const b = fileFactory(dir)("users"); // otra instancia = servidor reiniciado
    const r = await b.getWithMetadata("u/1", { type: "json" });
    assert.equal(r.data.name, "Carlos");
    assert.equal((await b.setJSON("u/1", { name: "X" }, { onlyIfMatch: "viejo" })).modified, false, "respeta onlyIfMatch");
    assert.equal((await b.setJSON("u/1", { name: "Carlos M" }, { onlyIfMatch: r.etag })).modified, true);
    assert.deepEqual([...new Uint8Array((await b.getWithMetadata("bin", { type: "arrayBuffer" })).data)], [1, 2, 3]);
    assert.deepEqual((await b.list({ prefix: "u/" })).blobs.map(x => x.key), ["u/1"]);
    await b.delete("u/1");
    assert.equal(await fileFactory(dir)("users").getWithMetadata("u/1"), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
