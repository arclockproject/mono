//#region Imports

import { Box, Button, Typography } from "@mui/material";
import Slider from "@mui/material/Slider";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import {
  MMDLoadDetails,
  overlay75,
  overlay90,
  type SimpleVector,
} from "./config";

//#endregion

//#region MorphDrawer.tsx

const defaultBodyNames = [
  `まばたき`,
  `笑い`,
  `なごみ`,
  `ウィンク`,
  `ウィンク右`,
  `ウィンク２`,
  `ウィンク２右`,
  `なごみ左`,
  `なごみ右`,
  `びっくり`,
  `じと目`,
  `悲しむ`,
  `怒り目`,
  `ジト目`,
  `眼角上`,
  `眼角下`,
  `下眼上`,
  `下眼上２`,
  `真面目`,
  `困る`,
  `にこり`,
  `怒り`,
  `恥ずかしい`,
  `上`,
  `下`,
  `前`,
  `困る左`,
  `困る右`,
  `にこり左`,
  `にこり右`,
  `怒り左`,
  `怒り右`,
  `恥ずかしい左`,
  `恥ずかしい右`,
  `上左`,
  `上右`,
  `下左`,
  `下右`,
  `前左`,
  `前右`,
  `あ`,
  `い`,
  `う`,
  `え`,
  `お`,
  `にやり`,
  `ワ`,
  `ん`,
  `い１`,
  `い２`,
  `あ２`,
  `にやり２`,
  `にやり３`,
  `ω`,
  `てへぺろ`,
  `ぺろっ`,
  `口角上げ`,
  `口角下げ`,
  `口横広げ`,
  `口横狭め`,
  `舌広げ`,
  `はぅ`,
  `ｷﾘｯ`,
  `ｷﾘｯ1`,
  `ｷﾘｯ2`,
  `ｷﾘｯ3`,
  `ｷﾘｯ4`,
  `ｷﾘｯ5`,
  `びっくり1`,
  `じと目1`,
  `い1`,
  `お1`,
  `にやり3`,
  `ワ1`,
  `ワ2`,
  `□`,
  `□1`,
  `□2`,
  `□3`,
  `□4`,
  `□5`,
  `□6`,
  `□7`,
  `口下`,
  `口上`,
  `口横広げ1`,
  `口横広げ2`,
  `口角下げ0`,
  `口角下げ1`,
  `口角下げ2`,
  `口角下げ3`,
  `口角下げ4`,
  `口角下げ5`,
  `口横缩げ`,
  `口横缩げ1`,
  `う２`,
  `え２`,
  `∧`,
  `▲`,
  `叫び`,
  `ω□`,
  `m`,
  `にっこり`,
  `いやだ`,
  `なんで`,
  `あE`,
  `あ2E`,
  `いE`,
  `い2E`,
  `うE`,
  `う2E`,
  `えE`,
  `え2E`,
  `おE`,
  `▲E`,
  `□E`,
  `ワE`,
  `叫びE`,
  `ωE`,
  `ω□E`,
  `にやりE`,
  `にっこりE`,
  `いやだE`,
  `なんでE`,
  `グル目E`,
  `はちゅ目`,
  `い2`,
  `い3`,
  `え1`,
  `笑い1`,
  `瞳上`,
  `瞳上２`,
  `瞳下`,
  `瞳左`,
  `瞳右`,
  `カメラ目線`,
  `カメラ目線2`,
  `離れ目`,
  `寄り目`,
  `瞳小`,
  `瞳大`,
  `瞳孔大`,
  `困る2`,
  `じと眉`,
  `眉上移動`,
  `眉下移動`,
  `口小`,
  `口大`,
  `口前`,
  `あ３`,
  `~~`,
  `にぃー`,
  `にぃー２`,
  `にっこり２`,
  `ぷく～_左`,
  `ぷく～_右`,
  `ぺろっ1`,
  `ぺろっ2`,
  `小_あご`,
];

function MorphEntry(props: {
  morph: string;
  mobile: boolean;
  targetAll: boolean;
}) {
  const [mode, setMode] = useState(false);
  const [current, setCurrent] = useState(() => {
    return (
      MMDLoadDetails.modelMorph[MMDLoadDetails.focusedModel]?.getMorphWeight(
        props.morph,
      ) ?? 0
    );
  });
  return (
    <Box>
      <Box sx={{ display: "flex" }}>
        <Typography
          sx={(theme) => ({
            borderRadius: "99px",
            background: overlay75,
            padding: theme.spacing(1),
          })}
        >
          {props.morph}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={(theme) => ({
            borderRadius: "99px",
            background: overlay75,
            padding: theme.spacing(1),
          })}
          onClick={() => setMode(!mode)}
        >
          ({current})
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          gap: "8px",
          padding: "8px",
          height: props.mobile ? "48px" : undefined,
        }}
      >
        {mode ? (
          <Slider
            aria-label={`Slider ${props.morph}`}
            defaultValue={current}
            min={0}
            max={1}
            step={0.1}
            valueLabelDisplay="auto"
            onChange={(_event, newValue) => {
              const val = newValue;
              if (props.targetAll) {
                MMDLoadDetails.modelMorph.forEach((model, index) => {
                  model?.setMorphWeight(props.morph, val);
                  if (!MMDLoadDetails.actionMemory[index])
                    MMDLoadDetails.actionMemory[index] = {};
                  MMDLoadDetails.actionMemory[index][props.morph] = val;
                });
              } else {
                MMDLoadDetails.modelMorph[
                  MMDLoadDetails.focusedModel
                ]?.setMorphWeight(props.morph, val);
                if (!MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel])
                  MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel] = {};
                MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel]![
                  props.morph
                ] = val;
              }
              setCurrent(val);
            }}
          />
        ) : (
          <>
            <Button
              sx={(theme) => ({
                flex: 1,
                height: props.mobile ? "100%" : undefined,
                background:
                  theme.palette.mode === "light"
                    ? `rgba(255,255,255, ${(1 - current) * 0.5})`
                    : `rgba(0,0,0, ${(1 - current) * 0.5})`,
              })}
              onClick={() => {
                if (props.targetAll) {
                  MMDLoadDetails.modelMorph.forEach((model, index) => {
                    model?.setMorphWeight(props.morph, 0);
                    if (!MMDLoadDetails.actionMemory[index])
                      MMDLoadDetails.actionMemory[index] = {};
                    MMDLoadDetails.actionMemory[index][props.morph] = 0;
                  });
                } else {
                  MMDLoadDetails.modelMorph[
                    MMDLoadDetails.focusedModel
                  ]?.setMorphWeight(props.morph, 0);
                  if (!MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel])
                    MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel] =
                      {};
                  MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel]![
                    props.morph
                  ] = 0;
                }
                setCurrent(0);
              }}
            >
              0
            </Button>
            <Button
              sx={(theme) => ({
                flex: 1,
                height: props.mobile ? "100%" : undefined,
                background:
                  theme.palette.mode === "light"
                    ? `rgba(255,255,255, ${current * 0.5})`
                    : `rgba(0,0,0, ${current * 0.5})`,
              })}
              onClick={() => {
                if (props.targetAll) {
                  MMDLoadDetails.modelMorph.forEach((model, index) => {
                    model?.setMorphWeight(props.morph, 1);
                    if (!MMDLoadDetails.actionMemory[index])
                      MMDLoadDetails.actionMemory[index] = {};
                    MMDLoadDetails.actionMemory[index][props.morph] = 1;
                  });
                } else {
                  MMDLoadDetails.modelMorph[
                    MMDLoadDetails.focusedModel
                  ]?.setMorphWeight(props.morph, 1);
                  if (!MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel])
                    MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel] =
                      {};
                  MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel]![
                    props.morph
                  ] = 1;
                }
                setCurrent(1);
              }}
            >
              1
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
const causeAngle = (
  vector: SimpleVector,
  all: boolean,
  clear: boolean = false,
) => {
  if (clear) {
    if (all) {
      for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
        MMDLoadDetails.entitiesAngle[i] = vector;
        MMDLoadDetails.entitiesData[i]![1]?.rotation.set(
          vector.x,
          vector.y,
          vector.z,
        );
      }
    } else {
      MMDLoadDetails.entitiesAngle[MMDLoadDetails.focusedModel] = vector;
      MMDLoadDetails.entitiesData[
        MMDLoadDetails.focusedModel
      ]![1]?.rotation.set(vector.x, vector.y, vector.z);
    }
    return;
  }
  if (all) {
    for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
      let vectorRef = MMDLoadDetails.entitiesAngle[i];
      if (vectorRef) {
        vectorRef.x += vector.x;
        vectorRef.y += vector.y;
        vectorRef.z += vector.z;
      } else {
        MMDLoadDetails.entitiesAngle[i] = vector;
        vectorRef = vector;
      }
      MMDLoadDetails.entitiesData[i]![1]?.rotation.set(
        vectorRef.x,
        vectorRef.y,
        vectorRef.z,
      );
    }
  } else {
    let vectorRef = MMDLoadDetails.entitiesAngle[MMDLoadDetails.focusedModel];
    if (vectorRef) {
      vectorRef.x += vector.x;
      vectorRef.y += vector.y;
      vectorRef.z += vector.z;
    } else {
      MMDLoadDetails.entitiesAngle[MMDLoadDetails.focusedModel] = vector;
      vectorRef = vector;
    }
    MMDLoadDetails.entitiesData[MMDLoadDetails.focusedModel]![1]?.rotation.set(
      vectorRef.x,
      vectorRef.y,
      vectorRef.z,
    );
  }
};
const causeOffset = (
  vector: SimpleVector,
  all: boolean,
  clear: boolean = false,
) => {
  if (clear) {
    if (all) {
      for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
        MMDLoadDetails.entitiesOffset[i] = vector;
        MMDLoadDetails.entitiesData[i]![1]?.position.set(
          vector.x,
          vector.y,
          vector.z,
        );
      }
    } else {
      MMDLoadDetails.entitiesOffset[MMDLoadDetails.focusedModel] = vector;
      MMDLoadDetails.entitiesData[
        MMDLoadDetails.focusedModel
      ]![1]?.position.set(vector.x, vector.y, vector.z);
    }
    return;
  }
  if (all) {
    for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
      let vectorRef = MMDLoadDetails.entitiesOffset[i];
      if (vectorRef) {
        vectorRef.x += vector.x;
        vectorRef.y += vector.y;
        vectorRef.z += vector.z;
      } else {
        MMDLoadDetails.entitiesOffset[i] = vector;
        vectorRef = vector;
      }
      MMDLoadDetails.entitiesData[i]![1]?.position.set(
        vectorRef.x,
        vectorRef.y,
        vectorRef.z,
      );
    }
  } else {
    let vectorRef = MMDLoadDetails.entitiesOffset[MMDLoadDetails.focusedModel];
    if (vectorRef) {
      vectorRef.x += vector.x;
      vectorRef.y += vector.y;
      vectorRef.z += vector.z;
    } else {
      MMDLoadDetails.entitiesOffset[MMDLoadDetails.focusedModel] = vector;
      vectorRef = vector;
    }
    MMDLoadDetails.entitiesData[MMDLoadDetails.focusedModel]![1]?.position.set(
      vectorRef.x,
      vectorRef.y,
      vectorRef.z,
    );
  }
};

type modes = "morph" | "move";
const causeRateOffset = 0.25;
const causeRateAngle = 0.025;
function MorphDrawer(props: { ready: boolean; mobile: boolean }): JSX.Element {
  const [isHidden, setHidden] = useState(true);
  const [bgVisible, setBgVisible] = useState(true);
  const [all, setAll] = useState(false);
  const [morphs, setMorphs] = useState<string[]>([]);
  const theme = useTheme();
  const [mode, setMode] = useState<modes>("morph");
  const [causeType, setCauseType] = useState<"offset" | "angle">("offset");
  const cause = causeType === "offset" ? causeOffset : causeAngle;
  const [causeMultiplier, setCauseMultiplier] = useState(1);
  const causeRate = causeType === "offset" ? causeRateOffset : causeRateAngle;
  return (
    <Box
      sx={{
        display: props.ready ? "flex" : "none",
        position: "absolute",
        right: isHidden ? "-600px" : 0,
        transition: theme.transitions.create(["right"]),
        top: 0,
        bottom: 0,
        margin: "auto",
        height: "100%",
        zIndex: 100,
        width: "100%",
        maxWidth: "600px",
        flexDirection: "column",
        background: bgVisible ? overlay90 : `#00000000`,
        [theme.breakpoints.down(600)]: {
          maxWidth: "100%",
          right: isHidden ? "-100%" : 0,
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          left: isHidden ? "-60px" : 0,
          width: "100%",
          transition: theme.transitions.create(["left"]),
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Button
          sx={{
            height: "100%",
            flex: 2,
            justifyContent: isHidden ? "left" : undefined,
          }}
          variant="contained"
          color="info"
          onClick={() => {
            setHidden(!isHidden);
          }}
        >
          {isHidden ? `<` : "X"}
        </Button>
        <Button
          sx={{ height: "100%", flex: 1 }}
          variant="contained"
          color="info"
          onClick={() => {
            MMDLoadDetails.controller.musicRuntime?.seekAnimation(
              Math.max(
                0,
                (MMDLoadDetails.controller.musicRuntime?.currentFrameTime ??
                  0) -
                  30 * 5,
              ),
            );
          }}
        >
          -5
        </Button>
        <Button
          sx={{ height: "100%", flex: 1 }}
          variant="contained"
          color="info"
          onClick={() => {
            MMDLoadDetails.controller.musicRuntime?.seekAnimation(
              Math.min(
                MMDLoadDetails.controller.musicRuntime
                  ?.animationFrameTimeDuration,
                (MMDLoadDetails.controller.musicRuntime?.currentFrameTime ??
                  0) - 30,
              ),
            );
          }}
        >
          -1
        </Button>
        <Button
          sx={{ height: "100%", flex: 2 }}
          variant="contained"
          color="info"
          onClick={() => {
            if (MMDLoadDetails.controller.musicRuntime?.isAnimationPlaying) {
              MMDLoadDetails.controller.musicRuntime?.pauseAnimation();
            } else {
              MMDLoadDetails.controller.musicRuntime?.playAnimation();
            }
          }}
        >
          Play
        </Button>
      </Box>
      <Box display={"flex"}>
        <Button
          sx={{
            flex: 2,
            height: props.mobile ? "48px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            if (all) {
              for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
                for (const key in MMDLoadDetails.actionMemory[i]) {
                  if (MMDLoadDetails.actionMemory[i])
                    MMDLoadDetails.modelMorph[i]?.setMorphWeight(
                      key,
                      MMDLoadDetails.actionMemory[i]![key]!,
                    );
                }
              }
            } else {
              for (const key in MMDLoadDetails.actionMemory[
                MMDLoadDetails.focusedModel
              ]) {
                if (MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel])
                  MMDLoadDetails.modelMorph[
                    MMDLoadDetails.focusedModel
                  ]?.setMorphWeight(
                    key,
                    MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel]![
                      key
                    ]!,
                  );
              }
            }
          }}
        >
          {all ? "Sync All" : `Sync ${MMDLoadDetails.focusedModel}`}
        </Button>
        <Button
          sx={{
            flex: 2,
            height: props.mobile ? "48px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            setMorphs(
              (
                MMDLoadDetails.modelMorph[MMDLoadDetails.focusedModel]
                  ?.morphs ?? []
              ).map((morph) => morph.name),
            );
          }}
        >
          {morphs.length}/
          {
            MMDLoadDetails.modelMorph[MMDLoadDetails.focusedModel]?.morphs
              .length
          }
        </Button>
        <Button
          sx={{
            flex: 1,
            height: props.mobile ? "48px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            if (!all) {
              MMDLoadDetails.focusedModel = 0;
            }
            setAll(!all);
          }}
        >
          {all ? "All" : "Solo"}
        </Button>
        <Button
          sx={{
            flex: 3,
            height: props.mobile ? "48px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            setBgVisible(!bgVisible);
          }}
        >
          BG toggle
        </Button>
      </Box>
      <Box display={"flex"}>
        {all
          ? undefined
          : new Array(MMDLoadDetails.maxModelFocus).fill(0).map((_, i) => (
              <Button
                key={i}
                sx={{
                  flex: 1,
                  height: props.mobile ? "48px" : undefined,
                  background:
                    MMDLoadDetails.focusedModel === i
                      ? undefined
                      : theme.palette.mode === "light"
                        ? `rgba(255,255,255, 0.5)`
                        : `rgba(0,0,0, 0.5)`,
                }}
                fullWidth
                variant={
                  MMDLoadDetails.focusedModel === i ? "contained" : "text"
                }
                onClick={() => {
                  MMDLoadDetails.focusedModel = i;
                  MMDLoadDetails.refocusModel();
                  setMorphs(
                    (
                      MMDLoadDetails.modelMorph[MMDLoadDetails.focusedModel]
                        ?.morphs ?? []
                    )
                      .map((morph) => morph.name)
                      .filter((e) => !defaultBodyNames.includes(e)),
                  );
                }}
              >
                {i}
              </Button>
            ))}
        <Button
          sx={{
            flex: 1,
            height: props.mobile ? "48px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          variant="outlined"
          onClick={() => {
            switch (mode) {
              case "morph":
                setMode("move");
                break;
              case "move":
                setMode("morph");
                break;
            }
          }}
        >
          {mode}
        </Button>
      </Box>
      <Box
        sx={{
          flex: 1,
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          padding: theme.spacing(2),
        }}
      >
        {mode === "morph" &&
          morphs.map((morph) => (
            <MorphEntry
              key={morph}
              morph={morph}
              mobile={props.mobile}
              targetAll={all}
            />
          ))}
        {mode === "move" && (
          <>
            <Box
              sx={{
                height: props.mobile ? "40px" : undefined,
                display: "flex",
              }}
            >
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                fullWidth
                onClick={() => {
                  setCauseType(causeType === "angle" ? "offset" : "angle");
                }}
              >
                {causeType === "offset" ? "Moving Mode" : "Rotate Mode"}
              </Button>
            </Box>
            <Box
              sx={{
                height: props.mobile ? "40px" : undefined,
                display: "flex",
              }}
            >
              <Slider
                value={causeMultiplier}
                onChange={(_, val) =>
                  setCauseMultiplier(val as typeof causeMultiplier)
                }
                min={0.5}
                step={0.1}
                max={20}
                valueLabelDisplay="on"
              ></Slider>
            </Box>
            <Box
              sx={{
                height: props.mobile ? "40px" : undefined,
                display: "flex",
              }}
            >
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() =>
                  cause({ x: 0, y: -causeRate * causeMultiplier, z: 0 }, all)
                }
                fullWidth
              >
                Down
              </Button>
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() =>
                  cause({ x: 0, y: causeRate * causeMultiplier, z: 0 }, all)
                }
                fullWidth
              >
                Up
              </Button>
            </Box>
            <Box
              sx={{
                height: props.mobile ? "40px" : undefined,
                display: "flex",
              }}
            >
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() =>
                  cause({ x: -causeRate * causeMultiplier, y: 0, z: 0 }, all)
                }
                fullWidth
              >
                Left
              </Button>
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() =>
                  cause({ x: causeRate * causeMultiplier, y: 0, z: 0 }, all)
                }
                fullWidth
              >
                Right
              </Button>
            </Box>
            <Box
              sx={{
                height: props.mobile ? "40px" : undefined,
                display: "flex",
              }}
            >
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() =>
                  cause({ x: 0, y: 0, z: causeRate * causeMultiplier }, all)
                }
                fullWidth
              >
                Back
              </Button>
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() =>
                  cause({ x: 0, y: 0, z: -causeRate * causeMultiplier }, all)
                }
                fullWidth
              >
                Forward
              </Button>
            </Box>
            <Box sx={{ height: props.mobile ? "40px" : undefined }}> </Box>
            <Box
              sx={{
                height: props.mobile ? "40px" : undefined,
                display: "flex",
              }}
            >
              <Button
                sx={{
                  background:
                    theme.palette.mode === "light"
                      ? `rgba(255,255,255, 0.5)`
                      : `rgba(0,0,0, 0.5)`,
                }}
                onClick={() => cause({ x: 0, y: 0, z: 0 }, all, true)}
                fullWidth
              >
                CLEAR VECTORS
              </Button>
            </Box>
          </>
        )}

        <Button
          sx={{
            height: props.mobile ? "40px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            //@ts-expect-error
            if (window?.toggler === undefined) return;
            MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel] =
              //@ts-expect-error
              window.toggler;
          }}
        >
          {
            //@ts-expect-error
            window?.toggler !== undefined ? "Load ???" : `NO DATA`
          }
        </Button>
        <Button
          sx={{
            height: props.mobile ? "40px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            if (all) {
              //@ts-expect-error
              window.toggler = MMDLoadDetails.actionMemory.map((e) => {
                const copy: typeof e = JSON.parse(JSON.stringify(e));
                for (const key in e) {
                  if (copy[key] === 0) {
                    delete copy[key];
                  }
                }
                return copy;
              });
            } else {
              const copy = JSON.parse(
                JSON.stringify(
                  MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel],
                ),
              );
              for (const key in MMDLoadDetails.actionMemory[
                MMDLoadDetails.focusedModel
              ]) {
                if (copy[key] === 0) {
                  delete copy[key];
                }
              }
              //@ts-expect-error
              window.toggler = copy;
            }
          }}
        >
          {all ? "Save All" : `Save Index ${MMDLoadDetails.focusedModel}`}
        </Button>
        <Button
          sx={{
            height: props.mobile ? "40px" : undefined,
            background:
              theme.palette.mode === "light"
                ? `rgba(255,255,255, 0.5)`
                : `rgba(0,0,0, 0.5)`,
          }}
          fullWidth
          onClick={() => {
            if (all) {
              MMDLoadDetails.actionMemory = [];
              for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
                MMDLoadDetails.actionMemory.push({});
              }
            } else {
              MMDLoadDetails.actionMemory[MMDLoadDetails.focusedModel] = {};
            }
          }}
        >
          {all ? "Clear All SyncData" : `Clear Selected SyncData`}
        </Button>
      </Box>
    </Box>
  );
}

//#endregion

export { MorphDrawer };
