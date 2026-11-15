// stills_v2.mjs — 検品のコマを PNG の静止画で焼く（㉒ P2・P3・2026-11-15。analysis/_tools/still17.mjs を一般化）
//   束ね（bundle）は1回・ブラウザは1つで何コマも焼く（npx remotion still を1コマずつ回すと毎回束ね直す）。
//   使う所：公開の倉庫の Actions の検品の焼き／Modal（tools/modal_render.py）の本番の焼きのあと＝同じ道具で同じ絵を焼いて画素で比べる
// 使い方（倉庫の頭で）: node tools/stills_v2.mjs <cuts.json> <出力のフォルダ> <コマ,コマ,…|@コマの表.txt> [--comp SukattoShort]
//   コマは 0 から数える（秒×30）。書くのは <出力>/fNNNN.png と <出力>/stills.json（焼いたコマ・秒・字体の確かめ）
//   ⚠️ 1コマでも焼けなければ exit 1（焼けた分だけで成功に見せない）
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const compAt = args.indexOf("--comp");
const compId = compAt >= 0 ? args[compAt + 1] : "SukattoShort";
const [propsPath, outDir, framesArg] = args.filter((a, i) => !(compAt >= 0 && (i === compAt || i === compAt + 1)));
if (!propsPath || !outDir || !framesArg) {
  console.error("使い方: node tools/stills_v2.mjs <cuts.json> <出力のフォルダ> <コマ,…|@表.txt> [--comp SukattoShort]");
  process.exit(2);
}
const frameText = framesArg.startsWith("@") ? fs.readFileSync(framesArg.slice(1), "utf-8") : framesArg;
// @表のファイルは1行1コマ（行の頭の数字だけを読む＝tools/qa_frames.py の表の形）。引数はカンマ区切り。# から後ろは注記
const frames = frameText
  .split(/\r?\n/)
  .map((l) => l.replace(/#.*/, "").trim())
  .filter(Boolean)
  .flatMap((l) => l.split(/[,\s]+/).filter(Boolean).slice(0, framesArg.startsWith("@") ? 1 : undefined))
  .map((s) => {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0) throw new Error(`コマの番号が読めない: ${s}`);
    return n;
  });
if (!frames.length) throw new Error("コマが1つも無い");
const inputProps = JSON.parse(fs.readFileSync(propsPath, "utf-8"));
fs.mkdirSync(outDir, { recursive: true });
const root = process.cwd();
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), rootDir: root, publicDir: path.join(root, "public") });
const bundleSec = (Date.now() - t0) / 1000;
console.log(`束ねた ${bundleSec.toFixed(1)}秒`);
const browser = await openBrowser("chrome");
const done = [];
let failed = null;
try {
  const composition = await selectComposition({ serveUrl, id: compId, inputProps, puppeteerInstance: browser });
  for (const f of frames) {
    if (f >= composition.durationInFrames) throw new Error(`f${f} は尺（${composition.durationInFrames}コマ）の外`);
    const t1 = Date.now();
    const output = path.join(outDir, `f${String(f).padStart(4, "0")}.png`);
    await renderStill({ composition, serveUrl, output, frame: f, inputProps, puppeteerInstance: browser, imageFormat: "png" });
    const sec = (Date.now() - t1) / 1000;
    done.push({ frame: f, file: path.basename(output), sec: Number(sec.toFixed(2)), bytes: fs.statSync(output).size });
    console.log(`焼いた f${f} → ${output}（${sec.toFixed(1)}秒）`);
  }
  fs.writeFileSync(path.join(outDir, "stills.json"), JSON.stringify({
    comp: compId, props: propsPath, durationInFrames: composition.durationInFrames, fps: composition.fps,
    width: composition.width, height: composition.height, bundleSec, totalSec: (Date.now() - t0) / 1000, frames: done,
  }, null, 1));
} catch (e) {
  failed = e;
} finally {
  await browser.close({ silent: true });
}
if (failed || done.length !== frames.length) {
  console.error(`🔴 焼けたのは ${done.length}/${frames.length} コマ: ${failed ? failed.stack ?? failed : ""}`);
  process.exit(1);
}
console.log(`✓ ${done.length} コマ（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
