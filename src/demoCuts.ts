// 動作確認用デモカット（審査台本「誰でもできる経理マニュアル」の冒頭を実素材で映像化）
import { Cut } from "./sukattoTypes";

export const DEMO_CUTS: Cut[] = [
  {
    bg: "abstract:focus",
    chars: [
      { asset: "assets/char/man_suit/normal.png", label: "ワイ", expression: "通常", x: 0.5, entrance: "pop" },
    ],
    sub: { text: "先月クビになった会社から、今週だけで着信23件や。", speaker: "narration" },
    durSec: 4,
  },
  {
    bg: "abstract:dots",
    chars: [],
    sub: { text: "自慢か？と思ったけど23件は草。kwsk", speaker: "thread", resNo: 2 },
    durSec: 3,
  },
  {
    bg: "assets/bg/office.png",
    chars: [
      { asset: "assets/char/man_suit/surprise.png", label: "ワイ", expression: "驚き", x: 0.26, marks: ["sweat"] },
      { asset: "assets/char/ojisan/laugh.png", label: "専務", expression: "ドヤ笑い", x: 0.76, flip: true, marks: ["sparkle"] },
    ],
    sub: { text: "経理なんて、今どきソフトがあれば誰でもできるよね", speaker: "male" },
    durSec: 4.5,
  },
  {
    bg: "assets/bg/office.png",
    chars: [
      { asset: "assets/char/man_suit/rage.png", label: "ワイ", expression: "激怒", x: 0.26, marks: ["anger"], entrance: "none" },
      { asset: "assets/char/ojisan/normal.png", label: "専務", expression: "通常", x: 0.76, flip: true, entrance: "none" },
    ],
    sub: { text: "面談室で言われた言葉、一言一句忘れとらんで。", speaker: "narration" },
    shake: true,
    durSec: 3.5,
  },
  {
    bg: "abstract:speed",
    chars: [
      { asset: "assets/char/man_suit/laugh.png", label: "ワイ", expression: "笑い", x: 0.5, entrance: "pop", marks: ["sparkle"] },
    ],
    sub: { text: "引き継ぎだけは完璧にしたった。マニュアル212ページや。", speaker: "narration" },
    durSec: 4,
  },
  {
    bg: "assets/bg/living.jpg",
    chars: [
      { asset: "assets/char/ojisan/pale.png", label: "専務", expression: "顔面蒼白", x: 0.5, marks: ["gloom"] },
    ],
    sub: { text: "月次決算で、240万の謎のズレが出た。", speaker: "narration" },
    durSec: 3.5,
  },
  {
    bg: "abstract:dots",
    chars: [],
    sub: { text: "タイトルに悪意がこもっとるんよw", speaker: "thread", resNo: 11 },
    durSec: 3,
  },
];
