//#region Imports
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import type { JSX } from "react/jsx-runtime";
import { MMDUpdatePreview } from "./Mmd";

// import { number } from "zod";
// import { PointLight } from "@babylonjs/core/Lights/pointLight";
// import { Inspector } from "@babylonjs/inspector";
//#endregion

//#region MMDLoadDetailsPreviewDialog.tsx
interface SimpleDialogProps {
  open: boolean;
  onClose: () => void;
}

function MMDLoadDetailsPreviewDialog(props: SimpleDialogProps): JSX.Element {
  return (
    <Dialog
      onClose={props.onClose}
      open={props.open}
      maxWidth={"lg"}
      keepMounted
      disablePortal
    >
      <DialogTitle>MMDLoadDetailsPreview</DialogTitle>
      <DialogContent sx={{ minWidth: "400px" }}>
        <code
          id="MMDLoadDetailsPreview"
          style={{
            display: "flex",
            fontSize: "1rem",
            whiteSpace: "break-spaces",
          }}
        />
        <div style={{ display: "flex" }}>
          <Button fullWidth onClick={() => MMDUpdatePreview()}>
            Reload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

//#endregion

export { MMDLoadDetailsPreviewDialog };
