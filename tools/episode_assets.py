# -*- coding: utf-8 -*-
"""episode_assets.py — 1本の回を焼くのに要るファイルの一覧を cuts.json から作る（㉒ P2・P3・2026-11-15）

■ 何に使うか
  - Modal で本編を焼く（tools/modal_render.py）＝送るのは「コード＋その回の物だけ」
  - 公開の倉庫の Actions で検品のコマを焼く＝非公開の倉庫から「その回の物だけ」を取る
  どちらも同じ一覧を使う（片方だけ決まりがずれると、検品の絵と本番が別の絵になる）。

■ 一覧の決まり（コードが素材を読む所＝src の staticFile( を 2026-11-15 に全部洗って決めた）
  1. その回のフォルダ：cuts.json・narration.mp3（必須）／bgm.txt・bgm_vol.txt・bgm_start.txt・op_bgm.txt（あれば）
  2. cuts.json の中の "assets/…" の字すべて（背景・人物・小物・寄り・吹き出しの絵など）
  3. 人物（assets/char/<名前>/…）はフォルダごと＝表情の絵が無い時の控え（normal.png・ShortV2 の useCharSrc）まで同じにする
  4. "scene:<名前>" → assets/scene/<名前>.png（共用の SceneArtBG）
  5. 効果音 "se": "<名前>" → assets/se/<名前>.mp3（ShortV2・SukattoVideo とも）
  6. 印（assets/mark/）はフォルダごと（印の名前は v2 と共用で別の表から引く＝1.8MB なので全部）
  7. BGM＝bgm.txt の曲（無ければ mux_final.py の既定 daily_acoustic53・"none"/"off" は無し）・op_bgm.txt の曲
  ⚠️ 新しい部品が staticFile で別の場所を読むようにしたら、ここに足す（足さないと Actions の検品の絵だけ欠ける＝
     Modal は同じ一覧で送るので両方で同じく欠け、`<Img>` が読めずに焼きが止まる＝黙っては通らない）

■ 使い方
  python -B tools/episode_assets.py <slug> [--ref <sha>] [--json]
      git の版（既定 HEAD）から cuts.json を読み、要るファイルを出す。版に無い物があれば exit 1（fail closed）
  python -B tools/episode_assets.py --selftest
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent

EP_REQUIRED = ("cuts.json", "narration.mp3")
EP_OPTIONAL = ("bgm.txt", "bgm_vol.txt", "bgm_start.txt", "op_bgm.txt")
BGM_DEFAULT = "daily_acoustic53"  # tools/mux_final.py の既定と同じ
ASSET_RE = re.compile(r"assets/[A-Za-z0-9_./\-]+")
SCENE_RE = re.compile(r"^scene:([A-Za-z0-9_\-]+)$")
WHOLE_DIRS = ("public/assets/mark/",)


def _walk_strings(o, key=None):
    """JSON の中の (キー, 文字列) を全部出す。"""
    if isinstance(o, dict):
        for k, v in o.items():
            yield from _walk_strings(v, k)
    elif isinstance(o, list):
        for v in o:
            yield from _walk_strings(v, key)
    elif isinstance(o, str):
        yield key, o


def wanted(slug: str, cuts: dict, ep_texts: dict[str, str]) -> tuple[set[str], set[str], set[str]]:
    """要る物を (ファイル, フォルダ, 回のフォルダの任意のファイル) で返す。パスは倉庫の頭からの / 区切り。
    ep_texts＝回のフォルダの bgm.txt・op_bgm.txt の中身（無い物は入れない）。"""
    ep = f"episodes/{slug}/"
    files = {ep + n for n in EP_REQUIRED}
    optional = {ep + n for n in EP_OPTIONAL}
    dirs = set(WHOLE_DIRS)
    for key, s in _walk_strings(cuts):
        for m in ASSET_RE.findall(s):
            p = "public/" + m.rstrip("./")
            files.add(p)
            parts = PurePosixPath(p).parts  # public / assets / char / <名前> / x.png
            if len(parts) >= 5 and parts[2] == "char":
                dirs.add("/".join(parts[:4]) + "/")
        sm = SCENE_RE.match(s)
        if sm:
            files.add(f"public/assets/scene/{sm.group(1)}.png")
        if key == "se" and s:
            files.add(f"public/assets/se/{s}.mp3")
    bgm = ep_texts.get("bgm.txt", BGM_DEFAULT).strip() or BGM_DEFAULT
    if bgm.lower() not in ("none", "off"):
        files.add(f"public/assets/bgm/{bgm}.mp3")
    op = ep_texts.get("op_bgm.txt", "").strip()
    if op:
        files.add(f"public/assets/bgm/{op}.mp3")
    return files, dirs, optional


def resolve(files: set[str], dirs: set[str], optional: set[str], tree: dict[str, int]) -> tuple[list[str], list[str]]:
    """版の木（パス→バイト）に当てて (取る物, 無い物) を返す。フォルダは中のファイルに広げる。"""
    take, missing = set(), []
    for f in sorted(files):
        if f in tree:
            take.add(f)
        else:
            missing.append(f)
    for d in sorted(dirs):
        inside = [p for p in tree if p.startswith(d)]
        if inside:
            take.update(inside)
        else:
            missing.append(d)
    take.update(p for p in optional if p in tree)
    return sorted(take), missing


# ---------- git（ここだけが外に触る＝selftest では差し替える） ----------
def git(*args: str) -> bytes:
    r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} が exit {r.returncode}: {r.stderr.decode('utf-8', 'replace')[:300]}")
    return r.stdout


def git_tree(ref: str, prefixes: list[str]) -> dict[str, int]:
    out = git("ls-tree", "-r", "-l", "-z", ref, "--", *prefixes).decode("utf-8")
    tree = {}
    for rec in out.split("\0"):
        if not rec:
            continue
        meta, path = rec.split("\t", 1)
        size = meta.split()[3]
        tree[path] = int(size) if size.isdigit() else 0
    return tree


def for_ref(slug: str, ref: str = "HEAD", show=None, tree_fn=None) -> dict:
    """版 ref の時点の一覧。show＝`git show ref:path` の代わり（selftest 用）。"""
    show = show or (lambda p: git("show", f"{ref}:{p}"))
    tree_fn = tree_fn or (lambda prefixes: git_tree(ref, prefixes))
    ep = f"episodes/{slug}/"
    ep_tree = tree_fn([ep])
    if ep + "cuts.json" not in ep_tree:
        raise SystemExit(f"🔴 {ref} に {ep}cuts.json が無い（commit したか・回の名前を確かめる）")
    cuts = json.loads(show(ep + "cuts.json").decode("utf-8"))
    ep_texts = {n: show(ep + n).decode("utf-8") for n in ("bgm.txt", "op_bgm.txt") if ep + n in ep_tree}
    files, dirs, optional = wanted(slug, cuts, ep_texts)
    tree = dict(ep_tree)
    tree.update(tree_fn(["public/assets/"]))
    take, missing = resolve(files, dirs, optional, tree)
    return {"slug": slug, "ref": ref, "files": take, "missing": missing,
            "bytes": sum(tree.get(p, 0) for p in take), "v2": cuts.get("style") == "v2"}


# ---------- selftest（git に触らない） ----------
def selftest() -> int:
    ok = True

    def check(name, got, want):
        nonlocal ok
        good = got == want
        ok &= good
        print(f"  {'✓' if good else '✗'} {name}" + ("" if good else f"\n      得た {got}\n      期待 {want}"))

    cuts = {"style": "v2", "cuts": [
        {"bg": "assets/bg/living_room.png", "se": "dark",
         "chars": [{"asset": "assets/char/ojisan/angry.png", "marks": ["anger*2"]}],
         "deco": [{"img": "assets/prop/seikyusyo.png"}]},
        {"bg": "abstract:burst_red", "se": "", "chars": [], "bgs": ["scene:kitchen", "assets/bg/genkan.png"]},
    ], "shots": [{"c": "woman_office:cry", "asset": "assets/char/woman_office/cry.png", "se": "don"}]}
    files, dirs, optional = wanted("short-ep999", cuts, {"bgm.txt": "maou_bgm_8bit01\n"})
    check("回のフォルダの必須2つ", {f for f in files if f.startswith("episodes/")},
          {"episodes/short-ep999/cuts.json", "episodes/short-ep999/narration.mp3"})
    check("素材（明示・scene・se・bgm）", {f for f in files if f.startswith("public/")}, {
        "public/assets/bg/living_room.png", "public/assets/bg/genkan.png", "public/assets/char/ojisan/angry.png",
        "public/assets/prop/seikyusyo.png", "public/assets/char/woman_office/cry.png",
        "public/assets/scene/kitchen.png", "public/assets/se/dark.mp3", "public/assets/se/don.mp3",
        "public/assets/bgm/maou_bgm_8bit01.mp3"})
    check("人物はフォルダごと・印は全部", dirs, {"public/assets/char/ojisan/", "public/assets/char/woman_office/",
                                        "public/assets/mark/"})
    f2, _, _ = wanted("x", {"cuts": []}, {})
    check("bgm.txt が無い＝既定の曲", {f for f in f2 if "bgm/" in f}, {"public/assets/bgm/daily_acoustic53.mp3"})
    f3, _, _ = wanted("x", {"cuts": []}, {"bgm.txt": "none"})
    check("bgm.txt が none＝BGM なし", {f for f in f3 if "bgm/" in f}, set())

    tree = {"episodes/short-ep999/cuts.json": 10, "episodes/short-ep999/narration.mp3": 20,
            "episodes/short-ep999/bgm.txt": 1, "episodes/short-ep999/meta.json": 5,
            "public/assets/bg/living_room.png": 100, "public/assets/char/ojisan/angry.png": 50,
            "public/assets/char/ojisan/normal.png": 50, "public/assets/char/woman_office/cry.png": 60,
            "public/assets/mark/anger.png": 3, "public/assets/se/dark.mp3": 2}
    take, missing = resolve(files, dirs, optional, tree)
    check("控えの normal.png も取る", "public/assets/char/ojisan/normal.png" in take, True)
    check("回の任意のファイルは有る物だけ・meta.json は取らない",
          [p for p in take if p.startswith("episodes/")],
          ["episodes/short-ep999/bgm.txt", "episodes/short-ep999/cuts.json", "episodes/short-ep999/narration.mp3"])
    check("🔴 版に無い物は missing に出る（fail closed）", missing, [
        "public/assets/bg/genkan.png", "public/assets/bgm/maou_bgm_8bit01.mp3", "public/assets/prop/seikyusyo.png",
        "public/assets/scene/kitchen.png", "public/assets/se/don.mp3"])

    blobs = {"episodes/short-ep999/cuts.json": json.dumps(cuts).encode(), "episodes/short-ep999/bgm.txt": b"maou_bgm_8bit01"}
    r = for_ref("short-ep999", "deadbee", show=lambda p: blobs[p],
                tree_fn=lambda pre: {p: s for p, s in tree.items() if any(p.startswith(x) for x in pre)})
    check("for_ref は git の代わりの関数だけで回る・v2 を読む", (r["v2"], len(r["missing"])), (True, 5))
    try:
        for_ref("short-ep998", "deadbee", show=lambda p: b"", tree_fn=lambda pre: {})
        check("cuts.json が無い回は止まる", "止まらなかった", "SystemExit")
    except SystemExit:
        check("cuts.json が無い回は止まる", "SystemExit", "SystemExit")
    print("✓ selftest 通過" if ok else "✗ selftest 失敗")
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if "--selftest" in argv:
        return selftest()
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    slug = argv[0]
    ref = argv[argv.index("--ref") + 1] if "--ref" in argv else "HEAD"
    r = for_ref(slug, ref)
    if "--json" in argv:
        print(json.dumps(r, ensure_ascii=False, indent=1))
    else:
        print("\n".join(r["files"]))
        print(f"# {len(r['files'])} ファイル・{r['bytes'] / 1e6:.1f}MB（{slug} @ {ref}）", file=sys.stderr)
    if r["missing"]:
        print("🔴 版に無い物（焼けない）:\n  " + "\n  ".join(r["missing"]), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
