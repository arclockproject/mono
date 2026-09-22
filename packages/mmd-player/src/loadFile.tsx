import { MMDLoadDetails } from "./config";
import { MMDUpdatePreview } from "./Mmd";
type fileType =
  | "Character"
  | "Camera Movement"
  | "Stage"
  | "Character Movement"
  | "Character Part Movement"
  | "Audio"
  | "File";
const getFileType = (file: string): fileType => {
  if (file.endsWith(".chara.pmx")) return "Character";
  if (file.endsWith(".chara.pmd")) return "Character";
  if (file.endsWith(".cam.vmd")) return "Camera Movement";
  if (file.endsWith(".stage.pmx")) return "Stage";
  if (file.endsWith(".stage.pmd")) return "Stage";
  if (file.endsWith(".chara.vmd")) return "Character Movement";
  if (file.endsWith(".chara.part.vmd")) return "Character Part Movement";
  if (file.endsWith(".wav") || file.endsWith(".mp3") || file.endsWith(".m4a"))
    return "Audio";
  return "File";
};

/**
 * @param file Location either as URL or relative path.
 * @example
 * loadMMDFileByURL("https://example.com/folder/file.mp3")
 * loadMMDFileByURL("/folder/file.mp3") // Will use current domain
 */
export function loadMMDFileByURL(file: string): void {
  const fileType = getFileType(file);
  const path = file.split("/");
  const fullPath = `${file}`;
  const button = 0; //Temporary
  switch (fileType) {
    case "Character":
      {
        const model = {
          file: path.pop() ?? "",
          folder: `${path.join("/")}/`,
        };
        let entity = MMDLoadDetails.entities[button];
        if (!entity) {
          entity = MMDLoadDetails.entities[button] = {
            model: model,
            movement: undefined,
          };
        } else {
          entity.model = model;
        }
      }
      break;
    case "Camera Movement":
      MMDLoadDetails.vmdCamera = fullPath;
      break;
    case "Stage":
      MMDLoadDetails.stagePMX = path.pop() ?? "";
      MMDLoadDetails.stageFolder = `${path.join("/")}/`;
      break;
    case "Character Movement":
      {
        const entity = MMDLoadDetails.entities[button];
        if (entity) {
          if (entity.movement) {
            entity.movement = entity.movement.filter((vmd) =>
              vmd.startsWith("chara.part.vmd"),
            );
            entity.movement.push(fullPath);
          } else {
            entity.movement = [fullPath];
          }
        }
      }
      break;
    case "Character Part Movement":
      {
        const entity = MMDLoadDetails.entities[button];
        if (entity) {
          if (entity.movement) {
            if (entity.movement.includes(fullPath)) {
              entity.movement = entity.movement.filter(
                (vmd) => vmd !== fullPath,
              );
            } else {
              entity.movement.push(fullPath);
            }
          } else {
            entity.movement = [fullPath];
          }
        }
      }
      break;
    case "Audio":
      MMDLoadDetails.musicRaw = fullPath;
      break;
    case "File":
      return;
  }
  MMDUpdatePreview();
}
