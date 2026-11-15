import React from "react";
import { Composition } from "remotion";
import { SukattoVideo, totalFrames, FPS } from "./SukattoVideo";
import { SukattoShortEntry, BannerLabV2 } from "./ShortV2";
import { DEMO_CUTS } from "./demoCuts";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* デモ・動作確認用 */}
      <Composition
        id="SukattoDemo"
        component={SukattoVideo}
        durationInFrames={totalFrames(DEMO_CUTS)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ cuts: DEMO_CUTS }}
      />
      {/* 本番用: --props=episodes/<slug>/cuts.json で話数データを注入。尺はcutsから自動算出 */}
      <Composition
        id="Sukatto"
        component={SukattoVideo}
        durationInFrames={totalFrames(DEMO_CUTS)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ cuts: DEMO_CUTS }}
        calculateMetadata={({ props }) => ({
          durationInFrames: totalFrames(props.cuts),
        })}
      />
      {/* 縦型ショート（紙芝居型）: --props=episodes/shorts/<id>/cuts.json
          入口で切り替え：cuts.json に "style":"v2" がある回だけ src/ShortV2.tsx の新しい型（2026-11-13 ④）。
          無い回は今の SukattoShort のまま */}
      <Composition
        id="SukattoShort"
        component={SukattoShortEntry}
        durationInFrames={totalFrames(DEMO_CUTS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ cuts: DEMO_CUTS, banner: { series: "スカッとスレ", episode: "サンプル", glow: "gold" } }}
        calculateMetadata={({ props }) => ({
          durationInFrames: totalFrames(props.cuts),
        })}
      />
      {/* v2 の帯の見比べ（still 1枚に型を縦に並べる・2026-11-13 ⑥）。動画の焼きには使わない */}
      <Composition
        id="BannerLabV2"
        component={BannerLabV2}
        durationInFrames={1}
        fps={FPS}
        width={1080}
        height={2000}
        defaultProps={{}}
      />
    </>
  );
};
