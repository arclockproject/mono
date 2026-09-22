//#region Imports

import { Box, Button, TextField } from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import {
  MMDLoadDetails,
  type mmdDetailsProcessed,
  type processedDivision,
} from "./config";

//#endregion

//#region SimpleTreeViewSearchable.tsx
const RecursiveList = (props: {
  processedDivision: processedDivision[];
  info: {
    name: string;
    onClick: (path: string, button: number) => void;
  };
  buttons: number;
}) => {
  const first = props.processedDivision[0];
  return props.processedDivision.length > 1 || !first ? (
    props.processedDivision.map((division) => (
      <TreeItem
        key={`${division.folder}:${division.endName}`}
        itemId={`${division.folder}:${division.endName}`}
        label={division.folder}
      >
        {division.children.length === 0 ? (
          new Array(props.buttons).fill(0).map((_, i) => (
            <Button
              key={i}
              variant="contained"
              fullWidth
              onClick={() => props.info.onClick(division.endName, i)}
            >
              {`Select ${i}`}
            </Button>
          ))
        ) : (
          <RecursiveList
            processedDivision={division.children}
            info={props.info}
            buttons={props.buttons}
          />
        )}
      </TreeItem>
    ))
  ) : first.children.length === 0 ? (
    <TreeItem itemId={`${first.folder}:${first.endName}`} label={first.folder}>
      {new Array(props.buttons).fill(0).map((_, i) => (
        <Button
          key={i}
          variant="contained"
          fullWidth
          onClick={() => props.info.onClick(first.endName, i)}
        >
          {`Select ${i}`}
        </Button>
      ))}
    </TreeItem>
  ) : (
    <RecursiveList
      processedDivision={first.children.map((e) => ({
        folder: `${first.folder}/${e.folder}`,
        endName: e.endName,
        children: e.children,
        endNameRomaji: e.endNameRomaji,
      }))}
      info={props.info}
      buttons={props.buttons}
    />
  );
};
function processedDivisionFilter(
  processedDivision: processedDivision[],
  search: string[],
): processedDivision[] {
  const valid: processedDivision[] = [];
  processedDivision.forEach((division) => {
    if (division.children.length === 0) {
      // IS FILE
      const nameLower = division.endName.toLowerCase();
      const nameLowerRomaji = division.endNameRomaji.toLowerCase();
      if (
        search.filter((item) => {
          return nameLower.includes(item) || nameLowerRomaji.includes(item);
        }).length === search.length
      )
        valid.push(division);
    } else {
      // IS FOLDER
      const innerValid = processedDivisionFilter(division.children, search);
      // CHILDREN WITH FAILED CONTENT
      if (innerValid.length > 0)
        valid.push({
          children: innerValid,
          endName: division.endName,
          folder: division.folder,
          endNameRomaji: division.endNameRomaji,
        });
    }
  });
  return valid;
}
function SimpleTreeViewSearchable({
  selectedTab,
  mmdDetails,
  basePath,
  updatePreview,
}: {
  selectedTab: number;
  mmdDetails: mmdDetailsProcessed | null;
  basePath: string;
  updatePreview: () => void;
}): JSX.Element {
  const [search, setSearch] = useState<{ [key: number]: string }>({});
  const searchString = search[selectedTab] ?? "";
  const searchItems = searchString.split(" ");
  return (
    <Box>
      <TextField
        placeholder="Search..."
        value={searchString}
        onChange={(event) => {
          search[selectedTab] = event.currentTarget.value;
          setSearch({ ...search });
        }}
        sx={{
          paddingLeft: 1,
        }}
      />
      <SimpleTreeView>
        {(() => {
          switch (selectedTab) {
            case 0:
              return (
                <RecursiveList
                  processedDivision={processedDivisionFilter(
                    mmdDetails?.charaPmx ?? [],
                    searchItems,
                  )}
                  info={{
                    name: "Toggle Model",
                    onClick: (row, button) => {
                      const path = row.split("/");
                      const model = {
                        file: path.pop() ?? "",
                        folder: `${basePath}${path.join("/")}/`,
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
                      updatePreview();
                    },
                  }}
                  buttons={MMDLoadDetails.maxModelFocus}
                />
              );
            case 1:
              return (
                <RecursiveList
                  processedDivision={processedDivisionFilter(
                    mmdDetails?.stagePmx ?? [],
                    searchItems,
                  )}
                  info={{
                    name: "Load Stage",
                    onClick: (row) => {
                      const path = row.split("/");
                      MMDLoadDetails.stagePMX = path.pop() ?? "";
                      MMDLoadDetails.stageFolder = `${basePath}${path.join("/")}/`;
                      updatePreview();
                    },
                  }}
                  buttons={1}
                />
              );
            case 2:
              return (
                <RecursiveList
                  processedDivision={processedDivisionFilter(
                    mmdDetails?.charaVmd ?? [],
                    searchItems,
                  )}
                  info={{
                    name: "Load Dance",
                    onClick: (row, button) => {
                      const path = `${basePath}${row}`;
                      const entity = MMDLoadDetails.entities[button];
                      if (entity) {
                        if (entity.movement) {
                          entity.movement = entity.movement.filter((vmd) =>
                            vmd.startsWith("chara.part.vmd"),
                          );
                          entity.movement.push(path);
                        } else {
                          entity.movement = [path];
                        }
                      }

                      updatePreview();
                    },
                  }}
                  buttons={MMDLoadDetails.maxModelFocus}
                />
              );
            case 3:
              return (
                <RecursiveList
                  processedDivision={processedDivisionFilter(
                    mmdDetails?.charaCam ?? [],
                    searchItems,
                  )}
                  info={{
                    name: "Load Camera",
                    onClick: (row) => {
                      MMDLoadDetails.vmdCamera = `${basePath}${row}`;
                      updatePreview();
                    },
                  }}
                  buttons={1}
                />
              );
            case 4:
              return (
                <RecursiveList
                  processedDivision={processedDivisionFilter(
                    mmdDetails?.charaPartVmd ?? [],
                    searchItems,
                  )}
                  info={{
                    name: "Toggle Model Movement",
                    onClick: (row, button) => {
                      const path = `${basePath}${row}`;
                      const entity = MMDLoadDetails.entities[button];
                      if (entity) {
                        if (entity.movement) {
                          if (entity.movement.includes(path)) {
                            entity.movement = entity.movement.filter(
                              (vmd) => vmd !== path,
                            );
                          } else {
                            entity.movement.push(path);
                          }
                        } else {
                          entity.movement = [path];
                        }
                      }
                      updatePreview();
                    },
                  }}
                  buttons={MMDLoadDetails.maxModelFocus}
                />
              );
          }
          return undefined;
        })()}
      </SimpleTreeView>
    </Box>
  );
}
//#endregion

export { SimpleTreeViewSearchable };
