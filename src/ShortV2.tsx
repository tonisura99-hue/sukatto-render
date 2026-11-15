// 縦型ショート v2（競合の映像分析から作った新しい型）。④実装1・⑤実装2（2026-11-13）。
// script.json の "style": "v2" → cuts.json の "style" がある回だけに効く（切り替え式）。
// SukattoShort（今の描き方）は v2 でない回と共用＝既定を変えないため、v2 の部品はこのファイルに足す。
// 設計書＝非公開のノート（2026-11-13 ③設計・取り入れる42件）の §2-0〜§2-3・§3・§10
// ④で入れた物（順1）：A-01 帯／B-01 帯の2段目／B-02・B-03 字幕と色／A-03 字幕を1コマで替える／B-05 白フチ／
//   A-04 顔の大きさと下端／A-09 せり上がり（rise）／B-19 白黒（bw）／B-12 暗転（trans black）／
//   A-21「!?」の吹き出し／A-24 怒りマークが増える（anger*N）／A-31 小物の間隔
// ⑤で入れた物（順2・3）：
//   土台1 ショットとビート＝cuts.json の "shots"（tools/shots_v2.py が作る）。A-03 切り離し（cont）・A-05 行の途中で絵を替える・
//     A-10 手前に2人目（add front）・A-13 背景が先（bgfirst）・A-19 表情の差し替え（face）・B-11 周りを消す（only）・B-18 背景の点滅
//   土台2 カメラ＝src/layoutV2.ts（push 既定・settle・rush・crash・pullout・steps・hold＋画面の弾み bounce）。
//     A-14 動き続ける＝集中線を2コマごとに描き直す・怒りの顔は細かく震える。交互の常時カメラ・背景の寄り・大写しの寄りは v2 では消した
// 描き方：ショットの列（絵の世界＝背景・人物・小物・印・転換。カメラで動く）と、行の列（字幕・効果音・画面に固定の飾り）を
//   別々の Sequence に並べ、2つを包む一番外の層で行の揺れ（shake・punch）を掛ける（設計書 §2-1 の5）
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Cut, ShotChar, ShotDeco, ShotState, ShotV2 } from "./sukattoTypes";
import type { ShortBannerInfo } from "./SukattoVideo";
import {
  FPS,
  FONT,
  SukattoShort,
  Background,
  charFilter,
  MARK_FILE,
  ThoughtBubble,
  ShortCircle,
  ShortInsert,
  PhoneChat,
  OnomatopoeiaText,
  ParticleOverlay,
  TINT_STYLE,
  SpeedLines,
  ShortAnchor,
  ShortOccluder,
} from "./SukattoVideo";
import { W, H, VIS_C, camAt, charLayout, closeLayout, frontLayout, frontMixAt, markBoxes, segAt } from "./layoutV2";
import type { MarkView, Pt } from "./layoutV2";

// 字の幅の見積もり（全角＝1字・半角＝0.55字）。SVG の字は折り返さないので、はみ出す行だけ textLength で縮める
const textUnits = (s: string) =>
  [...s].reduce((n, ch) => n + (/[ -~｡-ﾟ]/.test(ch) ? 0.55 : 1), 0);

// ---------- B-05 白フチ（SVG のフィルタ。縁を太らせて白で塗り、絵の下に敷く） ----------
const OUTLINE_PX = 7; // B の実測 6〜8px
// 範囲＝絵の箱ぴったり（x=0 y=0 幅1 高さ1）。絵の端で切れている体（胸の下など）に白い帯が出ないように
const OutlineDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <defs>
      <filter id="v2-outline" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius={OUTLINE_PX} result="fat" />
        <feFlood floodColor="#ffffff" result="white" />
        <feComposite in="white" in2="fat" operator="in" result="ring" />
        <feMerge>
          <feMergeNode in="ring" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);
// 変身のフィルタ（黒いシルエット・石化）の後に白フチ。モブ減彩（ghost）は薄くしたいので付けない。影は弱めて残す
// 描画時間（④で実測・150コマ・concurrency 2・この PC）：白フチなし 43秒／この SVG の白フチ 142秒／
//   ぼかしなしの白い影を8回重ねる案 507秒（やめた）。1本 約930コマで手元 約+10分
const charFilterV2 = (slot: ShotChar): string =>
  [charFilter(slot) ?? "", slot.ghost ? "" : "url(#v2-outline)", "drop-shadow(0 8px 14px rgba(0,0,0,0.35))"]
    .filter(Boolean)
    .join(" ");

// 絵が無いとき（表情の絵の欠け）は normal に替える。行の途中で表情が替わる（face）ので、状態は「どの絵で失敗したか」だけ持つ
const useCharSrc = (asset: string | undefined, fallbackName: string) => {
  const [failed, setFailed] = React.useState<string | null>(null);
  const fallback = asset ? asset.replace(/[^/]+\.png$/, fallbackName) : undefined;
  const src = asset && failed === asset ? fallback : asset;
  const onError = () => {
    if (asset && fallback && fallback !== asset) setFailed(asset);
  };
  return { src, onError };
};

// ---------- A-01 帯（全幅の黒帯・一度も動かない）＋ B-01 2段目は5〜8字 ----------
const BAN_H = 400; // A 0〜396・B 0〜417（実測）

// 帯の字体（2026-11-13 ⑥ 見直し「タイトルのデザインが競合に劣る。フォントや色を工夫する」）。
// OFL（SIL Open Font License＝商用でも使えるフリーの字体）の字体を public/fonts に置き、焼きの中で読み込む＝手元とクラウドで同じ字形。
// 読み込むのは v2 の帯が出る時だけ（v2 でない回の焼きには触らない）。読めなければ焼きを止める（黙って別の字体に落とさない）
// [字体の名前, public の中の置き場, 太さ（無い＝ふつうの太さ）]
const V2_FONT_FILES: [string, string, string?][] = [
  ["V2Dela", "fonts/DelaGothicOne-Regular.ttf"],
  ["V2Reggae", "fonts/ReggaeOne-Regular.ttf"],
  // ㉒ P1（2026-11-15）字幕・手書きの字・「!?」の字体。クラウド（Actions の ubuntu-26.04＋fonts-noto-cjk 1:20240730＝
  //   Regular と Bold だけ）が今まで使っていたのと同じ Noto Sans CJK JP の Bold（2.004・notofonts/noto-cjk）を、帯と同じく焼きの中で読む
  //   ＝手元（Windows は Yu Gothic UI になっていた）・Actions・Modal で同じ字形。
  //   ⚠️ 太さ 700 を書く：書かないと「ふつうの太さの字」と見なされ、900 を頼むと Chrome が太字を作り足して（synthetic bold）形が変わる
  ["V2Noto", "fonts/NotoSansCJKjp-Bold.otf", "700"],
];
let v2FontsPromise: Promise<void> | null = null;
const loadV2Fonts = () => {
  if (!v2FontsPromise) {
    v2FontsPromise = Promise.all(
      V2_FONT_FILES.map(([fam, file, weight]) =>
        new FontFace(
          fam,
          `url('${staticFile(file)}') format('${file.endsWith(".otf") ? "opentype" : "truetype"}')`,
          weight ? { weight } : undefined,
        ).load().then((f) => {
          // この TypeScript の DOM の型定義には FontFaceSet.add が無い（Chrome には有る）ので型だけ明示する
          (document.fonts as unknown as { add: (ff: FontFace) => void }).add(f);
        }),
      ),
    ).then(() => undefined);
  }
  return v2FontsPromise;
};
const useV2Fonts = () => {
  const [handle] = React.useState(() => delayRender("v2 の帯の字体を読み込む"));
  React.useEffect(() => {
    loadV2Fonts()
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle]);
};

// 帯の見た目の型。層（layers）は外から順に描く：光の輪（ぼかし）→ 外の縁 → 内の縁。その上に縦のグラデーションの塗りと、上半分の光沢
// w＝字の大きさに対する線の太さ（線は字の輪郭の内と外に半分ずつ出る。内側の半分は塗りの下に隠れる）
type BanLayer = { color: string; w: number; blur?: number; op?: number };
type BanLineLook = { family: string; weight?: number; size: number; base: number; fill: string[]; layers: BanLayer[]; shine?: number };
type BanLook = { label: string; bg: string; rule?: string; l1: BanLineLook; l2: BanLineLook };
const DELA = `'V2Dela',${FONT}`;
const REGGAE = `'V2Reggae',${FONT}`;
// 字幕・手書きの字・「!?」（㉒ P1）。後ろの FONT は、この字体に無い字（絵文字など）だけに使われる
const SUB_FONT = `'V2Noto',${FONT}`;
const RED_FILL = ["#ffe1e1", "#ff4040", "#d6000f", "#8f0008"];
const RED_LAYERS: BanLayer[] = [
  { color: "#ff1f1f", w: 0.42, blur: 16, op: 0.75 },
  { color: "#120000", w: 0.3 },
  { color: "#ffffff", w: 0.15 },
];
const DARK_BG = "linear-gradient(180deg, #1a0303 0%, #070000 70%, #000000 100%)";
const OLD_FILL = ["#cd7479", "#ef161a", "#b32528"];
const OLD_LAYERS: BanLayer[] = [{ color: "#640f13", w: 0.2, blur: 9 }, { color: "#faeae9", w: 0.09 }];
export const BANNER_LOOKS: Record<string, BanLook> = {
  // ④の帯（A の配置と色の型・字体はパソコンの字体＝手元 Yu Gothic UI／クラウド Noto Sans CJK）
  old: {
    label: "いま（④）", bg: "#0b0101",
    l1: { family: FONT, weight: 900, size: 150, base: 178, fill: OLD_FILL, layers: OLD_LAYERS },
    l2: { family: FONT, weight: 900, size: 118, base: 330, fill: OLD_FILL, layers: OLD_LAYERS },
  },
  red: {
    label: "A 赤・極太", bg: DARK_BG, rule: "#ff2a2a",
    l1: { family: DELA, size: 152, base: 180, fill: RED_FILL, layers: RED_LAYERS, shine: 0.55 },
    l2: { family: DELA, size: 126, base: 352, fill: RED_FILL, layers: RED_LAYERS, shine: 0.55 },
  },
  goldred: {
    label: "B 金（ロゴの字体）＋白赤", bg: DARK_BG, rule: "#ffb000",
    l1: {
      family: REGGAE, size: 150, base: 178, fill: ["#fffbe0", "#ffd84a", "#ff9e00", "#c96a00"],
      layers: [{ color: "#ffb000", w: 0.4, blur: 14, op: 0.6 }, { color: "#2b1000", w: 0.3 }, { color: "#fff3c4", w: 0.13 }], shine: 0.5,
    },
    l2: {
      family: DELA, size: 126, base: 352, fill: ["#ffffff", "#fff2f2", "#ffd6d6"],
      layers: [{ color: "#ff1a1a", w: 0.46, blur: 16, op: 0.85 }, { color: "#000000", w: 0.34 }, { color: "#e3001b", w: 0.2 }],
    },
  },
  telop: {
    label: "C 白＋黄色のテロップ", bg: DARK_BG, rule: "#ffe600",
    l1: {
      family: DELA, size: 150, base: 178, fill: ["#ffffff", "#f2f2f2", "#d9d9d9"],
      layers: [{ color: "#000000", w: 0.3 }, { color: "#e60012", w: 0.16 }],
    },
    l2: {
      family: DELA, size: 130, base: 354, fill: ["#fffbd1", "#ffe600", "#ffb300"],
      layers: [{ color: "#ff3300", w: 0.44, blur: 14, op: 0.7 }, { color: "#000000", w: 0.32 }, { color: "#c4001a", w: 0.17 }], shine: 0.45,
    },
  },
  reggae: {
    label: "D ロゴの字体で赤", bg: DARK_BG, rule: "#ff2a2a",
    l1: { family: REGGAE, size: 156, base: 182, fill: RED_FILL, layers: RED_LAYERS, shine: 0.55 },
    l2: { family: REGGAE, size: 128, base: 352, fill: RED_FILL, layers: RED_LAYERS, shine: 0.55 },
  },
};
// v2 の帯の既定＝C 白＋黄色のテロップ（2026-11-13 ⑥ 見比べの画像から選んだ）。ほかの型は見比べ用に残す
export const BANNER_LOOK_DEFAULT = "telop";

const BannerLineV2: React.FC<{ id: string; text: string; look: BanLineLook }> = ({ id, text, look }) => {
  const maxW = 1010;
  const { size } = look;
  const fit = textUnits(text) * size > maxW ? { textLength: maxW, lengthAdjust: "spacingAndGlyphs" as const } : {};
  const common = {
    x: W / 2, y: look.base, textAnchor: "middle" as const,
    fontFamily: look.family, fontWeight: look.weight ?? 400, fontSize: size, ...fit,
  };
  const n = look.fill.length;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          {look.fill.map((c, i) => <stop key={i} offset={`${n > 1 ? (i / (n - 1)) * 100 : 0}%`} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={look.shine ?? 0} />
          <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        {look.layers.map((L, i) =>
          L.blur ? (
            <filter key={i} id={`${id}-blur${i}`} x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation={L.blur} />
            </filter>
          ) : null,
        )}
      </defs>
      {look.layers.map((L, i) => (
        <text key={i} {...common} fill={L.color} stroke={L.color} strokeWidth={size * L.w} strokeLinejoin="round"
          opacity={L.op ?? 1} filter={L.blur ? `url(#${id}-blur${i})` : undefined}>
          {text}
        </text>
      ))}
      <text {...common} fill={`url(#${id}-fill)`}>{text}</text>
      {look.shine ? <text {...common} fill={`url(#${id}-shine)`}>{text}</text> : null}
    </>
  );
};
const BannerBand: React.FC<{ look: BanLook; series: string; ep: string; idp: string }> = ({ look, series, ep, idp }) => (
  <>
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: BAN_H, background: look.bg }} />
    {look.rule ? (
      <div style={{ position: "absolute", left: 0, top: BAN_H - 6, width: W, height: 6, background: look.rule, boxShadow: `0 0 18px ${look.rule}` }} />
    ) : null}
    <svg width={W} height={BAN_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <BannerLineV2 id={`${idp}-1`} text={series} look={look.l1} />
      <BannerLineV2 id={`${idp}-2`} text={ep} look={look.l2} />
    </svg>
  </>
);
const ShortBannerV2: React.FC<ShortBannerInfo & { quipTimeline?: { from: number; quip: string }[] }> = ({
  series, episode, quip, quipTimeline,
}) => {
  useV2Fonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let activeQuip = quip ?? "";
  let quipFrom = 0;
  for (const seg of quipTimeline ?? []) {
    if (frame >= seg.from) { activeQuip = seg.quip; quipFrom = seg.from; }
  }
  const quipPop = spring({ frame: frame - quipFrom - 18, fps, config: { damping: 11, stiffness: 140 } });
  const ep = (episode ?? "").replace(/\n/g, ""); // v2 の2段目は1行（B-01・門番で5〜8字）
  return (
    // zIndex 10＝帯は行の飾り（zIndex 4〜6）や白い光より必ず上（A-01「帯は一度も動かない」・⑧）
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: BAN_H, zIndex: 10 }}>
      <BannerBand look={BANNER_LOOKS[BANNER_LOOK_DEFAULT]} series={series} ep={ep} idp="v2ban" />
      {/* 帯の吹き出し（quip）は帯の下の角に残す */}
      {activeQuip ? (
        <div key={`${activeQuip}-${quipFrom}`} style={{
          position: "absolute", right: 24, top: 344,
          transform: `scale(${quipPop}) rotate(3deg) translateY(${Math.sin(frame / 18) * 4}px)`,
          transformOrigin: "top right",
          background: "#fff", border: "5px solid #222", borderRadius: 26,
          padding: "8px 20px", fontFamily: FONT, fontSize: 38, fontWeight: 900, color: "#222",
          boxShadow: "0 6px 14px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
        }}>
          {activeQuip}
        </div>
      ) : null}
    </div>
  );
};

// 帯の見比べ（still 1枚に型を縦に並べる・2026-11-13 ⑥）。焼きの本編には使わない＝Root の "BannerLabV2"
export const BannerLabV2: React.FC<{ series?: string; episode?: string; looks?: string[] }> = ({
  series = "スカッとスレ", episode = "夜中の電気泥棒", looks = Object.keys(BANNER_LOOKS),
}) => {
  useV2Fonts();
  return (
    <AbsoluteFill style={{ background: "#333333" }}>
      {looks.map((k, i) => (
        <div key={k} style={{ position: "absolute", left: 0, top: i * BAN_H, width: W, height: BAN_H, overflow: "hidden" }}>
          <BannerBand look={BANNER_LOOKS[k]} series={series} ep={episode} idp={`lab-${k}`} />
          <div style={{ position: "absolute", left: 8, top: 4, color: "#00ff66", fontFamily: FONT, fontSize: 26, fontWeight: 700 }}>
            {BANNER_LOOKS[k].label}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------- B-02 字幕（濃い塗り＋内に白い縁＋外に黒い縁）＋ B-03 話し手の色 ＋ A-03 1コマで替える ----------
const SUB_TOP = 447; // B 444〜453（実測）
const SUB_INNER = 8; // 白い縁（B 約8px）
const SUB_OUTER = 12; // 黒い縁（B 9〜14px）
const SUB_FILL: Record<string, string> = {
  narration: "#2a13a9", // 語り（男）青紫＝B の実測の中ほど
  narration_f: "#e118e7", // 語り（女）桃紫＝B の実測の中ほど
  male: "#1259d6", // ここから下は案
  female_enemy: "#d0142c",
  ally: "#0e8a3a",
  thread: "#222222",
  // 子ども（娘）＝橙（⑪ ep074 で初めて kodomo の話者が出た。無いと narration の青紫になり male の青と紛れた）。
  // 青の male・桃紫の narration_f・緑の ally と色相を離す（青と橙は色覚の型によらず分かれやすい組）
  kodomo: "#f26b00",
};
const ShortSubV2: React.FC<{ text: string; punch?: boolean; speaker?: string; emph?: boolean; near?: "l" | "r" }> = ({
  text, punch, speaker, emph, near,
}) => {
  useV2Fonts(); // 帯が無いコマでも字体を読み終えてから焼く（㉒ P1）
  // 動きなし＝行が替わった1コマで字幕も替わる（A-03・A の実測はフェードなし）
  const rows = text.split("\n");
  const fs = near ? 70 : punch ? 88 : 80;
  const ring = SUB_INNER + SUB_OUTER;
  const pitch = Math.round(fs * 1.25);
  // ⑰（ep075 台帳 No.5）キメ（punch）は塗りを白・内の縁を話し手の色に（塗りと縁を入れ替える）。
  //   前は赤の塗り（#e3121b）＝女性の敵の赤（#d0142c）とほぼ同じで、母のキメが姉の色で出た。白はどの話し手の塗りとも重ならず、
  //   縁の色で誰の言葉かが残る。ep073・ep074 は公開ずみ（焼き直さない）
  const spFill = SUB_FILL[speaker ?? ""] ?? SUB_FILL.narration;
  const fill = punch ? "#fff" : emph ? "#d99a00" : spFill;
  const rim = punch ? spFill : "#fff";
  const anchor = near === "l" ? "start" : near === "r" ? "end" : "middle";
  const x = near === "l" ? 30 + ring : near === "r" ? W - 30 - ring : W / 2;
  const maxW = (near ? 900 : W) - 2 * ring - 8;
  const base0 = SUB_TOP + ring + Math.round(fs * 0.88);
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      {rows.map((row, i) => {
        const fit = textUnits(row) * fs > maxW ? { textLength: maxW, lengthAdjust: "spacingAndGlyphs" as const } : {};
        const common = {
          x, y: base0 + pitch * i, textAnchor: anchor as "start" | "end" | "middle",
          fontFamily: SUB_FONT, fontWeight: 900, fontSize: fs, ...fit,
        };
        // 角が尖らないよう、縁は SVG の丸い角（strokeLinejoin=round）で描く。黒の太い縁→白の縁→塗りの順に重ねる
        return (
          <g key={i}>
            <text {...common} fill="#000" stroke="#000" strokeWidth={ring * 2} strokeLinejoin="round">{row}</text>
            <text {...common} fill={rim} stroke={rim} strokeWidth={SUB_INNER * 2} strokeLinejoin="round">{row}</text>
            <text {...common} fill={fill}>{row}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ---------- A-24 頭のまわりの印（anger*4＝1つずつ増える／anger*3~＝位置を替えて点滅） ----------
// 置き場の計算は src/layoutV2.ts の markBoxes（⑧で移した）。view＝そのコマのカメラと人物の箱の位置
//   → 画面の中（x≤1000）・字幕の下（y≥700）に収め、crash・大写しでは頭の左上へ回す（台帳 No.5・6）
// mt0＝印ごとの出る時刻（人物の時計で）。書かなければ 0・4・8…コマ（④と同じ）。ビート mark で足した印はその時刻
const MarksV2: React.FC<{ marks: string[]; mt0?: number[]; hx: number; hy: number; headPx: number; view?: MarkView }> = ({
  marks, mt0, hx, hy, headPx, view,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {markBoxes(marks, mt0, hx, hy, headPx, frame, view).map((b) => {
        const file = MARK_FILE[b.name] ?? b.name;
        const pop = spring({ frame: frame - 2 - b.t, fps, config: { damping: 10, stiffness: 160 } });
        const pulse = 1 + 0.1 * Math.sin(frame / 4 + b.k + b.mi);
        const blink = b.flow && frame % 9 >= 7 ? 0 : 1;
        return (
          <div key={`${b.mi}-${b.k}`} style={{
            position: "absolute", left: b.cx, top: b.cy, width: b.size, opacity: blink,
            transform: `translate(-50%,-50%) scale(${pop * pulse})`,
          }}>
            <Img src={staticFile(`assets/mark/${file}.png`)} style={{ width: b.size }} />
          </div>
        );
      })}
    </>
  );
};
// そのコマのカメラ（画面 = s × 世界 + (dx, dy)）。big＝頭が画面いっぱい（crash・大写し）
// fold＝奥の人の印を左右に折り返す割合（㉑・手前に2人目が入った割合＝layoutV2.ts の foldAngle）
type CamView = { s: number; dx: number; dy: number; big?: boolean; fold?: number };
const markView = (v: CamView | undefined, ox: number, oy: number): MarkView | undefined =>
  v ? { s: v.s, dx: v.dx, dy: v.dy, big: v.big, fold: v.fold, ox, oy } : undefined;

// ---------- 人物（A-04 大きさ＋B-05 白フチ＋A-09 せり上がり＋A-14 怒りの顔の震え） ----------
// A-09：A3 の実測（2コマごとの上がり幅 約270→255→150px＠720＝1080で405→383→225px・だんだん遅く）をそのまま並べる
const RISE: Record<string, [number[], number[]]> = {
  rise: [[0, 2, 4, 6], [1013, 608, 225, 0]],
  rise2: [[0, 1, 2], [1000, 500, 0]], // A1：1コマで約330px@720＝2コマで出切る
};
const TREMBLE = 4; // A-14 ③ 怒りの表情（rage・angry）は細かく震える（±4px＝案）
const isAngry = (slot: ShotChar) => /^(rage|angry)/.test(slot.expression ?? "");
// frame＝この人物の時計（ShotViewV2 が <Sequence from={t0}> で包む＝足された時・ショットの頭が0）
// withFront＝手前に2人目が入った割合（0〜1・入場の6コマでなめらかに奥の人物を横へ）。view＝そのコマのカメラ（印の置き場に使う）
const ShortCharV2: React.FC<{ slot: ShotChar; count: number; index: number; front?: boolean; withFront?: number; view?: CamView }> = ({
  slot, count, index, front, withFront, view,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = front ? frontLayout(slot, count) : charLayout(slot, count, index, withFront);
  const anim = slot.anim; // punch の行は "zoom"（tools/shots_v2.py が決める）
  const entrance = slot.entrance ?? "slide";
  const boing = spring({ frame, fps, config: { damping: 9, stiffness: 130 } });
  const smooth = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  // 常時の動き（今の ShortChar と同じ）＝カメラが止まっても絵は止めない（§4-2）
  const bob = Math.sin(frame / 8 + index * 2) * 18;
  const swayRot = Math.sin(frame / 22 + index) * 2.2;
  const breathe = 1 + 0.03 * Math.sin(frame / 6 + index);
  let tx = 0, ty = bob, rot = swayRot, sc = 1, sx = 1, sy = 1;
  const dir = index % 2 === 0 ? -1 : 1;
  if (anim === "zoom") {
    sc *= interpolate(frame, [0, 6], [1.45, 1.0], { extrapolateRight: "clamp" });
  } else if (anim === "rise" || anim === "rise2") {
    const [fr, px] = RISE[anim];
    ty += interpolate(frame, fr, px, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (anim === "lunge") {
    tx += interpolate(boing, [0, 1], [dir * 480, 0]);
    rot += interpolate(frame, [0, 8, 18], [dir * 12, -dir * 4, 0], { extrapolateRight: "clamp" });
    sc *= interpolate(frame, [0, 8], [1.22, 1.0], { extrapolateRight: "clamp" });
  } else if (anim === "pop") {
    sc *= boing;
  } else if (anim === "burstin") {
    sc *= interpolate(boing, [0, 1], [0.45, 1]);
    tx += interpolate(boing, [0, 1], [dir * 260, 0]);
    rot += interpolate(frame, [0, 8, 16], [dir * 9, -dir * 3, 0], { extrapolateRight: "clamp" });
  } else if (anim === "shakebody") {
    tx += Math.sin(frame * 2.6) * 12;
    rot += Math.sin(frame * 3.1) * 3.2;
    sc *= 1.04;
  } else if (anim === "recoil") {
    tx += interpolate(frame, [0, 5, 22], [0, dir * -150, 0], { extrapolateRight: "clamp" });
    rot += interpolate(frame, [0, 5, 22], [0, dir * 18, 0], { extrapolateRight: "clamp" });
  } else if (entrance === "slide") {
    tx += interpolate(boing, [0, 1], [dir * 340, 0]);
  } else if (entrance === "pop") {
    sc *= smooth;
  }
  if (isAngry(slot)) {
    tx += Math.sin(frame * 9.7 + index * 3) * TREMBLE;
    ty += Math.cos(frame * 7.9 + index) * TREMBLE * 0.6;
  }
  sc *= breathe;
  if (slot.fall) {
    const fallS = spring({ frame: frame - 3, fps, config: { damping: 13, stiffness: 90 } });
    rot += fallS * -dir * 65;
    ty += fallS * -120;
    const sq = interpolate(frame, [3, 9, 17], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    sx += sq * 0.22;
    sy -= sq * 0.22;
  }
  const isFull = !!slot.asset && /\/full_[^/]+\.png$/.test(slot.asset);
  const { src, onError } = useCharSrc(slot.asset, isFull ? "full_normal.png" : "normal.png");
  // 拡大・揺れの中心＝頭の中心（顔が動かず体が動く）。転倒だけは絵の中ほど
  const origin = slot.fall ? "50% 60%" : `${L.hx}px ${L.hy}px`;
  return (
    <div style={{
      position: "absolute", left: L.left, top: L.top, width: L.w, height: L.h,
      transformOrigin: origin,
      transform: `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(${sc * sx},${sc * sy})`,
    }}>
      {src ? (
        <Img src={staticFile(src)} onError={onError}
          style={{
            position: "absolute", left: 0, top: 0, width: L.w, height: L.h, objectFit: "contain",
            transform: slot.flip ? "scaleX(-1)" : undefined, filter: charFilterV2(slot),
          }} />
      ) : null}
      {slot.marks?.length ? (
        <MarksV2 marks={slot.marks} mt0={slot.mt0} hx={L.hx} hy={L.hy} headPx={L.headPx} view={markView(view, L.left, L.top)} />
      ) : null}
      {slot.thought ? (
        <div style={{ position: "absolute", left: L.hx - L.headPx * 0.62, top: L.hy - L.headPx * 0.55 }}>
          <ThoughtBubble icon={slot.thought} />
        </div>
      ) : null}
    </div>
  );
};

// 顔の超大写し（shot:"closeup"）：顔の台帳で頭の幅を画面の95%に。寄りはカメラ（push +5%）に任せた（⑤・二重に寄らない）
const ShortCloseupV2: React.FC<{ slot: ShotChar; view?: CamView }> = ({ slot, view }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 160 } });
  const L = closeLayout(slot);
  const { src, onError } = useCharSrc(slot.asset, "normal.png");
  if (!src) return null;
  const tr = isAngry(slot) ? `translate(${Math.sin(frame * 9.7) * TREMBLE}px,${Math.cos(frame * 7.9) * TREMBLE * 0.6}px) ` : "";
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: L.left, top: L.top, width: L.w, height: L.h,
        transformOrigin: `${L.hx}px ${L.hy}px`, transform: `${tr}scale(${0.94 + 0.06 * s})`,
      }}>
        <Img src={staticFile(src)} onError={onError}
          style={{
            position: "absolute", left: 0, top: 0, width: L.w, height: L.h, objectFit: "contain",
            transform: slot.flip ? "scaleX(-1)" : undefined, filter: charFilterV2(slot),
          }} />
        {slot.marks?.length ? (
          <MarksV2 marks={slot.marks} mt0={slot.mt0} hx={L.hx} hy={L.hy} headPx={L.headPx}
            view={markView(view ? { ...view, big: true } : undefined, L.left, L.top)} />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// 4分割（shot:"grid"）：今の ShortGrid に白フチだけ足した写し
const GRID_BG = ["#ffe9a8", "#cfe8ff", "#ffd3e0", "#d5f5d0"];
const ShortGridV2: React.FC<{ chars: ShotChar[] }> = ({ chars }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{
      position: "absolute", left: 40, right: 40, top: 720, bottom: 300,
      display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 18,
    }}>
      {chars.slice(0, 4).map((c, i) => {
        const pop = spring({ frame: frame - i * 5, fps, config: { damping: 12, stiffness: 150 } });
        return (
          <div key={i} style={{
            background: GRID_BG[i % 4], borderRadius: 26, border: "6px solid rgba(0,0,0,0.55)",
            overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center",
            transform: `scale(${pop})`,
          }}>
            {c.asset ? (
              <Img src={staticFile(c.asset)} style={{
                height: 470, marginBottom: -100,
                transform: c.flip ? "scaleX(-1)" : undefined, filter: charFilterV2(c),
              }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// ---------- A-21「!?」の爆発マーク（黄色のトゲの吹き出し＋赤い字＋濃い縁） ----------
const spikePath = (cx: number, cy: number, rx: number, ry: number, n: number, inner: number) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : inner;
    pts.push(`${(cx + Math.cos(a) * rx * r).toFixed(1)},${(cy + Math.sin(a) * ry * r).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
};
const BIG_BOX = { left: 590, top: 690, w: 460, h: 420 }; // y≈700〜1100（字幕の2行の下）・右寄せ（案）
const GiantMarkV2: React.FC<{ text: string }> = ({ text }) => {
  useV2Fonts(); // ㉒ P1
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { damping: 9, stiffness: 170 } });
  const wobble = Math.sin(frame / 3) * 3;
  const bubble = /[!?！？]/.test(text);
  const fs = textUnits(text) > 2.2 ? 170 : 230;
  const cx = BIG_BOX.w / 2;
  const cy = BIG_BOX.h / 2;
  return (
    <div style={{
      position: "absolute", left: BIG_BOX.left, top: BIG_BOX.top, width: BIG_BOX.w, height: BIG_BOX.h, zIndex: 5,
      transform: `scale(${pop}) rotate(${-6 + wobble}deg)`, transformOrigin: "center",
    }}>
      <svg width={BIG_BOX.w} height={BIG_BOX.h} style={{ overflow: "visible" }}>
        {bubble ? (
          <path d={spikePath(cx, cy, cx - 4, cy - 8, 13, 0.74)} fill="#ffe21a" stroke="#1a1a1a" strokeWidth={10}
            strokeLinejoin="round" />
        ) : null}
        <text x={cx} y={cy + fs * 0.34} textAnchor="middle" fontFamily={SUB_FONT} fontWeight={900} fontSize={fs}
          fill="#e8141e" stroke={bubble ? "#2a0505" : "#ffffff"} strokeWidth={bubble ? 16 : 22} strokeLinejoin="round"
          paintOrder="stroke">
          {text}
        </text>
      </svg>
    </div>
  );
};

// ---------- A-31 小物が1つずつ増える（6コマおき＝A5 約0.2秒）。t0＝出る時刻（ショットの頭から・ビート deco はその時刻） ----------
const DecoItemV2: React.FC<{ deco: ShotDeco; index: number }> = ({ deco, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - (deco.t0 ?? 4 + index * 6), fps, config: { damping: 11, stiffness: 150 } });
  const float = Math.sin(frame / 12 + index * 2.1) * 8;
  return (
    <div style={{
      position: "absolute", left: `${deco.x * 100}%`, top: `${deco.y * 100}%`,
      transform: `translate(-50%,-50%) translateY(${float}px) scale(${pop * (deco.scale ?? 1)})`,
    }}>
      <Img src={staticFile(deco.img)} style={{ height: 220, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.35))" }} />
    </div>
  );
};

// ---------- ⑬（ep074 台帳 No.6）寄り（insert）に小物が2つ以上ある時は、全部を重ねて大きく見せる ----------
// 決め手の預かり証が手紙1通に見え「八年分」が絵に出なかった → 便箋8通を重ねる。小物が1つの時は共用の ShortInsert のまま（ep073 の寄りは変わらない）。
// 置き場＝台本の deco の x・y（画面の割合・中心）・大きさ＝380px×拡大。1コマずつずらして出る（9コマで全部そろう）・
// 傾きは決まった表（同じ絵が同じ向きで並ばないように）
const INSERT_STACK_H = 380;
const INSERT_TILT = [-9, 7, -4, 10, -7, 3, -11, 5];
const InsertStackV2: React.FC<{ decos: ShotDeco[] }> = ({ decos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sway = Math.sin(frame / 14) * 2;
  return (
    <AbsoluteFill>
      {decos.map((d, i) => {
        const pop = spring({ frame: frame - (2 + i), fps, config: { damping: 10, stiffness: 140 } });
        return (
          <div key={`${i}-${d.img}`} style={{
            position: "absolute", left: `${d.x * 100}%`, top: `${d.y * 100}%`,
            transform: `translate(-50%,-50%) rotate(${INSERT_TILT[i % INSERT_TILT.length] + sway}deg) scale(${pop * (d.scale ?? 1)})`,
          }}>
            <Img src={staticFile(d.img)} style={{ height: INSERT_STACK_H, filter: "drop-shadow(0 16px 26px rgba(0,0,0,0.45))" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- 背景（v2）：寄りはカメラに任せる。共用の Background は描き方を変えない ----------
// A-14 ② 集中線を2コマごとに描き直してちらつかせる（今の FocusBG は横長の中心 960,540 のまま＝縦型では片寄る → 中心を顔の高さに）
const FOCUS_C: Pt = [W / 2, 1150];
const FocusBGV2: React.FC = () => {
  const frame = useCurrentFrame();
  const k = Math.floor(frame / 2);
  const rays: React.ReactNode[] = [];
  for (let i = 0; i < 36; i++) {
    const ang = i * 10 + (random(`focus-a-${i}-${k}`) - 0.5) * 5;
    const w = 14 + random(`focus-w-${i}-${k}`) * 26;
    rays.push(
      <div key={i} style={{
        position: "absolute", left: FOCUS_C[0], top: FOCUS_C[1] - w / 2, width: 1500, height: w,
        background: i % 2 ? "#111" : "#2a2a2a", transformOrigin: "0 50%", transform: `rotate(${ang}deg)`,
      }} />
    );
  }
  const glow = 40 + random(`focus-g-${k}`) * 10;
  return (
    <AbsoluteFill style={{ background: "#1c1c1c", overflow: "hidden" }}>
      {rays}
      <AbsoluteFill style={{
        background: `radial-gradient(circle at ${FOCUS_C[0]}px ${FOCUS_C[1]}px, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) ${glow}%)`,
      }} />
    </AbsoluteFill>
  );
};
// 写真の背景：今の KenBurnsBG（寄り 1.06→1.14＋横の揺れ）から寄りを消し、横の揺れだけ残す（§2-2）
const KenBurnsV2: React.FC<{ bg: string }> = ({ bg }) => {
  const frame = useCurrentFrame();
  const panX = Math.sin(frame / 90) * 12;
  return (
    <AbsoluteFill style={{ background: "#f6f1e7", overflow: "hidden" }}>
      <Img src={staticFile(bg)} style={{
        width: "100%", height: "100%", objectFit: "cover", transform: `scale(1.03) translateX(${panX}px)`,
      }} />
    </AbsoluteFill>
  );
};
// 背景だけ少し大きく描く（画面の弾み B-15 で 0.97 倍に縮んでも端が見えないように）
const BG_OVERSCAN = 1.06;
const BackgroundV2: React.FC<{ bg: string }> = ({ bg }) => {
  let inner: React.ReactNode;
  if (bg.startsWith("plain:")) inner = <AbsoluteFill style={{ background: bg.slice(6) }} />; // only … white の白地
  else if (bg === "abstract:focus") inner = <FocusBGV2 />;
  else if (bg.startsWith("assets/")) inner = <KenBurnsV2 bg={bg} />;
  else inner = <Background bg={bg} />;
  return (
    <AbsoluteFill style={{ transform: `scale(${BG_OVERSCAN})`, transformOrigin: `${VIS_C[0]}px ${VIS_C[1]}px` }}>
      {inner}
    </AbsoluteFill>
  );
};

// ---------- ショットの絵（絵の世界の層。カメラで動く） ----------
// 人物は <Sequence from={t0}> で包む＝その人物の時計は足された時（ショットの頭）から。cut の後は t0 が負＝時計が続く
const withClock = (c: ShotChar | ShotDeco, key: string, node: React.ReactNode) => (
  <Sequence key={key} from={Math.round(c.t0 ?? 0)} layout="none">
    {node}
  </Sequence>
);
const ShotViewV2: React.FC<{ shot: ShotV2 }> = ({ shot }) => {
  const frame = useCurrentFrame(); // ショットの頭が0
  const seg: ShotState = segAt(shot, frame);
  const cam = camAt(shot, frame);
  const chars = seg.chars ?? [];
  const sk = seg.shot;
  const hideStage = sk === "closeup" || sk === "insert" || sk === "grid" || sk === "circle" || !!seg.phone;
  const base = chars.filter((c) => !c.front);
  const fronts = hideStage ? [] : chars.filter((c) => c.front);
  const pullLast = (sk === "ots" || sk === "anchor") && base.length >= 2;
  const stage = hideStage ? [] : pullLast ? base.slice(0, -1) : base;
  const bg = seg.bg ?? "abstract:dots";
  const dof = bg.startsWith("assets/") && sk !== "insert" && !seg.phone && chars.length > 0;
  const whip = shot.trans === "whip";
  const whipBlur = whip ? interpolate(frame, [0, 7], [16, 0], { extrapolateRight: "clamp" }) : 0;
  const whipX = whip ? interpolate(frame, [0, 7], [-260, 0], { extrapolateRight: "clamp" }) : 0;
  const daze = seg.tint === "daze";
  // B-19 白黒：bg＝背景だけ（人物はカラー）／all＝絵の世界全体（帯と字幕は色のまま）
  const worldFilter = [
    whipBlur > 0.2 ? `blur(${whipBlur}px)` : "",
    daze ? "blur(7px) brightness(1.06)" : "",
    seg.bw === "all" ? "grayscale(1)" : "",
  ].join(" ").trim();
  const bgFilter = [dof ? "blur(7px) saturate(1.08)" : "", seg.bw === "bg" ? "grayscale(1)" : ""].join(" ").trim();
  // B-12 暗転：ショットの頭を n コマ黒に（絵の世界の上にだけ重ねる＝帯と字幕は黒の上にも出る）
  const blackN = shot.trans && typeof shot.trans === "object" ? shot.trans.black : 0;
  const otsShift = sk === "ots" && base.length >= 2 ? (base[base.length - 1].x < 0.5 ? 190 : -190) : 0;
  // ⑧：手前に2人目が入る時、奥の人物は入場の6コマでなめらかに横へ（frontMixAt・台帳 No.7・14）。
  //   印はそのコマのカメラで画面の安全な範囲へ（markBoxes・台帳 No.5・6）。big＝crash の後か大写し（頭が画面いっぱい）
  const frontT0 = fronts.length ? Math.min(...fronts.map((c) => c.t0 ?? 0)) : null;
  const frontMix = frontMixAt(frontT0, frame);
  const big = sk === "closeup" || (shot.cams ?? []).some((c) => c.kind === "crash" && c.f <= frame);
  const camView: CamView = { s: cam.s, dx: cam.dx, dy: cam.dy, big };
  // ㉑（ep076 台帳 No.2）：奥が1人で手前に2人目がいる間は、奥の人の印を頭の左上へ折り返す（手前の人の頭の後ろに隠れない）。
  //   入場の6コマ（frontMix）に合わせて回す。奥が2人以上の形は使っていない（ep073〜076）＝今までのまま
  const fold = stage.length === 1 ? frontMix : 0;
  const stageView: CamView = { ...(otsShift ? { ...camView, dx: cam.dx + cam.s * otsShift } : camView), fold };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: whipX ? `translateX(${whipX}px)` : undefined, filter: worldFilter || undefined }}>
        <AbsoluteFill style={{ transformOrigin: "0 0", transform: `matrix(${cam.s},0,0,${cam.s},${cam.dx},${cam.dy})` }}>
          <AbsoluteFill style={{ filter: bgFilter || undefined }}>
            <BackgroundV2 bg={bg} />
          </AbsoluteFill>
          {dof ? <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.42) 100%)" }} /> : null}
          {sk === "closeup" && chars[0] ? withClock(chars[0], `cl-${chars[0].label}`, <ShortCloseupV2 slot={chars[0]} view={camView} />) : null}
          {sk === "circle" && chars[0] ? <ShortCircle slot={chars[0]} /> : null}
          {sk === "grid" ? <ShortGridV2 chars={chars} /> : null}
          {sk === "insert" && seg.deco?.[0]
            ? seg.deco.length >= 2 ? <InsertStackV2 decos={seg.deco} /> : <ShortInsert deco={seg.deco[0]} />
            : null}
          {seg.phone ? <PhoneChat phone={seg.phone} /> : null}
          {stage.length > 0 ? (
            <AbsoluteFill style={{ transform: otsShift ? `translateX(${otsShift}px)` : undefined }}>
              {stage.map((c, i) =>
                withClock(c, `c-${c.label}-${c.t0 ?? 0}`,
                  <ShortCharV2 slot={c} count={stage.length} index={i} withFront={frontMix} view={stageView} />))}
            </AbsoluteFill>
          ) : null}
          {fronts.map((c) =>
            withClock(c, `f-${c.label}-${c.t0 ?? 0}`, <ShortCharV2 slot={c} count={stage.length} index={stage.length} front view={camView} />))}
          {sk !== "insert" ? (seg.deco ?? []).map((d, i) => <DecoItemV2 key={`d${i}-${d.img}`} deco={d} index={i} />) : null}
          {sk === "ots" && base.length >= 2 ? <ShortOccluder slot={base[base.length - 1]} /> : null}
          {sk === "anchor" && base.length >= 2 ? <ShortAnchor slot={base[base.length - 1]} /> : null}
          {seg.tint && seg.tint !== "daze" ? <AbsoluteFill style={TINT_STYLE[seg.tint]} /> : null}
          {seg.fx && seg.fx !== "speedlines" ? <ParticleOverlay kind={seg.fx} /> : null}
        </AbsoluteFill>
      </AbsoluteFill>
      {blackN > 0 && frame < blackN ? <AbsoluteFill style={{ background: "#000" }} /> : null}
    </AbsoluteFill>
  );
};

// ---------- 白い光（flash）：v2 では絵の世界だけを白くする（⑧・台帳 No.10） ----------
// 共用の FlashOverlay は zIndex 7 で、帯（A-01「帯は一度も動かない」）と字幕まで白く覆った（ep073 L15 の頭0.3秒・帯の平均輝度 84.5→229.6）。
// v2 では zIndex を付けず、行の層の一番下に置く＝絵の世界の上・字幕と帯の下（光り方の数値は共用のまま）
const FlashOverlayV2: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 2, 9], [0.85, 0.6, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
};

// ---------- 手書きの字（lettering）：字幕と頭の間に収める（⑧・台帳 No.16） ----------
// 共用の PunchLettering は y620〜1520 の真ん中・168px で、ep073 L19「ケチはどっち」が頭（髪）に150〜310px 重なり、
// 右端が x1025（YouTube の右のボタンの列 x≥940 の中）まで出た。v2 では箱を y700〜890・x40〜920 にし、
// 字の大きさは「弾み（spring の行き過ぎ 約1.17倍）でも箱に収まる」大きさにする（最大132px）。動き・色・縁は共用と同じ
const LETTER_BOX = { left: 40, top: 700, width: 880, height: 190 };
const LETTER_OVERSHOOT = 1.17;
const PunchLetteringV2: React.FC<{ text: string }> = ({ text }) => {
  useV2Fonts(); // ㉒ P1
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 1, fps, config: { damping: 9, stiffness: 140 } });
  const wob = Math.sin(frame / 5) * 1.6;
  const rows = text.split("\n");
  const units = Math.max(1, ...rows.map((r) => textUnits(r)));
  const fs = Math.min(
    132,
    Math.floor((LETTER_BOX.width / LETTER_OVERSHOOT - 30) / units),
    Math.floor(LETTER_BOX.height / LETTER_OVERSHOOT / (rows.length * 1.16)),
  );
  const ab = ((9 + 4 * Math.sin(frame / 3)) * fs) / 168; // 色収差の幅（共用と同じ脈動・字の大きさに合わせて縮める）
  const layer: React.CSSProperties = {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: SUB_FONT, fontWeight: 900, fontSize: fs, lineHeight: 1.16, textAlign: "center", whiteSpace: "pre-line",
  };
  return (
    <div style={{
      position: "absolute", left: LETTER_BOX.left, top: LETTER_BOX.top, width: LETTER_BOX.width, height: LETTER_BOX.height,
      zIndex: 6, transform: `scale(${0.4 + 0.6 * pop}) rotate(${-5 + wob}deg)`,
    }}>
      <div style={{ ...layer, color: "#ff2050", transform: `translate(${-ab}px,${-ab * 0.6}px)`, opacity: 0.9 }}>{text}</div>
      <div style={{ ...layer, color: "#22d4ff", transform: `translate(${ab}px,${ab * 0.6}px)`, opacity: 0.9 }}>{text}</div>
      <div style={{
        ...layer, color: "#ffffff", WebkitTextStroke: "12px #17171c",
        paintOrder: "stroke fill" as unknown as undefined,
        textShadow: "0 0 40px rgba(255,220,80,0.7), 0 12px 0 rgba(0,0,0,0.5)",
      }}>{text}</div>
    </div>
  );
};

// ---------- 行の字幕と飾り（画面に固定の層。行の頭で1コマで替わる） ----------
const LineViewV2: React.FC<{ cut: Cut }> = ({ cut }) => (
  <AbsoluteFill>
    {cut.flash ? <FlashOverlayV2 /> : null}
    {cut.se ? <Audio src={staticFile(`assets/se/${cut.se}.mp3`)} volume={0.5} /> : null}
    {(cut.fx === "speedlines" || cut.anim === "burstin" || cut.anim === "lunge" || cut.anim === "recoil") ? <SpeedLines /> : null}
    {cut.otext ? <OnomatopoeiaText o={cut.otext} /> : null}
    {cut.bigmark ? <GiantMarkV2 text={cut.bigmark} /> : null}
    {cut.lettering ? <PunchLetteringV2 text={cut.lettering} /> : null}
    <ShortSubV2 text={cut.sub.text} punch={cut.punch} speaker={cut.sub.speaker} emph={cut.sub.emph} near={cut.sub.near} />
  </AbsoluteFill>
);

// 行の揺れ（shake・punch）は行に付く。ショットの列と行の列を包む一番外の層で、今の行を探して掛ける
const ShakeWrapV2: React.FC<{ cuts: Cut[]; starts: number[]; children: React.ReactNode }> = ({ cuts, starts, children }) => {
  const frame = useCurrentFrame();
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= frame) i++;
  const cut = cuts[i];
  const lf = frame - (starts[i] ?? 0);
  const amp = cut?.shake ? 16 : cut?.punch ? 9 : 0;
  const sx = amp ? Math.sin(lf * 2.8) * interpolate(lf, [0, 14], [amp, 0], { extrapolateRight: "clamp" }) : 0;
  const sy = amp ? Math.cos(lf * 3.2) * interpolate(lf, [0, 14], [amp * 0.7, 0], { extrapolateRight: "clamp" }) : 0;
  return <AbsoluteFill style={{ transform: sx || sy ? `translate(${sx}px,${sy}px)` : undefined }}>{children}</AbsoluteFill>;
};

// cuts.json に "shots" が無い v2 の回（④の形）は、1行＝1ショット（ビートなし・カメラは push）で描く
const shotsFromLines = (cuts: Cut[], starts: number[], durs: number[]): ShotV2[] =>
  cuts.map((cut, i) => ({
    from: starts[i],
    dur: durs[i],
    trans: cut.trans,
    segs: [{
      f: 0,
      bg: cut.bg ?? "abstract:dots",
      chars: (cut.chars ?? []).map((c) => ({ ...c, t0: 0, anim: cut.punch ? "zoom" : cut.anim })),
      shot: cut.shot,
      deco: (cut.deco ?? []).map((d, j) => ({ ...d, t0: 4 + j * 6 })),
      tint: cut.tint,
      fx: cut.fx,
      bw: cut.bw,
      phone: cut.phone,
    }],
    cams: [{ f: 0, kind: "push", amount: cut.shot === "closeup" ? 0.05 : 0.07 }],
  }));
// ショットの列が行の列とすき間なく重なるか（尺を手で直した cuts.json などで食い違ったら、1行1ショットに戻す）
const shotsTile = (shots: ShotV2[], total: number) => {
  let f = 0;
  for (const s of shots) {
    if (s.from !== f || s.dur < 1 || !s.segs?.length) return false;
    f += s.dur;
  }
  return f === total;
};

export const SukattoShortV2: React.FC<{ cuts: Cut[]; banner?: ShortBannerInfo; shots?: ShotV2[] }> = ({
  cuts, banner, shots,
}) => {
  const durs = cuts.map((c) => Math.max(1, Math.round(c.durSec * FPS)));
  const starts: number[] = [];
  let total = 0;
  for (const d of durs) {
    starts.push(total);
    total += d;
  }
  const ok = !!shots && shotsTile(shots, total);
  if (shots && !ok) console.warn("ShortV2: shots の尺が行の尺と合わない → 1行1ショットで描く（make_episode.py を回し直す）");
  const list = ok && shots ? shots : shotsFromLines(cuts, starts, durs);
  const quipTimeline = cuts.flatMap((c, i) => (c.quip !== undefined ? [{ from: starts[i], quip: c.quip }] : []));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OutlineDefs />
      <ShakeWrapV2 cuts={cuts} starts={starts}>
        {list.map((s, i) => (
          <Sequence key={`s${i}`} from={s.from} durationInFrames={s.dur}>
            <ShotViewV2 shot={s} />
          </Sequence>
        ))}
        {cuts.map((c, i) => (
          <Sequence key={`l${i}`} from={starts[i]} durationInFrames={durs[i]}>
            <LineViewV2 cut={c} />
          </Sequence>
        ))}
      </ShakeWrapV2>
      {banner ? <ShortBannerV2 {...banner} quipTimeline={quipTimeline.length ? quipTimeline : undefined} /> : null}
    </AbsoluteFill>
  );
};

// 入口：cuts.json の "style" が "v2" の回だけ v2 で描く。それ以外は今の SukattoShort をそのまま使う（§2-0）
export const SukattoShortEntry: React.FC<{ cuts: Cut[]; banner?: ShortBannerInfo; style?: string; shots?: ShotV2[] }> = ({
  cuts, banner, style, shots,
}) => (style === "v2" ? <SukattoShortV2 cuts={cuts} banner={banner} shots={shots} /> : <SukattoShort cuts={cuts} banner={banner} />);
