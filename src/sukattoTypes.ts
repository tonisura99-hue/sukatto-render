// スカッと工場: カット仕様の型定義
// 台本生成側がこの形式で scenes を出力し、SukattoVideo が描画する

export type Speaker =
  | "narration"      // 地の文・男性視点（黄）
  | "narration_f"    // 地の文・女性視点（黄）
  | "male"           // 男性セリフ（青）
  | "female_enemy"   // 女性敵役（ピンク）
  | "ally"           // 味方・友人（緑）
  | "thread";        // スレ民レス（白・レス枠）

// assets/mark/ 配下の全アセット名を許可（shock/hatena/steam/kirakira1等・競合分析2026-07-13で全開放）
// v2 の書式（2026-11-13 ④）："anger*4"＝1つずつ増える（A-24）／"anger*3~"＝位置を替えて点滅（B-18）
export type Mark = string;

/** 顔の台帳（tools/char_meta.py → meta.json → make_episode.py が写す・v2 の回だけ）。
 *  x・w＝絵の幅、y＝絵の高さに対する割合。ar＝絵の幅÷高さ。2026-11-13 ④ */
export type HeadMeta = { x: number; y: number; w: number; ar: number };

export type CharSlot = {
  /** キャラ画像（public/assets/char/ 配下の相対パス）。無ければプレースホルダー描画 */
  asset?: string;
  /** プレースホルダー用のラベル（例: 夫） */
  label: string;
  /** 表情ラベル（プレースホルダー表示・検品用） */
  expression: string;
  /** 位置 0=左端, 1=右端 */
  x: number;
  scale?: number;
  flip?: boolean;
  entrance?: "slide" | "pop" | "none";
  marks?: Mark[];
  /** 思考バブル（頭上のもくもく雲に出すアイコン画像パス）。競合分析2026-07-06で導入 */
  thought?: string;
  /** シルエット（正体不明の人物を黒塗りで出す）。競合分析2026-07-11で導入 */
  sil?: boolean;
  /** 転倒（回転して倒れる=被弾・敗北の表現）。競合分析2026-07-11で導入 */
  fall?: boolean;
  /** 石化（同素材をグレースケール＋石質感で変身させる）。競合の分析2026-07-12で導入 */
  stone?: boolean;
  /** モブ減彩（主役だけカラーに見せる半透明・低彩度）。競合の分析2026-07-12で導入 */
  ghost?: boolean;
  /** 顔の台帳（v2 の回だけ。大きさ・位置・頭のまわりの印に使う）。2026-11-13 ④ */
  head?: HeadMeta;
};

/** 小物イラストの散らし配置（家事アイテム・料理などを画面に3〜5個ポップイン）。競合分析2026-07-11 */
export type Deco = { img: string; x: number; y: number; scale?: number };

export type ThreadComment = { no: number; text: string };

export type Cut = {
  /** カット種別。省略時は通常（キャラ＋字幕） */
  kind?: "normal" | "title" | "thread" | "hook";
  /**
   * 背景:
   * - "abstract:dots|speed|focus" 従来
   * - "abstract:swirl_purple|swirl_red|swirl_blue" 渦巻き(不満/緊迫/動揺)
   * - "abstract:zigzag_orange|zigzag_blue" ジグザグ(コミカル切迫/日常の違和感)
   * - "abstract:flame_red|flame_green" 火炎(断罪/静かな怒り)
   * - "abstract:lightning|gold|mono" 稲妻(衝撃)/金ラメ(勝利・和解)/モノクロ煙(回想・録画)
   * - "typo:法" 漢字1文字タイポ背景
   * - 画像パス(public/assets/bg/) / "scene:決め絵名"
   */
  bg: string;
  chars: CharSlot[];
  sub: { text: string; speaker: Speaker; resNo?: number; emph?: boolean; near?: "l" | "r" };
  /** 小物イラストの散らし（最大4個目安・ポップイン）。競合分析2026-07-11 */
  deco?: Deco[];
  /** カメラ演出: "zoom"=ゆっくり寄る（長尺でも有効化・2026-07-11） */
  anim?: string;
  /** kind==="title": 全画面に出す大タイトル文字 */
  title?: string;
  /** kind==="thread": これまで積み上がったレス一覧＋今アクティブな添字 */
  thread?: { comments: ThreadComment[]; active: number };
  /** kind==="hook": 冒頭フック（結末チラ見せ）。lines=積み上げる行、active=今読んでいる行 */
  hook?: { lines: string[]; active: number };
  /** 画面振動（衝撃シーン） */
  shake?: boolean;
  /** カット頭の効果音（public/assets/se/<名前>.mp3） */
  se?: string;
  /** 縦型ショートの山場字幕（赤+白） */
  punch?: boolean;
  /**
   * ショット指定（縦型ショート・競合の分析2026-07-12／07-13で拡張）:
   * - "closeup" 顔の超大写し（1人目のキャラの顔が画面を占める）
   * - "ots"     肩越しショット（最後のキャラを手前に暗くぼかして大きく置き、奥にピント）
   * - "insert"  小物インサート（decoの1個目を画面中央に大写し・キャラ非表示）
   * - "anchor"  主人公の後頭部アンカー（最後のキャラを画面下中央に黒後頭部として置く=一人称の没入視点）
   * - "grid"    4分割グリッド（最大4人の顔を田の字に並べる）
   * - "circle"  丸フレーム（1人目を円形マスクの中に大写し=鏡・スコープ）
   */
  shot?: "closeup" | "ots" | "insert" | "anchor" | "grid" | "circle";
  /** 巨大漫符（画面1/4級のテキスト漫符 "!?" "!" "?" "✕" など）。競合の分析2026-07-12 */
  bigmark?: string;
  /** カット頭のホワイトパン転換（横流れブラーで場面替わり）。競合の分析2026-07-13
   *  v2：{ black: n }＝行の頭を n コマ黒にする暗転（B-12・帯と字幕は黒の上にも出す）2026-11-13 ④ */
  trans?: "whip" | { black: number };
  /** v2：白黒 "bg"＝背景だけ／"all"＝絵全体（帯と字幕は色のまま）。B-19・2026-11-13 ④ */
  bw?: "bg" | "all";
  /** 画面ティント: night=夜の青被せ/evening=夕方/dream=回想ピンク/daze=放心の全画面ぼかし */
  tint?: "night" | "evening" | "dream" | "daze";
  /** 手書きオノマトペ（「し〜ん」等を画面に直書き）。競合の分析2026-07-13 */
  otext?: { text: string; x?: number; y?: number; rot?: number };
  /** LINE風トーク画面の全画面再現。競合の分析2026-07-13 */
  phone?: { title?: string; msgs: { side: "l" | "r"; text: string }[] };
  /** 全画面パーティクル散布: sparkle=キラキラ/flower=花(照れ)/zzz=眠り/speedlines=スピード線(動き・アクション) */
  fx?: "sparkle" | "flower" | "zzz" | "speedlines";
  /** 決めフラッシュ: カット頭で画面が一瞬光る（山場の強調）。漫画風の演出2026-07-21 */
  flash?: boolean;
  /** サブお題可変バー: このカット以降のバナーquipを差し替える（""で非表示）。競合の分析2026-07-14 */
  quip?: string;
  /** オチ全振りレタリング: 巨大色収差文字を画面中央にドン（オチの発表専用）。競合の分析2026-07-14 */
  lettering?: string;
  /** 尺（秒）。将来は音声タイムラインが上書きする */
  durSec: number;
  /** v2：前の行の絵を続ける（字幕だけ替わる＝A-03 の切り離し）。2026-11-13 ⑤ */
  cont?: boolean;
};

// ---------- v2 のショットとカメラ（2026-11-13 ⑤。tools/shots_v2.py が cuts.json の "shots" に書き、ShortV2.tsx が描く） ----------
/** カメラ（土台2・設計書 §2-2）。f＝ショットの頭からのコマ。to＝配役名（顔の台帳の頭）か世界の座標 [x, y]（画面＝0〜1） */
export type CamV2 = {
  f: number;
  kind: "push" | "rush" | "settle" | "crash" | "pullout" | "steps" | "hold";
  to?: string | [number, number];
  amount?: number;
  sec?: number;
  wait?: number;
  frames?: number;
  every?: number;
  step?: number;
  max?: number;
};
/** ショットの中の人物。t0＝その人物の時計の0（ショットの頭からのコマ。cut の後は負もある）。mt0＝印ごとの出る時刻（t0 から） */
export type ShotChar = CharSlot & { t0?: number; anim?: string; front?: boolean; mt0?: number[] };
export type ShotDeco = Deco & { t0?: number };
/** ショットの中の「今の絵」（f コマから、次の状態の f まで） */
export type ShotState = {
  f: number;
  bg: string;
  chars: ShotChar[];
  shot?: Cut["shot"];
  deco?: ShotDeco[];
  tint?: Cut["tint"];
  fx?: Cut["fx"];
  bw?: "bg" | "all";
  phone?: Cut["phone"];
};
/** ショット＝絵が切れ目なく続く区間（行より短いことも、行をまたぐこともある） */
export type ShotV2 = {
  from: number;
  dur: number;
  lines?: number[];
  trans?: Cut["trans"];
  cut?: boolean;
  segs: ShotState[];
  cams: CamV2[];
  bounce?: number[];
};

export const SPEAKER_STYLE: Record<Speaker, { border: string; bg: string; color: string }> = {
  narration: { border: "#f5c518", bg: "rgba(255,255,255,0.96)", color: "#222" },
  narration_f: { border: "#f5c518", bg: "rgba(255,255,255,0.96)", color: "#222" },
  male: { border: "#3b82f6", bg: "rgba(255,255,255,0.96)", color: "#222" },
  female_enemy: { border: "#ec4899", bg: "rgba(255,255,255,0.96)", color: "#222" },
  ally: { border: "#22c55e", bg: "rgba(255,255,255,0.96)", color: "#222" },
  thread: { border: "#94a3b8", bg: "rgba(245,248,252,0.97)", color: "#1a3350" },
};
