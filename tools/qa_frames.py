# -*- coding: utf-8 -*-
"""qa_frames.py — 検品で見るコマの表を cuts.json から機械で作る（㉒ P4・2026-11-15）

■ 決まり（⑲ が手で作った「⑳で見るコマの表」33コマ〈ep076〉を、cuts.json の shots と突き合わせて読み取った）
  見る単位＝「絵の状態」＝ショット（shots）の中の区切り（segs）。背景だけが替わる点滅（bgflash）の区切りは1つにまとめる。
  状態ごとに1コマ（下の順で決める）：
    1. 寄り（shot=insert）の最初の状態 … 頭から11コマ目＝出るときの弾みの山（小物が字幕にいちばん近いコマ・⑰）
    2. crash のカメラのショットの最初の状態 … 頭から6コマ目（寄りの途中）。状態が1つだけなら8割の所（寄りきったあと）も
    3. せり上がり（anim=rise）で始まる状態 … 頭から6コマ目（途中）＋7割の所
    4. それ以外 … 状態の6割の所（手前の人の入場〈6コマ〉が済んで、絵が落ち着いた所）
  どの行も1コマ以上。上限（既定33＝1チャット40枚のうち7枚は拡大の切り出し用）を超える時は、
  前に選んだのと同じ構図（背景・人物と表情と手前・小物・寄り）の状態から落とす。
  ⚠️ 機械は「見る所」（新しい小物・新しい表情・直した所）を知らない＝表の「見る所」の列は手がかりだけ。
     直したコマ・新しい部品は、見るセッションが表に足す（上限40の残り7）。

■ 使い方
  python -B tools/qa_frames.py <slug> [--max 33] [--out out/qa/<slug>/frames.tsv]
      作業ツリーの episodes/<slug>/cuts.json を読む。表＝TSV（1列目がコマ＝tools/stills_v2.mjs の @表 にそのまま渡せる）
  python -B tools/qa_frames.py --compare <表.tsv> <コマ,コマ,…>   … 手の表と機械の表の重なり
  python -B tools/qa_frames.py --selftest
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
INSERT_PEAK = 11
CRASH_MID = 6
RISE_MID = 6


def line_starts(cuts: dict) -> list[int]:
    """行の頭のコマ（make_episode と同じ round(durSec*30) の積み上げ）。"""
    out, f = [], 0
    for c in cuts["cuts"]:
        out.append(f)
        f += round(c["durSec"] * FPS)
    out.append(f)
    return out


def _who(state: dict) -> tuple:
    return tuple(sorted((c.get("label", ""), Path(c.get("asset", "")).stem, bool(c.get("front"))) for c in state.get("chars", [])))


def _marks(state: dict) -> tuple:
    return tuple(sorted((c.get("label", ""), m) for c in state.get("chars", []) for m in (c.get("marks") or [])))


EVENT_ANIMS = {"lunge", "shakebody", "zoom", "rise", "burstin", "recoil"}


def _deco(state: dict) -> tuple:
    return tuple(sorted(Path(d.get("img", "")).stem for d in state.get("deco") or []))


def states(cuts: dict) -> list[dict]:
    """ショットの区切りを「絵の状態」に。背景だけが替わる区切りは前とまとめる。"""
    out = []
    for si, s in enumerate(cuts.get("shots", [])):
        segs = s["segs"]
        crash = any(c.get("kind") == "crash" and c.get("f", 0) == 0 for c in s.get("cams", []))
        merged = []
        for k, g in enumerate(segs):
            f0 = s["from"] + g["f"]
            f1 = s["from"] + (segs[k + 1]["f"] if k + 1 < len(segs) else s["dur"])
            key = (g.get("shot") or "-", _who(g), _deco(g))
            if merged and merged[-1]["key"] == key:
                merged[-1]["f1"] = f1  # 背景だけ替わった（点滅）＝同じ状態
                merged[-1]["bgs"].add(g["bg"])
                continue
            merged.append({"shot_i": si, "seg_i": k, "f0": f0, "f1": f1, "key": key, "kind": g.get("shot") or "-",
                           "bg": g["bg"], "bgs": {g["bg"]}, "who": _who(g), "deco": _deco(g), "marks": _marks(g),
                           # せり上がりは人物が遅れて出ることがある（背景が先＝t0>0・ep076 L12 は t0=6）
                           "rise": any(c.get("anim") == "rise" for c in g.get("chars", []) if not c.get("front")),
                           "event": any(c.get("anim") in EVENT_ANIMS for c in g.get("chars", [])),
                           "front_in": any(c.get("front") for c in g.get("chars", []))
                           and not (merged and any(fr for _, _, fr in merged[-1]["who"])),
                           "first": k == 0, "crash": crash, "lines": s.get("lines") or []})
        out += merged
    return out


def pick(cuts: dict, max_n: int = 33) -> list[dict]:
    starts = line_starts(cuts)
    nl = len(cuts["cuts"])

    def line_of(f):
        return max(i for i in range(nl) if starts[i] <= f) + 1

    cand = []
    all_states = states(cuts)
    for st in all_states:
        n = st["f1"] - st["f0"]
        frames = []
        if st["kind"] == "insert" and st["first"]:
            frames.append((min(INSERT_PEAK, n - 1), "寄りの弾みの山（頭+11）"))
        elif st["crash"] and st["first"]:
            frames.append((min(CRASH_MID, n - 1), "crash の途中（頭+6）"))
            if sum(1 for x in all_states if x["shot_i"] == st["shot_i"]) == 1:  # 状態が1つだけ＝寄りきったあとも見る
                frames.append((int(round(n * 0.8)), "crash の寄りきったあと（8割）"))
        elif st["rise"] and st["first"]:
            frames += [(min(RISE_MID, n - 1), "せり上がりの途中（頭+6）"), (int(round(n * 0.7)), "せり上がりのあと（7割）")]
        else:
            frames.append((int(round(n * 0.6)), "状態の6割"))
        for off, why in frames:
            f = st["f0"] + max(0, min(off, n - 1))
            cand.append({"frame": f, "line": line_of(f), "why": why, "state": st})
    cand.sort(key=lambda c: c["frame"])
    # 上限を超えたら、新しい物が何も無い状態（背景・人物の表情・小物・印がどれも前に出ていて、手前の人の入場も
    # 動き〈飛び込み・震え など〉も行の飾り〈手書きの字・「!?」・キメ・光〉も無い）の「6割」のコマから、後ろの方を先に落とす。
    # 寄り（insert）の絵は小物が主役＝人物を「見た」に数えない。行ごとに1コマは残す
    seen_bg, seen_who, seen_deco, seen_mark, dup = set(), set(), set(), set(), []
    for c in cand:
        st = c["state"]
        cut = cuts["cuts"][c["line"] - 1]
        who = {(lab, ex) for lab, ex, _ in st["who"]} if st["kind"] != "insert" else set()
        new = ((st["bg"] not in seen_bg and st["kind"] != "insert") or not who <= seen_who
               or not set(st["deco"]) <= seen_deco or not set(st["marks"]) <= seen_mark
               or st["front_in"] or st["event"] or any(cut.get(k) for k in ("lettering", "bigmark", "punch", "flash")))
        if not new and c["why"] == "状態の6割":
            dup.append(c)
        if st["kind"] != "insert":
            seen_bg.add(st["bg"])
        seen_who |= who
        seen_deco |= set(st["deco"])
        seen_mark |= set(st["marks"])
    for c in reversed(dup):
        if len(cand) <= max_n:
            break
        if sum(1 for x in cand if x["line"] == c["line"]) > 1:
            cand.remove(c)
    if len(cand) > max_n:  # まだ多い＝落としてよい順（短い状態の6割→寄りきったあと・せり上がりのあと→その他）。行ごとに1コマは残す
        order = {"状態の6割": 0, "crash の寄りきったあと（8割）": 1, "せり上がりのあと（7割）": 1}
        for c in sorted(cand, key=lambda c: (order.get(c["why"], 2), c["state"]["f1"] - c["state"]["f0"])):
            if len(cand) <= max_n:
                break
            if sum(1 for x in cand if x["line"] == c["line"]) > 1:
                cand.remove(c)
    if len(cand) > max_n:
        print(f"⚠️ 行の数が上限より多い＝{len(cand)}コマ（上限 {max_n}）", file=sys.stderr)
    missing = [i for i in range(1, nl + 1) if not any(c["line"] == i for c in cand)]
    if missing:
        raise SystemExit(f"🔴 コマが1つも無い行がある: {missing}（shots と行の対応を確かめる）")
    return cand


def describe(c: dict, cuts: dict) -> str:
    st = c["state"]
    cut = cuts["cuts"][c["line"] - 1]
    who = "・".join(f"{lab}:{expr}{'（手前）' if fr else ''}" for lab, expr, fr in st["who"]) or "人物なし"
    bg = "／".join(sorted(b.split("/")[-1].replace(".png", "") for b in st["bgs"]))
    extra = [k for k in ("lettering", "bigmark", "punch", "flash") if cut.get(k)]
    deco = ("小物 " + "・".join(st["deco"])) if st["deco"] else ""
    return " ".join(x for x in (st["kind"] if st["kind"] != "-" else "", bg, who, deco, " ".join(extra)) if x)


def write_table(slug: str, cand: list[dict], cuts: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"# {slug} の検品のコマの表（tools/qa_frames.py・{len(cand)}コマ・30fps・コマは0から）",
             "# コマ\t秒\t行\t選んだ理由\t絵（ショットの状態）"]
    for k, c in enumerate(cand, 1):
        lines.append(f"{c['frame']}\t{c['frame'] / FPS:.2f}\tL{c['line']:02d}\t{c['why']}\t{describe(c, cuts)}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def compare(table: Path, hand: list[int], tol: int = 4) -> dict:
    mach = [int(l.split("\t")[0]) for l in table.read_text(encoding="utf-8").splitlines() if l and not l.startswith("#")]
    hit = [h for h in hand if any(abs(h - m) <= tol for m in mach)]
    return {"machine": len(mach), "hand": len(hand), f"within_{tol}": len(hit),
            "hand_only": [h for h in hand if h not in hit],
            "machine_only": [m for m in mach if not any(abs(h - m) <= tol for h in hand)]}


def selftest() -> int:
    ok = True

    def check(name, got, want):
        nonlocal ok
        good = got == want
        ok &= good
        print(f"  {'✓' if good else '✗'} {name}" + ("" if good else f"\n      得た {got}\n      期待 {want}"))

    ch = lambda lab, ex, front=False, anim=None: {"label": lab, "asset": f"assets/char/{lab}/{ex}.png", "front": front,
                                                   **({"anim": anim} if anim else {})}
    cuts = {"cuts": [{"durSec": 1.0}, {"durSec": 1.0}, {"durSec": 1.0}, {"durSec": 1.0}], "shots": [
        {"from": 0, "dur": 30, "lines": [1], "cams": [{"f": 0, "kind": "push"}],
         "segs": [{"f": 0, "shot": "insert", "bg": "assets/bg/a.png", "chars": [ch("w", "pale")], "deco": [{"img": "assets/prop/p.png"}]}]},
        {"from": 30, "dur": 30, "lines": [1, 2], "cut": True, "cams": [{"f": 0, "kind": "crash"}],
         "segs": [{"f": 0, "bg": "abstract:lightning", "chars": [ch("o", "angry")]}]},
        {"from": 60, "dur": 30, "lines": [3], "cams": [{"f": 0, "kind": "push"}],
         "segs": [{"f": 0, "bg": "assets/bg/a.png", "chars": [ch("o", "angry")]},
                  {"f": 12, "bg": "abstract:burst_gold", "chars": [ch("o", "angry")]},
                  {"f": 20, "bg": "assets/bg/a.png", "chars": [ch("o", "angry"), ch("w", "laugh", True)]}]},
        {"from": 90, "dur": 30, "lines": [4], "cams": [{"f": 0, "kind": "push"}],
         "segs": [{"f": 0, "bg": "abstract:flame_red", "chars": [ch("o", "pale", anim="rise")]}]},
    ]}
    check("行の頭", line_starts(cuts), [0, 30, 60, 90, 120])
    st = states(cuts)
    check("背景だけ替わる区切りはまとめる（3つ目のショットは2状態）", [(s["f0"], s["f1"]) for s in st if s["shot_i"] == 2],
          [(60, 80), (80, 90)])
    got = [(c["frame"], c["why"]) for c in pick(cuts, 33)]
    check("寄り=頭+11・crash=頭+6 と8割・6割・せり上がり=頭+6 と7割", got, [
        (11, "寄りの弾みの山（頭+11）"), (36, "crash の途中（頭+6）"), (54, "crash の寄りきったあと（8割）"),
        (72, "状態の6割"), (86, "状態の6割"), (96, "せり上がりの途中（頭+6）"), (111, "せり上がりのあと（7割）")])
    small = pick(cuts, 5)
    check("上限で落としても行ごとに1コマ以上", sorted({c["line"] for c in small}), [1, 2, 3, 4])
    check("上限を守る", len(small) <= 5, True)
    print("✓ selftest 通過" if ok else "✗ selftest 失敗")
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if "--selftest" in argv:
        return selftest()
    if argv[:1] == ["--compare"]:
        print(json.dumps(compare(Path(argv[1]), [int(x) for x in argv[2].split(",")]), ensure_ascii=False))
        return 0
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    slug = argv[0]
    max_n = int(argv[argv.index("--max") + 1]) if "--max" in argv else 33
    out = Path(argv[argv.index("--out") + 1]) if "--out" in argv else ROOT / "out" / "qa" / slug / "frames.tsv"
    cuts = json.loads((ROOT / "episodes" / slug / "cuts.json").read_text(encoding="utf-8"))
    if cuts.get("style") != "v2" or not cuts.get("shots"):
        raise SystemExit("🔴 v2 の回（shots のある cuts.json）だけ")
    cand = pick(cuts, max_n)
    write_table(slug, cand, cuts, out)
    print(f"{out}（{len(cand)}コマ）")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
