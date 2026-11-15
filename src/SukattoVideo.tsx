import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Cut, CharSlot, Mark, SPEAKER_STYLE } from "./sukattoTypes";

export const FPS = 30;
// export＝縦型 v2（src/ShortV2.tsx）からも使う印。描き方は変えていない（2026-11-13 ④）
export const FONT =
  "'Yu Gothic UI','Yu Gothic','Hiragino Sans','Noto Sans CJK JP','Noto Sans JP',sans-serif";

// ---------- 抽象背景（素材不要・コード生成） ----------

const DotsBG: React.FC = () => {
  const frame = useCurrentFrame();
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 26; x++) {
      const tw = 0.5 + 0.5 * Math.sin((x * 7 + y * 13 + frame * 0.15) % (Math.PI * 2));
      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: 20 + x * 74,
            top: 12 + y * 78,
            width: 30,
            height: 30,
            borderRadius: 15,
            background: `rgba(120,220,140,${0.12 + 0.3 * tw})`,
          }}
        />
      );
    }
  }
  return <AbsoluteFill style={{ background: "#07240f" }}>{cells}</AbsoluteFill>;
};

const SpeedBG: React.FC = () => {
  const frame = useCurrentFrame();
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 40; i++) {
    const x = ((i * 53 + frame * 22) % 2000) - 40;
    lines.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 6 + (i % 4) * 5,
          height: 1080,
          background: `rgba(190,255,200,${0.08 + (i % 5) * 0.05})`,
        }}
      />
    );
  }
  return <AbsoluteFill style={{ background: "#0d3317" }}>{lines}</AbsoluteFill>;
};

const FocusBG: React.FC = () => {
  const rays: React.ReactNode[] = [];
  for (let i = 0; i < 36; i++) {
    rays.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          width: 1400,
          height: 26,
          background: i % 2 ? "#111" : "#2a2a2a",
          transformOrigin: "0 50%",
          transform: `rotate(${i * 10}deg)`,
        }}
      />
    );
  }
  return (
    <AbsoluteFill style={{ background: "#1c1c1c", overflow: "hidden" }}>
      {rays}
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 46%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ---- 感情背景（競合分析2026-07-06で導入・すべてコード生成） ----

// 渦巻き: 中心へ吸い込まれる同心リング（不満/緊迫/動揺を色で使い分け）
const SwirlBG: React.FC<{ base: string; ring: string }> = ({ base, ring }) => {
  const frame = useCurrentFrame();
  const rings: React.ReactNode[] = [];
  for (let i = 0; i < 10; i++) {
    const r = 70 + i * 125 + ((frame * 2.2) % 125);
    rings.push(
      <div key={i} style={{
        position: "absolute", left: 960 - r, top: 540 - r, width: r * 2, height: r * 2,
        borderRadius: "50%", border: `24px solid ${ring}`, opacity: Math.max(0.06, 0.5 - i * 0.045),
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.15 + 0.05 * Math.sin(frame / 17)})` }}>{rings}</div>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

// ジグザグ（シェブロン）: コミカルな切迫感。流れ続ける
const ZigzagBG: React.FC<{ base: string; accent: string }> = ({ base, accent }) => {
  const frame = useCurrentFrame();
  const g = (deg: number) => `linear-gradient(${deg}deg, ${accent} 25%, transparent 25%)`;
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: -200,
        backgroundImage: `${g(135)}, ${g(225)}, ${g(45)}, ${g(315)}`,
        backgroundSize: "220px 110px",
        backgroundPosition: `${frame * 3}px 0, ${frame * 3}px 0, ${frame * 3}px 55px, ${frame * 3}px 55px`,
        opacity: 0.85,
      }} />
    </AbsoluteFill>
  );
};

// 火炎: 立ちのぼる炎ブロブ＋ちらつき（断罪=赤/静かな怒り=緑）
const FlameBG: React.FC<{ base: string; colors: string[] }> = ({ base, colors }) => {
  const frame = useCurrentFrame();
  const blobs: React.ReactNode[] = [];
  for (let i = 0; i < 16; i++) {
    const cycle = 1500;
    const y = 1280 - ((frame * (9 + (i % 4) * 3) + i * 217) % cycle);
    const x = 90 + ((i * 137) % 1840) + Math.sin(frame / 11 + i) * 46;
    const w = 200 + (i % 5) * 90;
    blobs.push(
      <div key={i} style={{
        position: "absolute", left: x - w / 2, top: y, width: w, height: w * 1.35,
        borderRadius: "50%", background: colors[i % colors.length],
        filter: "blur(46px)", opacity: 0.5 + 0.2 * Math.sin(frame / 5 + i * 2),
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      {blobs}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -260, height: 560, background: colors[0], filter: "blur(80px)", opacity: 0.55 }} />
    </AbsoluteFill>
  );
};

// 稲妻: 暗雲＋周期的なフラッシュとギザギザの電光（衝撃の登場・急展開）
const LightningBG: React.FC = () => {
  const frame = useCurrentFrame();
  const cycle = 42;
  const t = frame % cycle;
  const flash = t < 5 ? interpolate(t, [0, 1, 5], [0, 0.85, 0]) : 0;
  const boltSeed = Math.floor(frame / cycle) % 3;
  const boltX = [430, 960, 1450][boltSeed];
  const pts: string[] = [];
  let px = boltX, py = -20;
  for (let i = 0; i < 8; i++) {
    px += (i % 2 === 0 ? 1 : -1) * (60 + ((boltSeed + i) % 3) * 40);
    py += 150;
    pts.push(`${px},${py}`);
  }
  const clouds: React.ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    clouds.push(
      <div key={i} style={{
        position: "absolute", left: i * 260 - 120 + Math.sin(frame / 40 + i) * 24, top: -140 + (i % 3) * 46,
        width: 460, height: 300, borderRadius: "50%", background: "#20242e", filter: "blur(38px)", opacity: 0.9,
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: "#0a0d14", overflow: "hidden" }}>
      {clouds}
      {t < 6 && (
        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
          <polyline points={`${boltX},-20 ${pts.join(" ")}`} fill="none" stroke="#eaf2ff" strokeWidth={10} opacity={0.95} />
          <polyline points={`${boltX},-20 ${pts.join(" ")}`} fill="none" stroke="#8fb8ff" strokeWidth={26} opacity={0.35} />
        </svg>
      )}
      <AbsoluteFill style={{ background: "#dfe9ff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// 金ラメ: 勝利・和解・ほっこり（きらめく粒子＋温かい光）
const GoldBG: React.FC = () => {
  const frame = useCurrentFrame();
  const sparks: React.ReactNode[] = [];
  for (let i = 0; i < 46; i++) {
    const x = (i * 173) % 1920;
    const y = ((i * 89) % 1080) - ((frame * (0.4 + (i % 3) * 0.3)) % 1180) + 100;
    const tw = 0.5 + 0.5 * Math.sin(frame / 6 + i * 1.7);
    const s = 10 + (i % 4) * 8;
    sparks.push(
      <div key={i} style={{
        position: "absolute", left: x, top: y, width: s, height: s,
        background: i % 3 ? "#ffd970" : "#fff3c4", opacity: 0.25 + 0.65 * tw,
        transform: `rotate(45deg) scale(${0.7 + 0.5 * tw})`,
        boxShadow: "0 0 18px rgba(255,214,110,0.8)",
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#3a2408 0%,#241403 60%,#180d02 100%)", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 46%, rgba(255,196,86,0.30) 0%, rgba(0,0,0,0) 60%)" }} />
      {sparks}
    </AbsoluteFill>
  );
};

// モノクロ煙: 深刻な回想・監視カメラ映像の再生
const MonoBG: React.FC = () => {
  const frame = useCurrentFrame();
  const smoke: React.ReactNode[] = [];
  for (let i = 0; i < 10; i++) {
    smoke.push(
      <div key={i} style={{
        position: "absolute",
        left: ((i * 311) % 1900) - 200 + Math.sin(frame / 34 + i * 2) * 60,
        top: ((i * 173) % 900) - 100 - (frame * 0.5 % 200),
        width: 560, height: 400, borderRadius: "50%",
        background: i % 2 ? "#3a3a3a" : "#565656", filter: "blur(60px)", opacity: 0.5,
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: "#191919", overflow: "hidden" }}>
      {smoke}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

// 漢字1文字タイポ背景（例: typo:法）: 手続き・制度の説明シーン
const TypoBG: React.FC<{ kanji: string }> = ({ kanji }) => {
  const frame = useCurrentFrame();
  const scale = 1 + Math.min(frame / 400, 1) * 0.1;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#181c26 0%,#0c0f16 100%)", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{
        fontFamily: FONT, fontWeight: 900, fontSize: 900, color: "rgba(225,232,246,0.16)",
        transform: `scale(${scale}) rotate(-4deg)`, lineHeight: 1, userSelect: "none",
      }}>
        {kanji}
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

const KenBurnsBG: React.FC<{ bg: string }> = ({ bg }) => {
  const frame = useCurrentFrame();
  // ゆっくり寄る＋わずかに横流れ（カット内で止まらない）
  const scale = 1.06 + Math.min(frame / 300, 1) * 0.08;
  const panX = Math.sin(frame / 90) * 12;
  return (
    <AbsoluteFill style={{ background: "#f6f1e7", overflow: "hidden" }}>
      <Img
        src={staticFile(bg)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${panX}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const SceneArtBG: React.FC<{ name: string }> = ({ name }) => {
  // 決め絵（透過PNGの一枚絵）: 紙色下地の中央に大きく置き、ゆっくり寄る
  const frame = useCurrentFrame();
  const scale = 1.0 + Math.min(frame / 240, 1) * 0.08;
  return (
    <AbsoluteFill
      style={{ background: "#f6f1e7", alignItems: "center", justifyContent: "center" }}
    >
      <Img
        src={staticFile(`assets/scene/${name}.png`)}
        style={{ height: "82%", transform: `scale(${scale})` }}
      />
    </AbsoluteFill>
  );
};

// 鮮やかで"動く"速度線バースト（ショートのアクション/山場用・競合の緑速度線に対応）
const BurstBG: React.FC<{ base: string; streak: string; glow: string }> = ({ base, streak, glow }) => {
  const frame = useCurrentFrame();
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 54; i++) {
    const y = (i * 53) % 1980 - 30;
    const x = ((i * 97 + frame * 70) % 2600) - 340; // 速い横流れ
    lines.push(
      <div key={i} style={{
        position: "absolute", left: x, top: y, width: 380 + (i % 5) * 170, height: 12 + (i % 4) * 12,
        background: `linear-gradient(90deg, transparent, ${streak}, transparent)`,
        opacity: 0.6 + (i % 3) * 0.16, filter: "blur(1px)",
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 44%, ${glow} 0%, ${base} 68%)` }} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.12 + 0.06 * Math.sin(frame / 8)})` }}>{lines}</div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 44%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 26%)" }} />
    </AbsoluteFill>
  );
};

// エレベーター内観（コード生成・2026-07-13。いらすとやに全画面内観素材が無いため自作）
const ElevatorBG: React.FC = () => {
  const frame = useCurrentFrame();
  const floor = 3 + Math.floor(frame / 45) % 5; // 階数表示がゆっくり進む（画面変化の担保）
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#cfd6dd 0%,#b8c0c9 55%,#9aa3ad 100%)", overflow: "hidden" }}>
      {/* 天井の照明帯 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, background: "linear-gradient(180deg,#f6f9fc,#dfe6ec)" }} />
      <div style={{ position: "absolute", top: 34, left: 240, right: 240, height: 46, borderRadius: 23, background: "#ffffff", boxShadow: "0 0 46px rgba(255,255,240,0.9)" }} />
      {/* 側壁のパネル線（遠近） */}
      <div style={{ position: "absolute", top: 130, bottom: 0, left: 90, width: 10, background: "rgba(90,100,112,0.35)", transform: "skewY(6deg)" }} />
      <div style={{ position: "absolute", top: 130, bottom: 0, right: 90, width: 10, background: "rgba(90,100,112,0.35)", transform: "skewY(-6deg)" }} />
      {/* 奥のドア（センター合わせ目・ヘアライン金属） */}
      <div style={{ position: "absolute", top: 240, bottom: 300, left: 235, right: 235, background: "linear-gradient(90deg,#c2cad2 0%,#e8edf2 24%,#c7cfd7 49%,#aab3bd 51%,#e2e8ee 76%,#bfc7cf 100%)", border: "14px solid #8d97a2", borderRadius: 6 }} />
      <div style={{ position: "absolute", top: 240, bottom: 300, left: "50%", width: 6, marginLeft: -3, background: "#7a848f" }} />
      {/* 階数表示パネル */}
      <div style={{ position: "absolute", top: 150, left: "50%", transform: "translateX(-50%)", background: "#20242c", borderRadius: 14, padding: "10px 34px", border: "5px solid #5b636d" }}>
        <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 56, color: "#ff9a2a", letterSpacing: 6 }}>▲ {floor}F</span>
      </div>
      {/* 手すり */}
      <div style={{ position: "absolute", left: 130, right: 130, bottom: 430, height: 22, borderRadius: 11, background: "linear-gradient(180deg,#f0f4f8,#a8b1bb)", boxShadow: "0 6px 10px rgba(0,0,0,0.25)" }} />
      {/* 床 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, background: "linear-gradient(180deg,#6e7681,#565e68)" }} />
    </AbsoluteFill>
  );
};

// 全画面の白黒集中線（決定的瞬間・拒絶・衝撃の"漫画1コマ"背景）。競合の分析2026-07-12
const BurstBWBG: React.FC = () => {
  const frame = useCurrentFrame();
  const rays: React.ReactNode[] = [];
  for (let i = 0; i < 48; i++) {
    // 線の太さを毎フレーム微妙に揺らして「手描きがバタつく」質感を出す
    const w = 14 + (i % 5) * 10 + 6 * Math.sin(frame / 2 + i * 3);
    rays.push(
      <div key={i} style={{
        position: "absolute", left: 540, top: 960, width: 1500, height: w,
        background: i % 2 ? "#0a0a0a" : "#f2f2f2",
        transformOrigin: "0 50%",
        transform: `rotate(${i * 7.5 + Math.sin(frame / 3) * 1.2}deg)`,
      }} />
    );
  }
  return (
    <AbsoluteFill style={{ background: "#111", overflow: "hidden" }}>
      {rays}
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.9 + 0.08 * Math.sin(frame / 2)}) 0%, rgba(255,255,255,0) 40%)`,
      }} />
    </AbsoluteFill>
  );
};

const BURST: Record<string, { base: string; streak: string; glow: string }> = {
  green: { base: "#0a7a2e", streak: "#c6ff96", glow: "#57e065" },
  gold: { base: "#9a6400", streak: "#fff0a6", glow: "#ffd23a" },
  blue: { base: "#0a4f96", streak: "#aee6ff", glow: "#4fb4ff" },
  red: { base: "#9a0f22", streak: "#ffbcae", glow: "#ff5a4a" },
  pink: { base: "#9a1560", streak: "#ffc8e6", glow: "#ff6fae" },
  purple: { base: "#3a1170", streak: "#d9b6ff", glow: "#a86bff" },
};

export const Background: React.FC<{ bg: string }> = ({ bg }) => {
  if (bg === "abstract:dots") return <DotsBG />;
  if (bg === "abstract:speed") return <SpeedBG />;
  if (bg === "abstract:focus") return <FocusBG />;
  if (bg === "abstract:burst_bw") return <BurstBWBG />;
  if (bg === "abstract:elevator") return <ElevatorBG />;
  if (bg.startsWith("abstract:burst_")) {
    const b = BURST[bg.slice(15)] ?? BURST.green;
    return <BurstBG {...b} />;
  }
  if (bg === "abstract:swirl_purple") return <SwirlBG base="#1c0b2e" ring="#8a4fd8" />;
  if (bg === "abstract:swirl_red") return <SwirlBG base="#2b0606" ring="#d84f4f" />;
  if (bg === "abstract:swirl_blue") return <SwirlBG base="#081a30" ring="#4f86d8" />;
  if (bg === "abstract:zigzag_orange") return <ZigzagBG base="#e84a1a" accent="#f5b40a" />;
  if (bg === "abstract:zigzag_blue") return <ZigzagBG base="#20386e" accent="#4f6fd8" />;
  if (bg === "abstract:flame_red") return <FlameBG base="#180300" colors={["#ff5a00", "#ff2600", "#ffc400"]} />;
  if (bg === "abstract:flame_green") return <FlameBG base="#03140a" colors={["#2fd166", "#0a9e46", "#a8ff66"]} />;
  if (bg === "abstract:lightning") return <LightningBG />;
  if (bg === "abstract:gold") return <GoldBG />;
  if (bg === "abstract:mono") return <MonoBG />;
  if (bg.startsWith("typo:")) return <TypoBG kanji={bg.slice(5)} />;
  if (bg.startsWith("scene:")) return <SceneArtBG name={bg.slice(6)} />;
  if (bg.startsWith("assets/")) {
    // 透過PNG背景でも黒くならないよう紙色の下地＋常時ケンバーンズ（静止画ゼロ原則）
    return <KenBurnsBG bg={bg} />;
  }
  // プレースホルダー背景（素材未DL時）: 場面名を薄く表示
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg,#dfe9f3 0%,#f6f8fb 60%,#e8eef5 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 90, color: "rgba(60,80,110,0.18)", fontWeight: 700 }}>
        {`背景: ${bg}`}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 感情マーク ----------

export const MARK_FILE: Record<Mark, string> = {
  sweat: "sweat",
  anger: "anger",
  heart: "hearts",
  sparkle: "sparkle",
  gloom: "gloom",
};

const MarkIcon: React.FC<{ mark: Mark; index: number; size?: number }> = ({ mark, index, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // ポップイン→脈動（出しっぱなしの静止を避ける）
  const pop = spring({ frame: frame - index * 4, fps, config: { damping: 10, stiffness: 160 } });
  const pulse = 1 + 0.12 * Math.sin(frame / 4 + index);
  return (
    <div
      style={{
        position: "absolute",
        top: -60 - index * 18,
        right: -50 - index * 40,
        transform: `scale(${pop * pulse})`,
      }}
    >
      <Img src={staticFile(`assets/mark/${MARK_FILE[mark] ?? mark}.png`)} style={{ width: size ?? 120 }} />
    </div>
  );
};

// キャラ変身フィルタ: 石化=グレスケ石質感／モブ減彩=主役だけカラーに見せる（競合の分析2026-07-12）
export const charFilter = (slot: CharSlot): string | undefined => {
  if (slot.sil) return "brightness(0.08) saturate(0.15)";
  if (slot.stone) return "grayscale(1) brightness(0.82) contrast(1.2) drop-shadow(0 0 2px rgba(0,0,0,0.6))";
  if (slot.ghost) return "saturate(0.12) opacity(0.55) brightness(0.9)";
  return undefined;
};

// ---------- キャラクター ----------

// キャラ画像。読み込み失敗時は同フォルダの normal.png へフォールバック（欠損でレンダを止めない）
const CharImg: React.FC<{ asset: string; flip?: boolean }> = ({ asset, flip }) => {
  const fallback = asset.replace(/[^/]+\.png$/, "normal.png");
  const [src, setSrc] = React.useState(asset);
  return (
    <Img
      src={staticFile(src)}
      onError={() => { if (src !== fallback) setSrc(fallback); }}
      style={{ height: 560, transform: flip ? "scaleX(-1)" : undefined }}
    />
  );
};

const Character: React.FC<{ slot: CharSlot }> = ({ slot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = slot.entrance ?? "slide";
  const s =
    entrance === "none"
      ? 1
      : spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const slide = entrance === "slide" ? interpolate(s, [0, 1], [slot.x < 0.5 ? -320 : 320, 0]) : 0;
  const pop = entrance === "pop" ? s : 1;
  const bob = Math.sin(frame / 13 + slot.x * 9) * 6; // 常時ゆれ（棒立ち防止）
  const scale = (slot.scale ?? 1) * pop;
  // 転倒（被弾・敗北）: バネで約80度回転して転がる。競合分析2026-07-11
  // 端のキャラが画面外へ転がり出ないよう、回転と同時に画面内側へ寄せる（ep009 QAで発見）
  const fallS = slot.fall ? spring({ frame: frame - 3, fps, config: { damping: 13, stiffness: 90 } }) : 0;
  const fallRot = fallS * (slot.x < 0.5 ? -80 : 80);
  const fallDrop = fallS * -130;  // 倒れた体が下部の字幕帯に隠れないよう持ち上げる
  const fallShift = fallS * (slot.x < 0.5 ? 200 : -200);

  const body = slot.asset ? (
    <CharImg asset={slot.asset} flip={slot.flip} />
  ) : (
    // プレースホルダー立ち絵（素材未DL時）: シルエット＋ラベル
    <div style={{ width: 330, height: 560, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 75,
          top: 0,
          width: 180,
          height: 180,
          borderRadius: 90,
          background: "#f2c9a0",
          border: "6px solid #b98a5e",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 190,
          width: 250,
          height: 350,
          borderRadius: "60px 60px 24px 24px",
          background: slot.x < 0.5 ? "#5b8ed6" : "#d66a8e",
          border: "6px solid rgba(0,0,0,0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 60,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 40,
          fontWeight: 800,
          color: "#333",
        }}
      >
        {slot.label}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 300,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 34,
          color: "#fff",
          fontWeight: 700,
        }}
      >
        {slot.expression}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 210,
        left: `${slot.x * 100}%`,
        transform: `translateX(-50%) translateX(${slide + fallShift}px) translateY(${bob + fallDrop}px) scale(${scale}) rotate(${fallRot}deg)`,
        transformOrigin: "bottom center",
      }}
    >
      {/* シルエット/石化/減彩: 同素材の加工で変身を作る（競合の分析2026-07-11・07-12） */}
      <div style={{ position: "relative", filter: charFilter(slot) }}>
        {body}
        {(slot.marks ?? []).map((m, i) => (
          <MarkIcon key={m + i} mark={m} index={i} />
        ))}
        {slot.thought && <ThoughtBubble icon={slot.thought} />}
      </div>
    </div>
  );
};

// 小物イラストの散らし（競合分析2026-07-11: 家事アイテム・料理などを画面に3〜5個ポップインして情報量を出す）
const DecoItem: React.FC<{ deco: { img: string; x: number; y: number; scale?: number }; index: number }> = ({ deco, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 4 - index * 5, fps, config: { damping: 11, stiffness: 150 } });
  const float = Math.sin(frame / 12 + index * 2.1) * 8;
  return (
    <div
      style={{
        position: "absolute",
        left: `${deco.x * 100}%`,
        top: `${deco.y * 100}%`,
        transform: `translate(-50%,-50%) translateY(${float}px) scale(${pop * (deco.scale ?? 1)})`,
      }}
    >
      <Img src={staticFile(deco.img)} style={{ height: 220, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.35))" }} />
    </div>
  );
};

// 思考バブル: 頭上のもくもく雲＋アイコン（内心をセリフに頼らず図示・競合分析2026-07-06）
export const ThoughtBubble: React.FC<{ icon: string }> = ({ icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 6, fps, config: { damping: 11, stiffness: 130 } });
  const float = Math.sin(frame / 15) * 7;
  return (
    <div style={{
      position: "absolute", top: -180 + float, left: -180,
      transform: `scale(${pop})`, transformOrigin: "bottom right",
    }}>
      <div style={{
        width: 250, height: 185, background: "rgba(255,255,255,0.97)",
        border: "6px solid #384252", borderRadius: 90,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 10px 26px rgba(0,0,0,0.3)",
      }}>
        <Img src={staticFile(icon)} style={{ maxWidth: 165, maxHeight: 125 }} />
      </div>
      {/* しっぽの小円2つ（頭に向かって小さく） */}
      <div style={{ position: "absolute", right: -18, bottom: -26, width: 42, height: 42, borderRadius: 21, background: "#fff", border: "5px solid #384252" }} />
      <div style={{ position: "absolute", right: -46, bottom: -58, width: 24, height: 24, borderRadius: 12, background: "#fff", border: "4px solid #384252" }} />
    </div>
  );
};

// ---------- 字幕枠（話者色分け）／スレ民レス枠 ----------

const SubtitleBox: React.FC<{ cut: Cut }> = ({ cut }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 170 } });
  const st = SPEAKER_STYLE[cut.sub.speaker] ?? SPEAKER_STYLE.narration;

  if (cut.sub.speaker === "thread") {
    return (
      <div
        style={{
          position: "absolute",
          left: 200,
          right: 200,
          bottom: 60,
          transform: `scale(${0.9 + 0.1 * s})`,
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            border: `4px solid ${st.border}`,
            background: st.bg,
            borderRadius: 10,
            padding: "18px 34px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontSize: 30, color: "#64748b", marginBottom: 6 }}>
            {`${cut.sub.resNo ?? 2} 名前：名無しさん`}
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, color: st.color, lineHeight: 1.45 }}>
            {cut.sub.text}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 160,
        right: 160,
        bottom: 66,
        transform: `scale(${0.92 + 0.08 * s})`,
      }}
    >
      <div
        style={{
          // 決め台詞の強調枠（emph）: オレンジ太枠＋金グロー（競合の「黄縁字幕」2026-07-11）
          border: cut.sub.emph ? "8px solid #ff8c1a" : `6px solid ${st.border}`,
          background: cut.sub.emph ? "#fff8dc" : st.bg,
          borderRadius: 14,
          padding: "26px 40px",
          textAlign: "center",
          fontFamily: FONT,
          fontSize: cut.sub.emph ? 56 : 52,
          fontWeight: 800,
          color: st.color,
          lineHeight: 1.5,
          boxShadow: cut.sub.emph ? "0 0 40px rgba(255,190,40,0.85), 0 12px 34px rgba(0,0,0,0.3)" : "0 12px 34px rgba(0,0,0,0.3)",
        }}
      >
        {cut.sub.text}
      </div>
    </div>
  );
};

// ---------- 全画面タイトルカード（各話の入り） ----------

const TitleCard: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 13, stiffness: 90 } });
  const scale = interpolate(s, [0, 1], [0.6, 1]);
  const rot = interpolate(s, [0, 1], [-6, 0]);
  const flash = interpolate(frame, [0, 6, 14], [1, 0.4, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#111", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* 放射状の集中線背景 */}
      <div style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: 960, top: 540, width: 1600, height: 20,
            background: i % 2 ? "#1c1c1c" : "#000",
            transformOrigin: "0 50%", transform: `rotate(${i * 7.5 + frame * 0.5}deg)`,
          }} />
        ))}
      </div>
      <div style={{
        transform: `scale(${scale}) rotate(${rot}deg)`,
        fontFamily: FONT, fontWeight: 900, fontSize: 138, color: "#fff",
        textAlign: "center", lineHeight: 1.3, padding: "0 80px", whiteSpace: "pre-line",
        textShadow: "0 0 4px #000, 8px 8px 0 #d11, -4px -4px 0 #000",
        WebkitTextStroke: "6px #000",
      }}>
        {text}
      </div>
      {/* 白フラッシュ */}
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---------- 冒頭フックカード（結末チラ見せ・競合分析2026-07-06の定番型） ----------

// 色トークン: {r|…}赤 {y|…}黄 {c|…}水色 {w|…}白。既定は行の基準色。
const HOOK_COLORS: Record<string, string> = { r: "#ff5a4a", y: "#ffd23c", c: "#5bd0ff", w: "#ffffff" };
const parseHookRuns = (s: string): { t: string; col?: string }[] => {
  const runs: { t: string; col?: string }[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "{" && s[i + 2] === "|") {
      const j = s.indexOf("}", i);
      if (j > 0) { runs.push({ t: s.slice(i + 3, j), col: HOOK_COLORS[s[i + 1]] }); i = j + 1; continue; }
    }
    const j = s.indexOf("{", i);
    const end = j === -1 ? s.length : j;
    runs.push({ t: s.slice(i, end) });
    i = end;
  }
  return runs;
};

// 動く暗色背景（フックの緊張感・単調さ回避）: 深い藍のラジアル＋ゆっくり流れる暖色スポット＋走査線
const HookBG: React.FC = () => {
  const frame = useCurrentFrame();
  const gx = 50 + Math.sin(frame * 0.03) * 26;       // スポットが左右にゆっくり漂う
  const gy = 42 + Math.cos(frame * 0.024) * 14;
  const scan = ((frame * 3.2) % 1080) - 120;         // 上から下へ流れる光の走査線
  return (
    <AbsoluteFill style={{ background: "#05070f", overflow: "hidden" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at ${gx}% ${gy}%, rgba(120,60,180,0.42), rgba(20,14,48,0.2) 42%, rgba(3,4,10,1) 78%)`,
      }} />
      <AbsoluteFill style={{
        background: `radial-gradient(circle at ${100 - gx}% 78%, rgba(210,70,60,0.28), rgba(0,0,0,0) 46%)`,
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, top: scan, height: 140,
        background: "linear-gradient(rgba(255,255,255,0) 0%, rgba(160,190,255,0.10) 50%, rgba(255,255,255,0) 100%)",
      }} />
    </AbsoluteFill>
  );
};

const HookCard: React.FC<{ cut: Cut }> = ({ cut }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = cut.hook?.lines ?? [cut.sub.text];
  const active = cut.hook?.active ?? lines.length - 1;
  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
  const mark = spring({ frame, fps, config: { damping: 18, stiffness: 120 }, delay: 3 }); // 下線マーカーの伸び
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <HookBG />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 44, padding: "0 110px" }}>
          {lines.map((line, i) => {
            const isActive = i === active;
            const isPunch = line.startsWith("→");
            const appear = isActive ? pop : 1;
            const base = isPunch ? "#ff5a4a" : isActive ? "#fff" : "rgba(255,255,255,0.4)";
            return (
              <div key={i} style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
                <div style={{
                  fontFamily: FONT, fontWeight: 900, textAlign: "center", lineHeight: 1.4,
                  fontSize: isPunch ? 92 : 74,
                  color: base,
                  transform: `translateY(${(1 - appear) * 40}px) scale(${0.94 + 0.06 * appear})`,
                  opacity: appear,
                  textShadow: isPunch
                    ? "0 0 26px rgba(255,90,74,0.6), 4px 4px 0 #000"
                    : "0 0 18px rgba(120,90,220,0.35), 3px 3px 0 #000",
                }}>
                  {parseHookRuns(line).map((run, k) => (
                    <span key={k} style={run.col ? {
                      color: run.col, textShadow: `0 0 22px ${run.col}88, 3px 3px 0 #000`,
                    } : undefined}>{run.t}</span>
                  ))}
                </div>
                {/* アクティブ行に赤いマーカー下線が伸びる演出 */}
                {isActive && (
                  <div style={{
                    height: 9, marginTop: 6, borderRadius: 5,
                    width: `${mark * 100}%`, marginLeft: `${(1 - mark) * 50}%`,
                    background: isPunch ? "#ff5a4a" : "#ffd23c",
                    boxShadow: `0 0 16px ${isPunch ? "#ff5a4a" : "#ffd23c"}`,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* 上下の黒帯（映画調） */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 90, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90, background: "#000" }} />
    </AbsoluteFill>
  );
};

// ---------- スレ流入（レスが続々と積み上がる） ----------

const ThreadFlood: React.FC<{ cut: Cut }> = ({ cut }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const comments = cut.thread?.comments ?? [];
  const active = cut.thread?.active ?? comments.length - 1;
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ background: "#0b1a2b" }}>
      {/* 掲示板風ヘッダ */}
      <div style={{
        position: "absolute", top: 40, left: 60, right: 60, height: 66,
        background: "#123", borderRadius: 8, color: "#cfe3ff", fontFamily: FONT,
        fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", paddingLeft: 28,
      }}>
        🧵 名無しスレ民の反応
      </div>
      <div style={{ position: "absolute", top: 130, left: 60, right: 60, bottom: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14 }}>
        {comments.map((c, i) => {
          const isActive = i === active;
          const appear = isActive ? pop : 1;
          return (
            <div key={i} style={{
              transform: `translateX(${(1 - appear) * -60}px) scale(${0.85 + 0.15 * appear})`,
              opacity: i < active ? 0.72 : 1,
              transformOrigin: "left center",
              background: isActive ? "#fffef5" : "#eef4fb",
              border: `${isActive ? 5 : 3}px solid ${isActive ? "#f5c518" : "#9db4cc"}`,
              borderRadius: 12, padding: isActive ? "18px 30px" : "12px 26px",
              boxShadow: isActive ? "0 8px 22px rgba(0,0,0,0.35)" : "0 3px 10px rgba(0,0,0,0.2)",
              fontFamily: FONT,
            }}>
              <div style={{ fontSize: 26, color: "#5577aa", marginBottom: 4 }}>
                {`${c.no} 名前：名無しさん`}
              </div>
              <div style={{ fontSize: isActive ? 48 : 40, fontWeight: 700, color: "#16283d", lineHeight: 1.4 }}>
                {c.text}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- カット描画 ----------

const CutView: React.FC<{ cut: Cut }> = ({ cut }) => {
  const frame = useCurrentFrame();
  const shakeX = cut.shake ? Math.sin(frame * 2.7) * interpolate(frame, [0, 12], [14, 0], { extrapolateRight: "clamp" }) : 0;
  const shakeY = cut.shake ? Math.cos(frame * 3.1) * interpolate(frame, [0, 12], [10, 0], { extrapolateRight: "clamp" }) : 0;
  const se = cut.se ? <Audio src={staticFile(`assets/se/${cut.se}.mp3`)} /> : null;

  if (cut.kind === "title") {
    return (
      <AbsoluteFill style={{ transform: `translate(${shakeX}px,${shakeY}px)` }}>
        {se}
        <TitleCard text={cut.title ?? cut.sub.text} />
      </AbsoluteFill>
    );
  }
  if (cut.kind === "thread") {
    return (
      <AbsoluteFill style={{ transform: `translate(${shakeX}px,${shakeY}px)` }}>
        {se}
        <ThreadFlood cut={cut} />
      </AbsoluteFill>
    );
  }
  if (cut.kind === "hook") {
    return (
      <AbsoluteFill style={{ transform: `translate(${shakeX}px,${shakeY}px)` }}>
        {se}
        <HookCard cut={cut} />
      </AbsoluteFill>
    );
  }
  // カメラのゆっくり寄り（anim:"zoom"）: 静止画感を消す常時モーション（競合分析2026-07-11）
  const dur = Math.max(1, Math.round(cut.durSec * FPS));
  const camZoom = cut.anim === "zoom" ? interpolate(frame, [0, dur], [1, 1.07], { extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ transform: `translate(${shakeX}px,${shakeY}px) scale(${camZoom})` }}>
      {se}
      <Background bg={cut.bg} />
      {cut.chars.map((c, i) => (
        <Character key={i} slot={c} />
      ))}
      {(cut.deco ?? []).map((d, i) => (
        <DecoItem key={i} deco={d} index={i} />
      ))}
      <SubtitleBox cut={cut} />
    </AbsoluteFill>
  );
};

export const SukattoVideo: React.FC<{ cuts: Cut[] }> = ({ cuts }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {cuts.map((cut, i) => {
        const dur = Math.max(1, Math.round(cut.durSec * FPS));
        const seq = (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <CutView cut={cut} />
          </Sequence>
        );
        from += dur;
        return seq;
      })}
    </AbsoluteFill>
  );
};

export const totalFrames = (cuts: Cut[]) =>
  cuts.reduce((a, c) => a + Math.max(1, Math.round(c.durSec * FPS)), 0);

// ============ 縦型ショート（紙芝居型・1080×1920 / 競合分析2026-07-08の勝ち筋） ============

export type ShortBannerInfo = { series: string; episode: string; glow: string; quip?: string };

// 感情→バナーのネオングロー色
const SHORT_GLOW: Record<string, string> = {
  gold: "#ffcf3a", red: "#ff5a4a", purple: "#b06bff", orange: "#ff9a3a",
  blue: "#4fb0ff", green: "#42d16a", pink: "#ff6fae",
};

// ① 固定バナー（画面上部・常時表示・感情でグロー色が変化）
// quipTimeline: サブお題可変バー（競合の分析2026-07-14）。cut.quipの切替点を並べ、
// 現フレームの区間のquipを表示する。切替のたびにポップインし直す。""=非表示。
const ShortBanner: React.FC<ShortBannerInfo & { quipTimeline?: { from: number; quip: string }[] }> = ({ series, episode, glow, quip, quipTimeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = SHORT_GLOW[glow] ?? "#ffcf3a";
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 20));
  let activeQuip = quip ?? "";
  let quipFrom = 0;
  for (const seg of quipTimeline ?? []) {
    if (frame >= seg.from) { activeQuip = seg.quip; quipFrom = seg.from; }
  }
  const quipPop = spring({ frame: frame - quipFrom - 18, fps, config: { damping: 11, stiffness: 140 } });
  return (
    <div style={{
      position: "absolute", top: 84, left: 44, right: 44, borderRadius: 30,
      background: "rgba(8,10,20,0.92)", border: `6px solid ${g}`,
      boxShadow: `0 0 ${34 * pulse}px ${g}, 0 0 ${16 * pulse}px ${g}, inset 0 0 20px ${g}55`,
      padding: "24px 30px 30px", textAlign: "center", fontFamily: FONT,
    }}>
      <div style={{ fontSize: 56, fontWeight: 900, color: g, textShadow: "3px 3px 0 #000", lineHeight: 1.1 }}>{series}</div>
      {/* 期待感タイトルは10〜16字＝2行になる想定。\nの手動改行を効かせて語中折れを防ぐ */}
      <div style={{ fontSize: 72, fontWeight: 900, color: "#fff", textShadow: `0 0 18px ${g}, 4px 4px 0 #000`, marginTop: 10, lineHeight: 1.08, whiteSpace: "pre-line" }}>{episode}</div>
      {/* バナー横のツッコミ吹き出し（競合の分析2026-07-13）。
          バナー右上角に重ねる＝字幕エリア(下)と絶対に被らない（2026-07-13 の見直しで移動） */}
      {activeQuip ? (
        <div key={`${activeQuip}-${quipFrom}`} style={{
          position: "absolute", right: -14, top: -44,
          transform: `scale(${quipPop}) rotate(3deg) translateY(${Math.sin(frame / 18) * 4}px)`,
          transformOrigin: "bottom right",
          background: "#fff", border: "5px solid #222", borderRadius: 26,
          padding: "8px 20px", fontSize: 38, fontWeight: 900, color: "#222",
          boxShadow: "0 6px 14px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
        }}>
          {activeQuip}
          <div style={{
            position: "absolute", bottom: -18, left: 44, width: 0, height: 0,
            borderLeft: "13px solid transparent", borderRight: "13px solid transparent",
            borderTop: "20px solid #222",
          }} />
        </div>
      ) : null}
    </div>
  );
};

// LINE風トーク画面の全画面再現（競合の分析2026-07-13: 話の核心をスマホ画面ドンで見せる）
export const PhoneChat: React.FC<{ phone: { title?: string; msgs: { side: "l" | "r"; text: string }[] } }> = ({ phone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 760, height: 1210, marginTop: 210, borderRadius: 56,
        background: "#1c1c22", padding: 22, boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 38, background: "#8aa3c5", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#2c3e5c", color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 40, textAlign: "center", padding: "18px 0" }}>
            {phone.title ?? "トーク"}
          </div>
          <div style={{ flex: 1, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 22 }}>
            {/* テンポ優先で元仕様（7F間隔・受信音なし・holdなし）に戻した（2026-07-13 の見直し2回目） */}
            {phone.msgs.slice(0, 6).map((m, i) => {
              const pop = spring({ frame: frame - 6 - i * 7, fps, config: { damping: 13, stiffness: 150 } });
              const left = m.side === "l";
              return (
                <div key={i} style={{
                  alignSelf: left ? "flex-start" : "flex-end",
                  transform: `scale(${pop})`, transformOrigin: left ? "left center" : "right center",
                  background: left ? "#ffffff" : "#7ce07c",
                  borderRadius: 26, padding: "16px 24px", maxWidth: 520,
                  fontFamily: FONT, fontSize: 42, fontWeight: 700, color: "#222", lineHeight: 1.32,
                  whiteSpace: "pre-line", boxShadow: "0 3px 8px rgba(0,0,0,0.18)",
                }}>
                  {m.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 手書きオノマトペ（「し〜ん」等・競合の分析2026-07-13）
export const OnomatopoeiaText: React.FC<{ o: { text: string; x?: number; y?: number; rot?: number } }> = ({ o }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 120 } });
  const wob = Math.sin(frame / 9) * 2;
  return (
    <div style={{
      position: "absolute", left: `${(o.x ?? 0.5) * 100}%`, top: `${(o.y ?? 0.33) * 100}%`, zIndex: 4,
      transform: `translate(-50%,-50%) scale(${pop}) rotate(${(o.rot ?? -6) + wob}deg)`,
      fontFamily: FONT, fontStyle: "italic", fontWeight: 700, fontSize: 108, letterSpacing: "0.28em",
      color: "#16161a", WebkitTextStroke: "7px #ffffff",
      paintOrder: "stroke fill" as unknown as undefined,
      textShadow: "0 4px 14px rgba(0,0,0,0.35)", whiteSpace: "nowrap",
    }}>
      {o.text}
    </div>
  );
};

// 全画面パーティクル散布（キラキラ=祝福/花=照れ/Zzz=眠り）。絵文字はCIのNoto Emojiで描画
export const ParticleOverlay: React.FC<{ kind: "sparkle" | "flower" | "zzz" }> = ({ kind }) => {
  const frame = useCurrentFrame();
  const ch = kind === "sparkle" ? "✨" : kind === "flower" ? "🌸" : "💤";
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    const x = (i * 137) % 1000 + 40;
    const y = (i * 311) % 1500 + 250;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / 10 + i * 1.7));
    const drift = Math.sin(frame / 16 + i) * 14;
    items.push(
      <div key={i} style={{
        position: "absolute", left: x, top: y + drift, fontSize: 44 + (i % 4) * 26,
        opacity: tw, transform: `rotate(${(i % 2 ? 1 : -1) * (8 + i)}deg)`,
      }}>
        {ch}
      </div>
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{items}</AbsoluteFill>;
};

// 画面ティント（夜/夕方/回想）。競合の分析2026-07-13: 時間帯と心理を色で語る
export const TINT_STYLE: Record<string, React.CSSProperties> = {
  night: { background: "linear-gradient(180deg, rgba(8,18,74,0.5), rgba(10,16,60,0.42))" },
  evening: { background: "linear-gradient(180deg, rgba(255,120,20,0.3), rgba(200,60,60,0.26))" },
  dream: { background: "radial-gradient(ellipse at 50% 40%, rgba(255,190,225,0.24), rgba(190,160,255,0.34))" },
};

// 4分割グリッド（最大4人の顔を田の字に・競合の分析2026-07-13）
const GRID_BG = ["#ffe9a8", "#cfe8ff", "#ffd3e0", "#d5f5d0"];
const ShortGrid: React.FC<{ chars: CharSlot[] }> = ({ chars }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{
      position: "absolute", left: 40, right: 40, top: 620, bottom: 350,
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
                transform: c.flip ? "scaleX(-1)" : undefined, filter: charFilter(c),
              }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// 丸フレーム（鏡・スコープ・競合の分析2026-07-13）
export const ShortCircle: React.FC<{ slot: CharSlot }> = ({ slot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 130 } });
  if (!slot.asset) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 860, height: 860, marginTop: 170, borderRadius: "50%", overflow: "hidden",
        border: "26px solid #ffffff", boxShadow: "0 0 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.3)",
        transform: `scale(${pop})`, position: "relative", background: "#dfe8f2",
      }}>
        <Img src={staticFile(slot.asset)} style={{
          position: "absolute", left: "50%", top: 40, height: 1500,
          transform: `translateX(-50%) ${slot.flip ? "scaleX(-1)" : ""}`, filter: charFilter(slot),
        }} />
      </div>
    </AbsoluteFill>
  );
};

// 後頭部アンカー（主人公の黒い後頭部を画面下中央に置く=一人称の没入視点・2026-07-13）
export const ShortAnchor: React.FC<{ slot: CharSlot }> = ({ slot }) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 24) * 8;
  if (!slot.asset) return null;
  return (
    <div style={{
      position: "absolute", bottom: -360, left: "50%", zIndex: 3,
      transform: `translateX(-50%) translateY(${sway}px)`,
    }}>
      <Img src={staticFile(slot.asset)} style={{
        height: 1250,
        transform: "scaleX(-1)",
        filter: "brightness(0.06) saturate(0.1) blur(2px)",
      }} />
    </div>
  );
};

// 台詞の色分け（競合の分析2026-07-12: 会話「」は色付きで感情の帰属を一目で示す）
const SHORT_SUB_COLOR: Record<string, { color: string; stroke: string }> = {
  male: { color: "#8fd2ff", stroke: "#0e2c56" },
  female_enemy: { color: "#ff8fd0", stroke: "#4a0e35" },
  ally: { color: "#8ff0a8", stroke: "#0c3a1c" },
};

// ② 字幕（バナー直下・上寄り中央・白+紺／山場は赤+白／決め台詞は金・会話は話者色）
// near: 話者近接字幕（競合の分析2026-07-14）。"l"/"r"で話者の頭上側に寄せて配置し、
// 誰のセリフかを位置でも示す（話者色と併用）。
const ShortSub: React.FC<{ text: string; punch?: boolean; speaker?: string; emph?: boolean; near?: "l" | "r" }> = ({ text, punch, speaker, emph, near }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 190 } });
  const sc = speaker ? SHORT_SUB_COLOR[speaker] : undefined;
  const color = punch ? "#ff3b2f" : emph ? "#ffd23a" : sc ? sc.color : "#ffffff";
  const stroke = punch ? "#ffffff" : emph ? "#3a2500" : sc ? sc.stroke : "#16265c";
  const style: React.CSSProperties = {
    position: "relative", fontFamily: FONT, fontWeight: 900, fontSize: punch ? 88 : 74, lineHeight: 1.34,
    whiteSpace: "pre-line",
    color,
    WebkitTextStroke: `${punch ? 9 : 10}px ${stroke}`,
    paintOrder: "stroke fill" as unknown as undefined,
    textShadow: emph
      ? "0 0 26px #ffb800, 0 0 20px #000, 0 6px 0 rgba(0,0,0,0.55)"
      : "0 0 20px #000, 0 0 20px #000, 0 6px 0 rgba(0,0,0,0.55)",
  };
  // 近接時: 頭上（キャラ帯top600の直上）に置き、話者側へ寄せる。文字はやや小さめ
  if (near) style.fontSize = punch ? 76 : 64;
  return (
    <div style={{
      position: "absolute", top: near ? 470 : 344, left: 0, right: 0,
      display: "flex", justifyContent: near === "l" ? "flex-start" : near === "r" ? "flex-end" : "center",
      opacity: s,
    }}>
      <div style={{ position: "relative", maxWidth: near ? 720 : 960, margin: "0 44px", padding: "16px 30px", textAlign: "center", transform: `scale(${0.92 + 0.08 * s})` }}>
        {/* 柔らかい暗い下地（明るい背景でも文字が沈まないように） */}
        <div style={{ position: "absolute", inset: "-8px -6px", background: "rgba(6,8,18,0.4)", filter: "blur(16px)", borderRadius: 44 }} />
        <span style={style}>{text}</span>
      </div>
    </div>
  );
};

// オチ全振りレタリング（競合の分析2026-07-14）: オチの発表だけ演出を全振りする
// 巨大色収差（赤/シアンのズレ＋白本体）レタリングを画面中央にドン。金emphの強化版。
export const PunchLettering: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 1, fps, config: { damping: 9, stiffness: 140 } });
  const wob = Math.sin(frame / 5) * 1.6;
  const ab = 9 + 4 * Math.sin(frame / 3);      // 色収差の幅が脈動して「バリバリ」感を出す
  const layer: React.CSSProperties = {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: FONT, fontWeight: 900, fontSize: 168, lineHeight: 1.16, textAlign: "center",
    whiteSpace: "pre-line", padding: "0 30px",
  };
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: 620, height: 900, zIndex: 6,
      transform: `scale(${0.4 + 0.6 * pop}) rotate(${-5 + wob}deg)`,
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

// ③ 大きなイラスト（全画面の主役・下寄せ・毎シーン差し替え・動きを大きく）
const ShortChar: React.FC<{ slot: CharSlot; count: number; index: number; anim?: string; punch?: boolean }> = ({ slot, count, index, anim, punch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = slot.entrance ?? "slide";
  const boing = spring({ frame, fps, config: { damping: 9, stiffness: 130 } });   // オーバーシュート
  const smooth = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  // 常時アニメ（棒立ち防止・大きめ）
  const bob = Math.sin(frame / 8 + index * 2) * 18;
  const swayRot = Math.sin(frame / 22 + index) * 2.2;
  const breathe = 1 + 0.03 * Math.sin(frame / 6 + index);
  let tx = 0, ty = bob, rot = swayRot, sc = 1, sx = 1, sy = 1;
  const dir = index % 2 === 0 ? -1 : 1;
  if (punch || anim === "zoom") {                 // ズームインパクト（山場・決め台詞）
    sc *= interpolate(frame, [0, 6], [1.45, 1.0], { extrapolateRight: "clamp" });
  } else if (anim === "lunge") {                  // 大きく踏み込む（アクション）
    tx += interpolate(boing, [0, 1], [dir * 480, 0]);
    rot += interpolate(frame, [0, 8, 18], [dir * 12, -dir * 4, 0], { extrapolateRight: "clamp" });
    sc *= interpolate(frame, [0, 8], [1.22, 1.0], { extrapolateRight: "clamp" });
  } else if (anim === "pop") {                    // 飛び出す
    sc *= boing;
  } else if (anim === "burstin") {                // 画面奥から勢いよく飛び込む（速度線と併用・漫画風の演出）
    sc *= interpolate(boing, [0, 1], [0.45, 1]);
    tx += interpolate(boing, [0, 1], [dir * 260, 0]);
    rot += interpolate(frame, [0, 8, 16], [dir * 9, -dir * 3, 0], { extrapolateRight: "clamp" });
  } else if (anim === "shakebody") {              // 怒りの小刻み振動（継続・漫画風の演出）
    tx += Math.sin(frame * 2.6) * 12;
    rot += Math.sin(frame * 3.1) * 3.2;
    sc *= 1.04;
  } else if (anim === "recoil") {                 // のけぞり被弾（後方へ弾かれて戻る・漫画風の演出）
    tx += interpolate(frame, [0, 5, 22], [0, dir * -150, 0], { extrapolateRight: "clamp" });
    rot += interpolate(frame, [0, 5, 22], [0, dir * 18, 0], { extrapolateRight: "clamp" });
  } else if (entrance === "slide") {              // 通常入場（大きめスライド＋オーバーシュート）
    tx += interpolate(boing, [0, 1], [dir * 340, 0]);
  } else if (entrance === "pop") {
    sc *= smooth;
  }
  sc *= (slot.scale ?? 1) * breathe;
  // 転倒（回転して倒れる）: ショート側にも移植（競合の分析2026-07-12）
  // 中心回転で「その場でひっくり返る」見せ方（QAで80度+端回転は画面外へ転がり出た）
  if (slot.fall) {
    const fallS = spring({ frame: frame - 3, fps, config: { damping: 13, stiffness: 90 } });
    rot += fallS * -dir * 65;
    ty += fallS * -120;         // 倒れた体が下端に沈まないよう持ち上げ
    // 着地のsquash&stretch（一瞬つぶれて戻る・カートゥーン感／漫画風の演出2026-07-21）
    const sq = interpolate(frame, [3, 9, 17], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    sx += sq * 0.22; sy -= sq * 0.22;
  }
  // 全身立ち絵（full_*.png）は縦長なので大きく・下寄せを深くして「地面に立つ」見せ方（完コピ品質2026-07-13）
  const isFull = !!slot.asset && /\/full_[^/]+\.png$/.test(slot.asset);
  const h = isFull ? (count >= 2 ? 1050 : 1230) : count >= 2 ? 780 : 920;
  if (isFull) ty += 150;                          // 足元をセーフゾーン下端近くまで下げる
  const fallback = slot.asset ? slot.asset.replace(/[^/]+\.png$/, isFull ? "full_normal.png" : "normal.png") : undefined;
  const [src, setSrc] = React.useState(slot.asset);
  React.useEffect(() => setSrc(slot.asset), [slot.asset]);
  const vfx = charFilter(slot);
  return (
    <div style={{ position: "relative", transform: `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(${sc * sx},${sc * sy})` }}>
      {src ? (
        <Img src={staticFile(src)} onError={() => { if (fallback && src !== fallback) setSrc(fallback); }}
          style={{ height: h, transform: slot.flip ? "scaleX(-1)" : undefined,
            filter: vfx ? `${vfx} drop-shadow(0 12px 22px rgba(0,0,0,0.45))` : "drop-shadow(0 12px 22px rgba(0,0,0,0.45))" }} />
      ) : null}
      {/* ショートはキャラが大きいので漫符も大きく（競合の分析2026-07-12） */}
      {slot.marks?.map((m, i) => <MarkIcon key={i} mark={m} index={i} size={190} />)}
      {/* 思考バブル（内心の図示）をショートにも移植（2026-07-13） */}
      {slot.thought && <ThoughtBubble icon={slot.thought} />}
    </div>
  );
};

// 巨大漫符: 画面1/4級の「!?」（競合の分析2026-07-12: 漫符は遠慮せず巨大に）
const GiantMark: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { damping: 9, stiffness: 170 } });
  const wobble = Math.sin(frame / 3) * 3;
  return (
    <div style={{
      position: "absolute", top: 560, right: 40, zIndex: 5,
      transform: `scale(${pop}) rotate(${-8 + wobble}deg)`, transformOrigin: "center",
      fontFamily: FONT, fontWeight: 900, fontSize: 330, lineHeight: 1,
      color: "#ff2b1f", WebkitTextStroke: "16px #ffffff",
      paintOrder: "stroke fill" as unknown as undefined,
      textShadow: "0 0 34px rgba(0,0,0,0.6), 10px 12px 0 rgba(0,0,0,0.35)",
    }}>
      {text}
    </div>
  );
};

// 顔の超大写し（競合の分析2026-07-12: 顔が画面の70%を占めるCUショット）
const ShortCloseup: React.FC<{ slot: CharSlot }> = ({ slot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 160 } });
  const zoom = 1.02 + Math.min(frame / 240, 1) * 0.08;   // CU中もさらにゆっくり寄る
  const fallback = slot.asset ? slot.asset.replace(/[^/]+\.png$/, "normal.png") : undefined;
  const [src, setSrc] = React.useState(slot.asset);
  React.useEffect(() => setSrc(slot.asset), [slot.asset]);
  if (!src) return null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: "50%", top: 330,
        transform: `translateX(-50%) scale(${(0.94 + 0.06 * s) * zoom})`, transformOrigin: "50% 20%",
      }}>
        <Img src={staticFile(src)} onError={() => { if (fallback && src !== fallback) setSrc(fallback); }}
          style={{ height: 2350, transform: slot.flip ? "scaleX(-1)" : undefined, filter: charFilter(slot) }} />
      </div>
      {(slot.marks ?? []).map((m, i) => (
        <div key={i} style={{ position: "absolute", top: 560 + i * 60, right: 90 + i * 210 }}>
          <MarkIcon mark={m} index={i} size={230} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

// 肩越しショットの手前遮蔽キャラ（暗く・ぼかし・大きく）。競合の分析2026-07-12
export const ShortOccluder: React.FC<{ slot: CharSlot }> = ({ slot }) => {
  const frame = useCurrentFrame();
  const left = slot.x < 0.5;
  const sway = Math.sin(frame / 26) * 10;
  if (!slot.asset) return null;
  // 画面の隅から1/3だけ覗く構図（QAで中央占領→被写体が隠れたため大きく外へ逃がす）
  const pos: React.CSSProperties = left ? { left: -520 } : { right: -520 };
  return (
    <div style={{
      position: "absolute", bottom: -300, zIndex: 3, ...pos,
      transform: `translateY(${sway}px)`,
    }}>
      <Img src={staticFile(slot.asset)} style={{
        height: 1650,
        // 画面中央（奥の被写体）の方を向かせる
        transform: left ? "scaleX(-1)" : undefined,
        filter: "brightness(0.3) saturate(0.55) blur(7px)",
      }} />
    </div>
  );
};

// 小物インサート（deco 1個目を画面中央に大写し）。競合の分析2026-07-12
export const ShortInsert: React.FC<{ deco: { img: string; x: number; y: number; scale?: number } }> = ({ deco }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { damping: 10, stiffness: 140 } });
  const sway = Math.sin(frame / 14) * 3;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${pop * (deco.scale ?? 1)}) rotate(${sway}deg)`, marginTop: 240 }}>
        <Img src={staticFile(deco.img)} style={{ height: 780, filter: "drop-shadow(0 24px 44px rgba(0,0,0,0.5))" }} />
      </div>
    </AbsoluteFill>
  );
};

// スピード線（動き・アクション時に横方向の流線が走る）。漫画風の演出2026-07-21
export const SpeedLines: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 3, 13, 22], [0, 0.9, 0.9, 0], { extrapolateRight: "clamp" });
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const y = (i * 77 + 14) % 1900;
    const len = 320 + (i % 5) * 200;
    const x = ((i * 151 + frame * 120) % (1480 + 400)) - 400;
    lines.push(
      <div key={i} style={{
        position: "absolute", top: y, left: x, width: len, height: 2 + (i % 3) * 3,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)",
      }} />
    );
  }
  return <AbsoluteFill style={{ zIndex: 4, opacity, mixBlendMode: "screen", pointerEvents: "none" }}>{lines}</AbsoluteFill>;
};

// 決めフラッシュ（カット頭で画面が一瞬白く光る）。漫画風の演出2026-07-21
export const FlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 2, 9], [0.85, 0.6, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#fff", opacity: o, zIndex: 7, pointerEvents: "none" }} />;
};

const ShortCutView: React.FC<{ cut: Cut; index: number }> = ({ cut, index }) => {
  const frame = useCurrentFrame();
  const anim = cut.anim;
  const punch = cut.punch;
  const shot = cut.shot;
  // 山場・shake・ズーム時は画面全体を強めに揺らす
  const amp = cut.shake ? 16 : punch ? 9 : 0;
  const shakeX = amp ? Math.sin(frame * 2.8) * interpolate(frame, [0, 14], [amp, 0], { extrapolateRight: "clamp" }) : 0;
  const shakeY = amp ? Math.cos(frame * 3.2) * interpolate(frame, [0, 14], [amp * 0.7, 0], { extrapolateRight: "clamp" }) : 0;
  // 常時カメラ（競合の分析2026-07-12: 1秒たりとも同じ絵にしない）。カット順で寄り/引きを交互に
  const dur = Math.max(1, Math.round(cut.durSec * FPS));
  const camIn = index % 2 === 0;
  const cam = interpolate(frame, [0, dur], camIn ? [1.02, 1.1] : [1.11, 1.03], { extrapolateRight: "clamp" });
  const camPanX = Math.sin(frame / 46 + index * 2.3) * 9;
  const se = cut.se ? <Audio src={staticFile(`assets/se/${cut.se}.mp3`)} volume={0.5} /> : null;
  const chars = cut.chars ?? [];
  // ショット解決: closeup/insert/phone/grid/circle=通常バンド非表示 / ots・anchor=最後の1人を手前に回す
  const hideStage = shot === "closeup" || shot === "insert" || shot === "grid" || shot === "circle" || !!cut.phone;
  const pullLast = (shot === "ots" || shot === "anchor") && chars.length >= 2;
  const stageChars = hideStage ? [] : pullLast ? chars.slice(0, -1) : chars;
  const bg = cut.bg ?? "abstract:dots";
  // DOF: 写真背景のときは背景をぼかして主役にピント（インサートは小物が主役なのでそのまま）
  const dof = bg.startsWith("assets/") && shot !== "insert" && !cut.phone && chars.length > 0;
  // ホワイトパン転換（競合の分析2026-07-13: カット頭の横流れブラーで場面替わりを演出）
  const whip = cut.trans === "whip";
  const whipBlur = whip ? interpolate(frame, [0, 7], [16, 0], { extrapolateRight: "clamp" }) : 0;
  const whipX = whip ? interpolate(frame, [0, 7], [-260, 0], { extrapolateRight: "clamp" }) : 0;
  // 放心・夢の全画面ぼかし
  const daze = cut.tint === "daze";
  const contentFilter = [
    whipBlur > 0.2 ? `blur(${whipBlur}px)` : "",
    daze ? "blur(7px) brightness(1.06)" : "",
  ].join(" ").trim();
  return (
    <AbsoluteFill style={{ transform: `translate(${shakeX}px,${shakeY}px)` }}>
      {se}
      <AbsoluteFill style={{ transform: `translateX(${whipX}px)`, filter: contentFilter || undefined }}>
        <AbsoluteFill style={{ transform: `scale(${cam}) translateX(${camPanX}px)` }}>
          <AbsoluteFill style={{ filter: dof ? "blur(7px) saturate(1.08)" : undefined, transform: dof ? "scale(1.04)" : undefined }}>
            <Background bg={bg} />
          </AbsoluteFill>
          {/* DOF時のビネット（周辺減光でレンズ感を出す） */}
          {dof ? <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.42) 100%)" }} /> : null}
          {shot === "closeup" && chars[0] ? <ShortCloseup slot={chars[0]} /> : null}
          {shot === "circle" && chars[0] ? <ShortCircle slot={chars[0]} /> : null}
          {shot === "grid" ? <ShortGrid chars={chars} /> : null}
          {shot === "insert" && cut.deco?.[0] ? <ShortInsert deco={cut.deco[0]} /> : null}
          {cut.phone ? <PhoneChat phone={cut.phone} /> : null}
          {/* 大イラスト（下寄せ・下部セーフゾーン約320pxは避ける）。ots/anchorは手前キャラの反対側へ寄せる */}
          {stageChars.length > 0 ? (
            <div style={{
              position: "absolute", left: 0, right: 0, top: 600, bottom: 330,
              display: "flex", gap: 24, alignItems: "flex-end", justifyContent: "center",
              transform: shot === "ots" && chars.length >= 2 ? `translateX(${chars[chars.length - 1].x < 0.5 ? 190 : -190}px)` : undefined,
            }}>
              {stageChars.map((c, i) => <ShortChar key={i} slot={c} count={stageChars.length} index={i} anim={anim} punch={punch} />)}
            </div>
          ) : null}
          {/* 小物散らし（インサート以外でも使える・長尺から移植） */}
          {shot !== "insert" ? (cut.deco ?? []).map((d, i) => <DecoItem key={i} deco={d} index={i} />) : null}
          {shot === "ots" && chars.length >= 2 ? <ShortOccluder slot={chars[chars.length - 1]} /> : null}
          {shot === "anchor" && chars.length >= 2 ? <ShortAnchor slot={chars[chars.length - 1]} /> : null}
          {/* 時間帯・心理のティント（dazeはぼかしのみ） */}
          {cut.tint && cut.tint !== "daze" ? <AbsoluteFill style={TINT_STYLE[cut.tint]} /> : null}
          {cut.fx && cut.fx !== "speedlines" ? <ParticleOverlay kind={cut.fx} /> : null}
        </AbsoluteFill>
      </AbsoluteFill>
      {/* スピード線（動き系animか fx:speedlines で発火）。漫画風の演出2026-07-21 */}
      {(cut.fx === "speedlines" || anim === "burstin" || anim === "lunge" || anim === "recoil") ? <SpeedLines /> : null}
      {cut.otext ? <OnomatopoeiaText o={cut.otext} /> : null}
      {cut.bigmark ? <GiantMark text={cut.bigmark} /> : null}
      {cut.lettering ? <PunchLettering text={cut.lettering} /> : null}
      {cut.flash ? <FlashOverlay /> : null}
      {/* 字幕（上寄り中央・カメラの外＝常にシャープ） */}
      <ShortSub text={cut.sub.text} punch={punch} speaker={cut.sub.speaker} emph={cut.sub.emph} near={cut.sub.near} />
    </AbsoluteFill>
  );
};

// ⚠ v2 でない回と共用＝既定の見た目を変えない。新しい型は src/ShortV2.tsx（"style":"v2" の回だけ・Root の入口で分ける）
export const SukattoShort: React.FC<{ cuts: Cut[]; banner?: ShortBannerInfo }> = ({ cuts, banner }) => {
  let from = 0;
  // サブお題可変バー: cut.quipが指定されたカットの開始フレームを切替点として集める
  const quipTimeline: { from: number; quip: string }[] = [];
  {
    let f = 0;
    for (const cut of cuts) {
      if (cut.quip !== undefined) quipTimeline.push({ from: f, quip: cut.quip });
      f += Math.max(1, Math.round(cut.durSec * FPS));
    }
  }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {cuts.map((cut, i) => {
        const dur = Math.max(1, Math.round(cut.durSec * FPS));
        const seq = (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <ShortCutView cut={cut} index={i} />
          </Sequence>
        );
        from += dur;
        return seq;
      })}
      {banner ? <ShortBanner {...banner} quipTimeline={quipTimeline.length ? quipTimeline : undefined} /> : null}
    </AbsoluteFill>
  );
};
