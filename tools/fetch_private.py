# -*- coding: utf-8 -*-
"""fetch_private.py — 検品の静止画を焼く前に、非公開の倉庫から「その回の物だけ」を取る（公開の倉庫の Actions 用・2026-11-15）

■ 何をするか
  1. 鍵（環境変数 SUKATTO_ASSETS_TOKEN）で GitHub の API から、非公開の倉庫の版 <sha> の木（ファイルの一覧と blob の指紋）を読む。
     鍵は「その倉庫だけ・中身の読み取りだけ」の fine-grained token（この倉庫の Settings → Secrets and variables → Actions に置く）
  2. 🔴 この倉庫のコード（src/・public/fonts/・package.json・package-lock.json・tsconfig.json・tools の3本）が、
     その版のコードと blob の指紋まで同じかを確かめる。1つでも違えば止める
     ＝検品の絵と本番の動画（非公開の倉庫のその版を別の場所で焼く）が別のコードになるのを防ぐ
  3. tools/episode_assets.py（本番の焼きと同じ決まり）で、その回の cuts.json から要るファイルを決め、それだけを取る。
     取った物は blob の指紋で照らし合わせてから書く（書くのは episodes/ と public/assets/ の下だけ）
  ⚠️ 鍵は画面にもログにも出さない。取ったファイルの名前も出さない（数と大きさだけ）＝この倉庫のログはだれでも見られる

■ 使い方（倉庫の頭で）
  SUKATTO_ASSETS_TOKEN=… python3 -B tools/fetch_private.py <回> <版の sha（40桁）>
  python3 -B tools/fetch_private.py --selftest      … ネットに触らない（一時フォルダだけ）
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import episode_assets  # noqa: E402  本番の焼きと同じ「その回で要るファイル」の決まり

PRIVATE_REPO = os.environ.get("SUKATTO_PRIVATE_REPO", "tonisura99-hue/sukatto-factory")
API = "https://api.github.com"
TOKEN_ENV = "SUKATTO_ASSETS_TOKEN"
# この倉庫と非公開の倉庫で同じでなければならないコード（フォルダは中の顔ぶれまで同じ）
SHARED_DIRS = ("src/", "public/fonts/")
SHARED_FILES = ("package.json", "package-lock.json", "tsconfig.json",
                "tools/stills_v2.mjs", "tools/episode_assets.py", "tools/qa_frames.py")
WRITE_PREFIXES = ("episodes/", "public/assets/")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
HINT = {401: "鍵が無効か期限切れ（作ってから90日）", 403: "鍵の権限が足りないか、回数の上限",
        404: "倉庫・版・ファイルが見えない（鍵の対象の倉庫か・版の sha が push 済みかを確かめる）"}


def blob_sha(data: bytes) -> str:
    """git の blob の指紋（git hash-object と同じ）。"""
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


class Api:
    """GitHub の API（読むだけ）。鍵はこのクラスの中だけで使い、例外の文にも出さない。"""

    def __init__(self, token: str, repo: str = PRIVATE_REPO, opener=None, tries: int = 3, wait: float = 3.0):
        self._token = token
        self.repo = repo
        self._open = opener or urllib.request.urlopen
        self._tries, self._wait = tries, wait
        self._cache: dict[str, bytes] = {}
        self.calls = 0

    def _get(self, path: str) -> bytes:
        req = urllib.request.Request(f"{API}/repos/{self.repo}/{path}", headers={
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "sukatto-render-fetch"})
        where = path.split("?", 1)[0]
        for i in range(self._tries):
            self.calls += 1
            try:
                with self._open(req, timeout=60) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                code = e.code
                if code >= 500 and i + 1 < self._tries:
                    time.sleep(self._wait * (i + 1))
                    continue
                raise SystemExit(f"🔴 GitHub の API が {code} を返した（{where}）。{HINT.get(code, '')}") from None
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if i + 1 < self._tries:
                    time.sleep(self._wait * (i + 1))
                    continue
                raise SystemExit(f"🔴 GitHub につながらない（{where}）: {type(e).__name__}") from None
        raise SystemExit(f"🔴 GitHub の API が答えない（{where}）")

    def tree(self, ref: str) -> dict[str, tuple[str, int]]:
        """版 ref の全ファイル（パス → (blob の指紋, バイト)）。"""
        commit = json.loads(self._get(f"git/commits/{ref}"))
        if commit.get("sha") != ref:
            raise SystemExit(f"🔴 版の sha が合わない（頼んだ {ref[:7]}・返った {str(commit.get('sha'))[:7]}）")
        t = json.loads(self._get(f"git/trees/{commit['tree']['sha']}?recursive=1"))
        if t.get("truncated"):
            raise SystemExit("🔴 木の一覧が途中で切れた（ファイルが多すぎる）＝取れない")
        return {e["path"]: (e["sha"], int(e.get("size") or 0)) for e in t["tree"] if e.get("type") == "blob"}

    def blob(self, sha: str) -> bytes:
        if sha not in self._cache:
            j = json.loads(self._get(f"git/blobs/{sha}"))
            if j.get("encoding") != "base64":
                raise SystemExit(f"🔴 blob {sha[:7]} の形が読めない（encoding={j.get('encoding')}）")
            data = base64.b64decode(j.get("content", ""))
            if blob_sha(data) != sha:
                raise SystemExit(f"🔴 取ったファイルの指紋が合わない（blob {sha[:7]}）")
            self._cache[sha] = data
        return self._cache[sha]


def local_code(root: Path) -> dict[str, str]:
    """この倉庫の共有のコード（パス → blob の指紋）。"""
    out = {}
    for d in SHARED_DIRS:
        base = root / d
        if base.is_dir():
            for p in sorted(base.rglob("*")):
                if p.is_file():
                    out[p.relative_to(root).as_posix()] = blob_sha(p.read_bytes())
    for f in SHARED_FILES:
        if (root / f).is_file():
            out[f] = blob_sha((root / f).read_bytes())
    return out


def code_mismatch(local: dict[str, str], tree: dict[str, tuple[str, int]]) -> list[str]:
    """違う所を文で返す（空＝同じ）。"""
    want = {p: s for p, (s, _) in tree.items() if p in SHARED_FILES or p.startswith(SHARED_DIRS)}
    probs = []
    for p in sorted(set(want) | set(local)):
        if p not in want:
            probs.append(f"この倉庫にだけある: {p}")
        elif p not in local:
            probs.append(f"非公開の版にだけある: {p}")
        elif want[p] != local[p]:
            probs.append(f"中身が違う: {p}")
    return probs


def safe_dest(root: Path, p: str) -> Path:
    pp = PurePosixPath(p)
    if pp.is_absolute() or ".." in pp.parts or not p.startswith(WRITE_PREFIXES):
        raise SystemExit(f"🔴 ここには書かない: {p}")
    return root.joinpath(*pp.parts)


def plan(slug: str, tree: dict[str, tuple[str, int]], read_text) -> tuple[list[str], list[str], bool]:
    """その回で要るファイル（取る物, 版に無い物, v2 か）。決まりは tools/episode_assets.py（本番の焼きと同じ）。"""
    ep = f"episodes/{slug}/"
    if ep + "cuts.json" not in tree:
        raise SystemExit(f"🔴 その版に {ep}cuts.json が無い（回の名前・版を確かめる）")
    cuts = json.loads(read_text(ep + "cuts.json"))
    ep_texts = {n: read_text(ep + n) for n in ("bgm.txt", "op_bgm.txt") if ep + n in tree}
    files, dirs, optional = episode_assets.wanted(slug, cuts, ep_texts)
    sizes = {p: s for p, (_, s) in tree.items() if p.startswith((ep, "public/assets/"))}
    take, missing = episode_assets.resolve(files, dirs, optional, sizes)
    return take, missing, cuts.get("style") == "v2"


def fetch(slug: str, ref: str, api: Api, root: Path = ROOT) -> dict:
    tree = api.tree(ref)
    local = local_code(root)
    probs = code_mismatch(local, tree)
    if probs:
        raise SystemExit(f"🔴 この倉庫のコードが非公開の版 {ref[:7]} と違う＝焼かない（検品の絵と本番が別の絵になる）:\n  "
                         + "\n  ".join(probs[:30])
                         + "\n  → 非公開の版の共有のコードを、この倉庫に同じバイトで写して push してから回す")
    take, missing, v2 = plan(slug, tree, lambda p: api.blob(tree[p][0]).decode("utf-8"))
    if missing:
        raise SystemExit("🔴 その版に無い素材がある（焼けない）:\n  " + "\n  ".join(missing))
    total = 0
    for p in take:
        dest = safe_dest(root, p)
        data = api.blob(tree[p][0])
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        total += len(data)
    return {"ref": ref, "code": len(local), "files": len(take), "bytes": total, "v2": v2, "calls": api.calls}


# ───────── selftest（ネットに触らない・一時フォルダだけ） ─────────
class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def selftest() -> int:
    ok = True

    def check(name, got, want):
        nonlocal ok
        good = got == want
        ok &= good
        print(f"  {'✓' if good else '✗'} {name}" + ("" if good else f"\n      得た {got!r}\n      期待 {want!r}"))

    def stops(name, fn, must_in: str, must_not: str = "\0"):
        try:
            fn()
            check(name, "止まらなかった", "止まる")
        except SystemExit as e:
            msg = str(e)
            check(name, (must_in in msg, must_not in msg), (True, False))

    check("blob の指紋＝git hash-object（hello）", blob_sha(b"hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a")
    check("blob の指紋＝git hash-object（空）", blob_sha(b""), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391")
    check("回の名前の形", [bool(SLUG_RE.match(s)) for s in ("short-ep076", "short-ep077a", "../x", "a b", "")],
          [True, True, False, False, False])
    check("版は40桁の sha だけ", [bool(SHA_RE.match(s)) for s in ("a" * 40, "a" * 7, "g" * 40, "A" * 40)],
          [True, False, False, False])
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        check("書く場所は episodes/ と public/assets/ だけ",
              [str(safe_dest(root, "public/assets/bg/a.png").relative_to(root).as_posix())], ["public/assets/bg/a.png"])
        for bad in ("src/x.tsx", "../x", "/etc/x", "episodes/../src/x"):
            stops(f"書かない場所は止まる（{bad}）", lambda b=bad: safe_dest(root, b), "書かない")
        code = {"src/a.tsx": b"export const A = 1;\n", "public/fonts/F.ttf": b"\x00\x01font"}
        code.update({f: b"x\n" for f in SHARED_FILES})
        for p, b in code.items():
            (root / p).parent.mkdir(parents=True, exist_ok=True)
            (root / p).write_bytes(b)
        local = local_code(root)
        cuts = {"style": "v2", "cuts": [{"bg": "assets/bg/room.png", "se": "don",
                                          "chars": [{"asset": "assets/char/man/angry.png"}]}]}
        files = {"episodes/short-ep999/cuts.json": json.dumps(cuts).encode(), "episodes/short-ep999/narration.mp3": b"mp3",
                 "episodes/short-ep999/bgm.txt": b"song\n", "episodes/short-ep999/meta.json": b"{}",
                 "public/assets/bg/room.png": b"png1", "public/assets/bg/other.png": b"png2",
                 "public/assets/char/man/angry.png": b"png3", "public/assets/char/man/normal.png": b"png4",
                 "public/assets/se/don.mp3": b"se", "public/assets/mark/m.png": b"mk",
                 "public/assets/bgm/song.mp3": b"bgm", **code}
        tree = {p: (blob_sha(b), len(b)) for p, b in files.items()}
        check("コードが同じなら照合は空", code_mismatch(local, tree), [])
        t2 = dict(tree)
        t2["src/a.tsx"] = ("0" * 40, 1)
        check("中身が違えば出す", code_mismatch(local, t2), ["中身が違う: src/a.tsx"])
        t3 = dict(tree)
        t3["src/new.tsx"] = ("1" * 40, 1)
        check("非公開の版にだけある部品を出す", code_mismatch(local, t3), ["非公開の版にだけある: src/new.tsx"])
        t4 = {p: v for p, v in tree.items() if p != "tools/qa_frames.py"}
        check("この倉庫にだけある物を出す", code_mismatch(local, t4), ["この倉庫にだけある: tools/qa_frames.py"])

        ref, tree_sha = "a" * 40, "b" * 40
        seen = {"auth": set(), "fail": {}}
        served = {f"git/commits/{ref}": {"sha": ref, "tree": {"sha": tree_sha}},
                  f"git/trees/{tree_sha}?recursive=1": {"truncated": False, "tree": [
                      {"path": p, "type": "blob", "sha": s, "size": n} for p, (s, n) in tree.items()]}}
        for p, b in files.items():
            served[f"git/blobs/{blob_sha(b)}"] = {"encoding": "base64", "content": base64.encodebytes(b).decode()}

        def opener(req, timeout=60):
            seen["auth"].add(req.get_header("Authorization"))
            path = req.full_url.split("/repos/x/y/", 1)[1]
            n = seen["fail"].get(path, 0)
            if n:
                seen["fail"][path] = n - 1
                raise urllib.error.HTTPError(req.full_url, 502, "bad gateway", None, None)
            if path not in served:
                raise urllib.error.HTTPError(req.full_url, 404, "not found", None, None)
            return _Resp(json.dumps(served[path]).encode())

        api = Api("TESTKEY123", repo="x/y", opener=opener, wait=0)
        seen["fail"][f"git/commits/{ref}"] = 1  # 1回目は 502 → やり直して通る
        r = fetch("short-ep999", ref, api, root)
        got = sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and not p.name.startswith("_"))
        check("取ったのはその回の物だけ（meta.json・ほかの背景は取らない）", sorted(set(got) - set(code)), [
            "episodes/short-ep999/bgm.txt", "episodes/short-ep999/cuts.json", "episodes/short-ep999/narration.mp3",
            "public/assets/bg/room.png", "public/assets/bgm/song.mp3", "public/assets/char/man/angry.png",
            "public/assets/char/man/normal.png", "public/assets/mark/m.png", "public/assets/se/don.mp3"])
        check("取ったバイトは同じ", (root / "public/assets/bgm/song.mp3").read_bytes(), b"bgm")
        check("数と v2", (r["files"], r["v2"], r["code"]), (9, True, len(code)))
        check("鍵は見出しで渡す（Bearer）", seen["auth"], {"Bearer TESTKEY123"})
        check("502 はやり直す（API の回数に数える）", r["calls"] >= 2, True)
        stops("コードが違えば止まる", lambda: fetch("short-ep999", ref, Api("TESTKEY123", repo="x/y", opener=opener, wait=0),
                                           _swap(root, "src/a.tsx", b"changed\n")), "中身が違う: src/a.tsx")
        (root / "src/a.tsx").write_bytes(code["src/a.tsx"])
        bad = dict(served)
        sha_bgm = blob_sha(b"bgm")
        bad[f"git/blobs/{sha_bgm}"] = {"encoding": "base64", "content": base64.encodebytes(b"tampered").decode()}
        served_backup = dict(served)
        served.clear()
        served.update(bad)
        stops("取った物の指紋が違えば止まる", lambda: fetch("short-ep999", ref, Api("K", repo="x/y", opener=opener, wait=0), root),
              "指紋が合わない")
        served.clear()
        served.update(served_backup)
        del served[f"git/commits/{ref}"]
        stops("404 は止まる・鍵を文に出さない", lambda: fetch("short-ep999", ref, Api("TESTKEY123", repo="x/y", opener=opener,
                                                                                  wait=0), root), "404", "TESTKEY123")

        def opener401(req, timeout=60):
            raise urllib.error.HTTPError(req.full_url, 401, "bad credentials", None, None)
        stops("401 は止まる・期限切れの案内・鍵を文に出さない",
              lambda: Api("TESTKEY123", repo="x/y", opener=opener401, wait=0).tree(ref), "期限切れ", "TESTKEY123")
    print("✓ selftest 通過" if ok else "✗ selftest 失敗")
    return 0 if ok else 1


def _swap(root: Path, rel: str, data: bytes) -> Path:
    (root / rel).write_bytes(data)
    return root


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if "--selftest" in argv:
        return selftest()
    if len(argv) != 2 or argv[0].startswith("-"):
        print(__doc__)
        return 2
    slug, ref = argv
    if not SLUG_RE.match(slug):
        raise SystemExit("🔴 回の名前の形が違う（例 short-ep076）")
    if not SHA_RE.match(ref):
        raise SystemExit("🔴 版は40桁の sha で渡す（非公開の倉庫で git rev-parse HEAD）")
    token = os.environ.get(TOKEN_ENV, "").strip()
    if not token:
        raise SystemExit(f"🔴 鍵が無い（この倉庫の Secrets に {TOKEN_ENV} を登録する）")
    t0 = time.time()
    r = fetch(slug, ref, Api(token))
    print(f"✓ 非公開の版 {ref[:7]}：コード {r['code']} ファイルが同じ・{slug} の物 {r['files']} ファイル"
          f"（{r['bytes'] / 1e6:.1f}MB）を取った・{'v2' if r['v2'] else 'v2 でない回'}・API {r['calls']}回・{time.time() - t0:.1f}秒")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
