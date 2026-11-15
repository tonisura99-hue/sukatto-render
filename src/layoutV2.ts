// v2 の配置とカメラの計算（純粋な関数＝React も Remotion も使わない）。2026-11-13 ⑤実装2
// ShortV2.tsx が描くときに使い、tools/test_layout_v2.ts が数字で検査する（npx esbuild で node 用に束ねて回す）。
// 設計書＝非公開のノート（2026-11-13 ③設計・取り入れる42件）の §2-2（カメラ）・§10-2（A-04 の数値）
import type { CharSlot, HeadMeta, CamV2, ShotV2, ShotState } from "./sukattoTypes";

export const W = 1080;
export const H = 1920;
export const FPS_V2 = 30;
export const BAN_H = 400; // 帯（A-01）。この下が絵の見える範囲

// ---------- A-04 顔の大写し（④で決めた数値。④は ShortV2.tsx に置いていた） ----------
export const HEAD_FRAC: Record<number, number> = { 1: 0.55, 2: 0.4 }; // 頭の幅÷画面の幅（3人以上は0.30）
// 右端の操作ボタンを避けて少し左へ。⑬（ep074 台帳 No.4）：2人の左の人のおかっぱの髪が左端で切れた（0.25・押し寄りの終わりで 62px）
//   → 左だけ 0.30 へ（右の人は 0.69 のまま＝右の目の外の端（+0.27倍）が押し寄りの終わりで x916≤920。0.70 では 927）。
//   数字＝analysis/_tools/geom13（本番の関数で絵の不透明の所を画面に置いて測る）：左右の切れ 5px 以下（白い縁の分）・右の人が左の人の目を隠すのは0%（目の周り20px も）
export const HEAD_X: Record<number, number[]> = { 1: [0.5], 2: [0.30, 0.69], 3: [0.18, 0.5, 0.82] };
// 手前に2人目（A-10）がいる時は、奥の人物を左へ寄せる（手前の人物と顔が重ならないように・⑤の案）
// ⑧：手前の人物を内側へ寄せた（FRONT_X）ので、奥の1人も 0.36→0.22 へ（奥の人の右の眼鏡・目を手前の髪で隠さない）。
// ⑬（ep074 台帳 No.3）：0.22 では奥の人の顔が左端で切れた（押し寄りの終わりで 128〜133px・L05 は寄り 1.4倍で 341px＝左目まで）。
//   今の大きさ（奥 616px・手前 594px）では2人の頭が画面の幅に入らず、奥を右へ戻すと手前の髪が奥の右目を隠す（0.34 で 94〜100%）
//   → 手前の人を小さく（FRONT_SCALE 0.84）右へ（FRONT_X 0.70）、奥の人を 0.34 へ。奥の切れ 0px・奥の目の周り20px に重なり0%（geom13）。
//   2人＋手前は ep073・ep074 に無く、焼いて確かめていない（⑤の値のまま）
export const HEAD_X_FRONT: Record<number, number[]> = { 1: [0.34], 2: [0.2, 0.52] };
export const FRONT_SHIFT_FRAMES = 6; // 手前に2人目が入る時、奥の人物は入場（せり上がり6コマ）と同じ長さで横へ動く（⑧：0.36→0.22 で一気に動くと跳んで見える）
export const HEAD_Y_MIN = 1100; // 頭の中心をこれより上に置かない（全身の絵は下へずらし、上半身だけ見せる）
// 頭の中心をこれより下に置かない。背の低い絵を2人で並べると 1515 まで下がった → 下端はそろえたまま絵を大きくする（④の still）
export const HEAD_Y_MAX = 1450;
export const GROW_MAX = 1.25;
export const BOTTOM_PAD = 70; // 絵の下端を画面の下端より下へ（息・揺れ・傾きで下にすき間が出ないように）
export const DEFAULT_HEAD: HeadMeta = { x: 0.5, y: 0.33, w: 0.75, ar: 0.75 }; // 台帳が無いとき（make_episode が ⚠ を出す）

export type Layout = { left: number; top: number; w: number; h: number; hx: number; hy: number; headPx: number };

// withFront＝手前に2人目がいるか（true＝1・false＝0）。0〜1 の数なら、その割合だけ「手前あり」の位置へ動かす（⑧・入場の間なめらかに）
export const charLayout = (slot: CharSlot, count: number, index: number, withFront: boolean | number = false): Layout => {
  const head = slot.head ?? DEFAULT_HEAD;
  const n = Math.max(1, count);
  const frac = HEAD_FRAC[n] ?? 0.3;
  const mix = typeof withFront === "number" ? Math.max(0, Math.min(1, withFront)) : withFront ? 1 : 0;
  const xs0 = HEAD_X[n] ?? Array.from({ length: n }, (_, k) => (k + 0.5) / n);
  const xs1 = HEAD_X_FRONT[n] ?? xs0;
  const xs = xs0.map((x, k) => x + ((xs1[k] ?? x) - x) * mix);
  let headPx = frac * W * (slot.scale ?? 1); // 行ごとの拡大（c の4番目）は掛け算
  let h = headPx / (head.w * head.ar); // 絵の表示の高さ
  const yIfBottom = H + BOTTOM_PAD - h * (1 - head.y); // 下端をそろえたときの頭の中心
  if (yIfBottom > HEAD_Y_MAX) {
    const g = Math.min(GROW_MAX, (H + BOTTOM_PAD - HEAD_Y_MAX) / (1 - head.y) / h);
    h *= g;
    headPx *= g;
  }
  const w = h * head.ar;
  const hx = (slot.flip ? 1 - head.x : head.x) * w; // 絵の中の頭の中心（px）
  const hy = head.y * h;
  let top = H + BOTTOM_PAD - h; // 絵の下端＝画面の下端（体は端で切ってよい）
  if (top + hy < HEAD_Y_MIN) top = HEAD_Y_MIN - hy;
  const left = xs[Math.min(index, xs.length - 1)] * W - hx;
  return { left, top, w, h, hx, hy, headPx };
};

// A-10 手前に2人目（ビート add … front）：右手前に重ねる。顔は奥の人物より下（⑤の still で決めた）
// ⑧（台帳 No.7・14）：⑤の 1.15倍・x0.8 では、手前の人の目が YouTube の右のボタンの列（右端140px＝x≥940）に入り、
//   警察官の顔は画面の端で切れた。顔の右の目の外の端（頭の中心から頭の幅の+0.27倍＝警察官・ep073 の still で測った）が
//   押し寄り（push +7%）の終わりでも x≤920 に収まるよう、大きさ 1.0倍・x0.66 にした
// ⑬：奥の人の顔を画面に入れるため 0.84倍・x0.70（上の HEAD_X_FRONT の注）。右の目の外の端（+0.27倍）は押し寄りの終わりで x915（≤920 を守る）
export const FRONT_SCALE = 0.84;
export const FRONT_X = 0.7;
export const FRONT_Y = HEAD_Y_MAX;
export const frontLayout = (slot: CharSlot, baseCount: number): Layout => {
  const head = slot.head ?? DEFAULT_HEAD;
  const headPx = (HEAD_FRAC[Math.max(1, baseCount)] ?? 0.3) * FRONT_SCALE * W * (slot.scale ?? 1);
  const h = headPx / (head.w * head.ar);
  const w = h * head.ar;
  const hx = (slot.flip ? 1 - head.x : head.x) * w;
  const hy = head.y * h;
  let top = FRONT_Y - hy;
  if (top + h < H + BOTTOM_PAD) top = H + BOTTOM_PAD - h; // 絵の下端（体の切れ目）を画面の中に見せない
  return { left: FRONT_X * W - hx, top, w, h, hx, hy, headPx };
};

// 顔の超大写し（shot:"closeup"）：頭の幅を画面の95%・頭の中心 y1150（④）
// ⑬（ep074 台帳 No.5）：髪の高い絵（私の泣き顔・笑顔）と crash の終わり（+5%）で、頭のてっぺんが字幕の黒い縁の下に 13〜19px 潜った
//   → 1200 へ下げた（crash の寄せ先 CRASH_T も同じ）。ep074 の大写し・crash の頭のてっぺんと字幕の下端（y650）のすき間＝最小 31px（geom13）
// ⑮（ep075）：髪や帽子の高い絵（エプロンの女性・白髪のおばあさん）では、頭の幅を95%にすると頭のてっぺんが字幕の黒い縁の下へ
//   潜った（geom13＝−8〜−70px）→ 行ごとの拡大（c の4番目「配役:表情::0.83」＝slot.scale）を大写しにも掛ける。
//   頭の中心は (W/2, CLOSE_Y) のまま。書かない回は今までと同じ（ep073・ep074 の台本に scale は無い）
export const CLOSE_HEAD = 0.95;
export const CLOSE_Y = 1200;
export const closeLayout = (slot: CharSlot): Layout => {
  const head = slot.head ?? DEFAULT_HEAD;
  const headPx = CLOSE_HEAD * W * (slot.scale ?? 1);
  const h = headPx / (head.w * head.ar);
  const w = h * head.ar;
  const hx = (slot.flip ? 1 - head.x : head.x) * w;
  const hy = head.y * h;
  return { left: W / 2 - hx, top: CLOSE_Y - hy, w, h, hx, hy, headPx };
};

// 手前に2人目が入った割合（0〜1）。frontT0＝手前の人物が足されたコマ（ショットの頭から）。ショットの頭からいる時は1（動かさない）
export const frontMixAt = (frontT0: number | null, frame: number): number => {
  if (frontT0 === null) return 0;
  if (frontT0 <= 0) return 1;
  return easeOut((frame - frontT0) / FRONT_SHIFT_FRAMES);
};

// ---------- A-24・B-24 頭のまわりの印の置き場（⑧で ShortV2.tsx から移した＝検査できる純粋な関数に） ----------
export type MarkSpec = { name: string; count: number; flow: boolean };
export const parseMark = (m: string): MarkSpec => {
  const mm = /^([A-Za-z0-9_]+)(?:\*(\d+))?(~)?$/.exec(m);
  if (!mm) return { name: m, count: 1, flow: false };
  return { name: mm[1], count: Math.max(1, Math.min(8, parseInt(mm[2] ?? "1", 10))), flow: !!mm[3] };
};
// 1つだけの印の置き場：[角度（度・上がマイナス・右が0）, 頭の中心からの距離（頭の幅の倍）, 大きさ（頭の幅の倍）]
export const MARK_ANCHOR: Record<string, [number, number, number]> = {
  anger: [-38, 0.56, 0.3],
  sweat: [-8, 0.58, 0.26],
  fly_sweat: [-8, 0.6, 0.3],
  gloom: [-90, 0.62, 0.5],
  depress: [-90, 0.62, 0.45],
  steam: [-118, 0.62, 0.34],
  sigh: [-150, 0.6, 0.3],
};
export const MARK_DEFAULT: [number, number, number] = [-60, 0.64, 0.3];
// 増える印の置き場（頭の右上の四半分・A-24）。一直線に並ばないよう角度と距離を互い違いに（④の still で直した）
export const MULTI_SLOTS: [number, number][] = [
  [-30, 0.55], [-70, 0.62], [-5, 0.66], [-50, 0.78], [-88, 0.6], [-18, 0.86], [-60, 0.9], [-40, 0.7],
];
export const MARK_STEP = 6; // 1つずつ増える間隔（コマ）＝案（A2 0.4秒で数個・A3 0.6秒で増える＝目視）
// ⑧（台帳 No.5・6）：印は画面の中（右端 x≤1000＝YouTube の右のボタンの列の手前）・字幕の下（y≥700）に収める。
//   crash で頭が画面いっぱいになると、印が画面の右の外で切れ、字幕の行末にかかった（ep073 L2）。
//   PAD＝人物の息・揺れ（±18px×寄り）と脈動（×1.1）の分の余白。大きさは寄っても画面で230px（頭が画面いっぱいの時は190px）まで
export const MARK_SAFE = { x0: 24, x1: 1000, y0: 700, y1: 1640 };
export const MARK_PAD = 24;
export const MARK_MAX = 230;
export const MARK_MAX_BIG = 190;
// 頭が画面いっぱいの時（crash・大写し＝big）は、頭の右上が「!?」の吹き出し（A-21・x590〜1050・y690〜1110）と重なる
//   → 印を頭の左上へ回し（角度を左右に折り返す）、頭の縁の内側（髪・こめかみ）へ寄せる（距離×0.62）
export const BIG_PULL = 0.62;
// ㉑（ep076 台帳 No.2）：手前に2人目（add … front）が入ると、奥の人の頭の右上の印が手前の人の頭の後ろに隠れた
//   （印は奥の人の箱の中で描かれ、手前の人はそのあとに描かれる＝上にかぶる。L04 の怒りの2つ目が約半分・L16 の汗は全部）
//   → fold（0〜1）＝手前の人が入った割合（frontMixAt）だけ、頭の右半分の印の角度を左右に折り返す（右上→左上）。
//   入場の6コマで頭の上（−90°）を通って回る＝一度に跳ばない。半径は変えない（big の BIG_PULL は掛けない）。
//   頭の左半分にもともとある印（steam・sigh）は動かさない。big（crash・大写し）の時は big の折り返しだけ（二重に折り返さない）
// 画面 = s × 世界 + (dx, dy)。ox・oy＝人物の箱の左上（世界の座標）。印の座標は人物の箱の中（左上が0）
export type MarkView = { s: number; dx: number; dy: number; ox: number; oy: number; big?: boolean; fold?: number };
export const foldAngle = (ang: number, fold: number): number => {
  const t = Math.max(0, Math.min(1, fold));
  return ang > -90 ? ang + (-180 - 2 * ang) * t : ang;
};
export type MarkBox = { name: string; mi: number; k: number; cx: number; cy: number; size: number; t: number; flow: boolean };
export const markBoxes = (
  marks: string[], mt0: number[] | undefined, hx: number, hy: number, headPx: number, frame: number, v?: MarkView,
): MarkBox[] => {
  const out: MarkBox[] = [];
  marks.forEach((raw, mi) => {
    const sp = parseMark(raw);
    const multi = sp.count > 1 || sp.flow;
    const [a0, r0, s0] = MARK_ANCHOR[sp.name] ?? MARK_DEFAULT;
    const size0 = Math.min(230, s0 * headPx);
    const start = mt0?.[mi] ?? mi * 4;
    const phase = sp.flow ? Math.floor(frame / 9) : 0;
    for (let k = 0; k < sp.count; k++) {
      let [ang, rad] = multi ? MULTI_SLOTS[(k + phase * 3) % MULTI_SLOTS.length] : [a0 - mi * 40, r0];
      if (v?.big) {
        ang = -180 - ang;
        rad *= BIG_PULL;
      } else if (v?.fold) {
        ang = foldAngle(ang, v.fold);
      }
      const a = (ang * Math.PI) / 180;
      let cx = hx + Math.cos(a) * rad * headPx;
      let cy = hy + Math.sin(a) * rad * headPx;
      let size = size0;
      if (v && v.s > 0) {
        const S = Math.min(size0 * v.s, v.big ? MARK_MAX_BIG : MARK_MAX);
        const half = S * 0.55;
        const X = Math.min(MARK_SAFE.x1 - MARK_PAD - half, Math.max(MARK_SAFE.x0 + half, v.s * (v.ox + cx) + v.dx));
        const Y = Math.min(MARK_SAFE.y1 - half, Math.max(MARK_SAFE.y0 + MARK_PAD + half, v.s * (v.oy + cy) + v.dy));
        cx = (X - v.dx) / v.s - v.ox;
        cy = (Y - v.dy) / v.s - v.oy;
        size = S / v.s;
      }
      out.push({ name: sp.name, mi, k, cx, cy, size, t: start + k * MARK_STEP, flow: sp.flow });
    }
  });
  return out;
};
// 印の画面の上の中心と大きさ（検査用）
export const markOnScreen = (b: MarkBox, v: MarkView) => ({
  X: v.s * (v.ox + b.cx) + v.dx, Y: v.s * (v.oy + b.cy) + v.dy, S: b.size * v.s,
});

// ---------- ショットの中の「今の絵」 ----------
export const segAt = (shot: ShotV2, frame: number): ShotState => {
  let s = shot.segs[0];
  for (const x of shot.segs) {
    if (x.f <= frame) s = x;
    else break;
  }
  return s;
};

export type Pt = [number, number];
export type HeadPos = { label: string; x: number; y: number; w: number; front?: boolean };
// 画面に出ている人物の頭の中心（世界の座標・px）。ShortV2.tsx の ShotViewV2 と同じ選び方
export const stageHeads = (seg: ShotState): HeadPos[] => {
  const chars = seg.chars ?? [];
  const sk = seg.shot;
  if (sk === "closeup") return chars[0] ? [{ label: chars[0].label, x: W / 2, y: CLOSE_Y, w: CLOSE_HEAD * W }] : [];
  if (sk === "insert" || sk === "grid" || sk === "circle" || seg.phone) return [];
  const base = chars.filter((c) => !c.front);
  const fronts = chars.filter((c) => c.front);
  const stage = (sk === "ots" || sk === "anchor") && base.length >= 2 ? base.slice(0, -1) : base;
  const out: HeadPos[] = stage.map((c, i) => {
    const L = charLayout(c, stage.length, i, fronts.length > 0);
    return { label: c.label, x: L.left + L.hx, y: L.top + L.hy, w: L.headPx };
  });
  for (const c of fronts) {
    const L = frontLayout(c, stage.length);
    out.push({ label: c.label, x: L.left + L.hx, y: L.top + L.hy, w: L.headPx, front: true });
  }
  return out;
};

// ---------- カメラ（土台2）。画面 = s × 世界 + (dx, dy)。世界＝絵の世界の層（1080×1920） ----------
export type CamSt = { s: number; dx: number; dy: number };
export const IDENT: CamSt = { s: 1, dx: 0, dy: 0 };
export const VIS_C: Pt = [W / 2, 1160]; // 帯の下の見える範囲の中ほど（画面の弾みの中心・人物がいない時の焦点）
export const CRASH_T: Pt = [W / 2, CLOSE_Y]; // crash・pullout で顔を寄せる画面の位置（大写しと同じ）

// 焦点（世界の点）：配役名ならその頭・座標ならその点・書かなければ主役（1人ならその顔・2人以上は奥の人物の顔の中ほど）
// w＝焦点の頭の幅（世界の px）。crash・pullout が「大写しの大きさ」を決めるのに使う（人物がいなければ大写しと同じ幅とみなす）
export const focusHead = (cam: CamV2, seg: ShotState): { P: Pt; w: number } => {
  if (Array.isArray(cam.to)) return { P: [cam.to[0] * W, cam.to[1] * H], w: CLOSE_HEAD * W };
  const heads = stageHeads(seg);
  if (typeof cam.to === "string") {
    const hit = heads.find((h) => h.label === cam.to);
    if (hit) return { P: [hit.x, hit.y], w: hit.w };
  }
  const base = heads.filter((h) => !h.front);
  const use = base.length ? base : heads;
  if (!use.length) return { P: VIS_C, w: CLOSE_HEAD * W };
  const avg = (k: "x" | "y" | "w") => use.reduce((a, h) => a + h[k], 0) / use.length;
  return { P: [avg("x"), avg("y")], w: avg("w") };
};
export const focusPoint = (cam: CamV2, seg: ShotState): Pt => focusHead(cam, seg).P;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// 動きの緩急（イージング）：easeOut＝最初が速くだんだん遅く／easeInOut＝ゆっくり始まりゆっくり止まる
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const screenOf = (c: CamSt, P: Pt): Pt => [c.s * P[0] + c.dx, c.s * P[1] + c.dy];
// 世界の点 P を画面の Q に、拡大率 s で置くカメラ
const place = (s: number, P: Pt, Q: Pt): CamSt => ({ s, dx: Q[0] - s * P[0], dy: Q[1] - s * P[1] });
// 2つのカメラの間：拡大率は線形・P の画面の位置はまっすぐ動く
const between = (a: CamSt, b: CamSt, P: Pt, e: number): CamSt => {
  const qa = screenOf(a, P);
  const qb = screenOf(b, P);
  return place(lerp(a.s, b.s, e), P, [lerp(qa[0], qb[0], e), lerp(qa[1], qb[1], e)]);
};

// 既定の数値＝設計書 §2-2 の表（A2・B3・B5・A4・A5 の実測と目測から）
// crash・pullout の倍率は、数を書かなければ「焦点の頭が大写し（画面の幅の95%）の大きさになる倍率」（最低1.3倍）。
//   ⑤の still：×2.2 の決め打ちは1人の並び（頭55%）から頭121%＝元の絵の約3.3倍の拡大になり、大写し（約2.6倍）より粗い → 変えた
export const CAM_DEFAULT = {
  push: 0.07, push_close: 0.05,
  rush: 0.4, rush_sec: 1.3,
  settle_wait: 9, settle_frames: 22, settle: 0.055,
  crash_frames: 4, crash_after: 0.05,
  pullout_frames: 6,
  close_min: 1.3,
  steps_every: 15, steps_step: 1.15, steps_max: 3,
};

// t＝カメラの頭からのコマ・span＝カメラの頭からショットの尻まで・st0＝カメラの頭のときの状態（前のカメラから続く）
// P＝焦点（世界の点）・headW＝焦点の頭の幅（世界の px）
export const evalCam = (c: CamV2, st0: CamSt, t: number, span: number, P: Pt, headW: number = CLOSE_HEAD * W): CamSt => {
  const Q0 = screenOf(st0, P);
  const D = CAM_DEFAULT;
  const toClose = Math.max(D.close_min, (CLOSE_HEAD * W) / (st0.s * headW)); // 大写しの大きさまでの倍率
  switch (c.kind) {
    case "hold":
      return st0;
    case "push": {
      // ショットの長さで等速に寄る（A-15）。焦点は画面の同じ位置に止めたまま
      const a = c.amount ?? D.push;
      return place(st0.s * (1 + a * (span > 0 ? clamp01(t / span) : 0)), P, Q0);
    }
    case "rush": {
      // 一気に等速で寄って止まる（B-09a）
      const a = c.amount ?? D.rush;
      const n = Math.max(1, Math.round((c.sec ?? D.rush_sec) * FPS_V2));
      return place(st0.s * (1 + a * clamp01(t / n)), P, Q0);
    }
    case "settle": {
      // 待つ→寄る→止まる（B-09b）
      const w = c.wait ?? D.settle_wait;
      const n = c.frames ?? D.settle_frames;
      const a = c.amount ?? D.settle;
      return place(st0.s * (1 + a * easeInOut((t - w) / n)), P, Q0);
    }
    case "crash": {
      // 数コマで顔へ一気に（A-11）→ 顔を画面の CRASH_T へ寄せ、その後もショットの尻まで +5%
      const a = c.amount ?? toClose;
      const n = c.frames ?? D.crash_frames;
      const end = place(st0.s * a, P, CRASH_T);
      if (t < n) return between(st0, end, P, easeOut(t / n));
      const rest = span - n;
      return place(end.s * (1 + D.crash_after * (rest > 0 ? clamp01((t - n) / rest) : 0)), P, CRASH_T);
    }
    case "pullout": {
      // 顔いっぱいから引いて手元を見せる（A-12）：頭のコマで顔に寄った絵（大写しの大きさ）→ 数コマで元のカメラへ
      const a = c.amount ?? toClose;
      const n = c.frames ?? D.pullout_frames;
      return between(place(st0.s * a, P, CRASH_T), st0, P, easeOut(t / n));
    }
    case "steps": {
      // 0.5秒ごとに一段寄る（A-16）。段は1コマで替える
      const ev = c.every ?? D.steps_every;
      const k = c.step ?? D.steps_step;
      const m = c.max ?? D.steps_max;
      return place(st0.s * Math.pow(k, Math.min(m, Math.floor(t / ev))), P, Q0);
    }
  }
  return st0;
};

// 寄ったとき（s≧1）は絵の世界の層が画面を覆うように止める（帯の下＝y400 より下に端を見せない）
export const clampCam = (c: CamSt): CamSt => {
  if (c.s < 1) return c;
  return {
    s: c.s,
    dx: Math.min(0, Math.max(W - c.s * W, c.dx)),
    dy: Math.min(BAN_H, Math.max(H - c.s * H, c.dy)),
  };
};

// B-15 画面の弾み：5コマごとに 1.04 と 0.97 を交互・33コマ（B2 の実測から・拡大率に掛け算）
export const BOUNCE_F = [0, 5, 10, 15, 20, 25, 30, 33];
export const BOUNCE_V = [1, 1.04, 0.97, 1.04, 0.97, 1.04, 0.97, 1];
export const bounceAt = (t: number): number => {
  if (t < 0 || t >= BOUNCE_F[BOUNCE_F.length - 1]) return 1;
  let i = 0;
  while (BOUNCE_F[i + 1] <= t) i++;
  return lerp(BOUNCE_V[i], BOUNCE_V[i + 1], (t - BOUNCE_F[i]) / (BOUNCE_F[i + 1] - BOUNCE_F[i]));
};

export const camAt = (shot: ShotV2, frame: number): CamSt => {
  const cams: CamV2[] = shot.cams && shot.cams.length ? shot.cams : [{ f: 0, kind: "push" }];
  let st = IDENT;
  for (let k = 0; k < cams.length; k++) {
    const c = cams[k];
    if (c.f > frame) break;
    const next = k + 1 < cams.length ? cams[k + 1].f : Infinity;
    const fh = focusHead(c, segAt(shot, c.f));
    st = evalCam(c, st, Math.min(frame, next) - c.f, shot.dur - c.f, fh.P, fh.w);
  }
  st = clampCam(st);
  let b = 1;
  for (const bf of shot.bounce ?? []) b *= bounceAt(frame - bf);
  if (b !== 1) st = { s: st.s * b, dx: VIS_C[0] * (1 - b) + b * st.dx, dy: VIS_C[1] * (1 - b) + b * st.dy };
  return st;
};
