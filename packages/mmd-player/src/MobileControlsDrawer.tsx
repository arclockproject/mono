//#region MobileControlsDrawer.tsx

// function MobileControlsDrawer(props: { render: boolean }) {
//   const [isHidden, setHidden] = useState(true);
//   const theme = useTheme();
//   return (
//     <Box
//       sx={{
//         display: props.render ? "flex" : "none",
//         position: "absolute",
//         inset: 0,
//         padding: 0,
//         margin: 0,
//         height: "auto",
//         width: "auto",
//         zIndex: 100,
//         gap: "8px",
//         flexDirection: "column",
//         pointerEvents: "none",
//       }}
//     >
//       <Button
//         variant="contained"
//         color="info"
//         sx={{
//           right: 0,
//           left: 0,
//           top: 0,

//           transition: theme.transitions.create(["right"]),
//         }}
//         onClick={() => {
//           setHidden(!isHidden);
//         }}
//       >
//         {isHidden ? `Menu` : "Hide panel"}
//       </Button>
//       {/* <Button
//         onClick={() => {
//           const scene = MMDLoadDetails.controller.scene;
//           if (scene) scene.gravity.y = scene.gravity.y === 0 ? -98 : 0;
//         }}
//       >
//         Toggle Gravity
//       </Button> */}
//       <Button id="toggle-cameras" style={{ padding: "16px" }}>
//         Toggle Cameras
//       </Button>
//       <Button
//         onClick={() => {
//           const canvasRoot = document.querySelector<HTMLCanvasElement>(
//             "div#mmd-render-root"
//           )!;
//           const canvas =
//             document.querySelector<HTMLCanvasElement>("canvas#mmd-render")!;
//           const widthOffset = window.screen.orientation.type.startsWith(
//             "landscape"
//           )
//             ? -50
//             : 0;
//           const heightOffset = window.screen.orientation.type.startsWith(
//             "landscape"
//           )
//             ? 0
//             : -50;
//           if (document.fullscreenElement) {
//             canvasRoot.style.width =
//               window.screen.availWidth + widthOffset + "px";
//             canvasRoot.style.height =
//               window.screen.availHeight + heightOffset + "px";
//             canvas.width = window.screen.availWidth + widthOffset;
//             canvas.height = window.screen.availHeight + heightOffset;
//           } else {
//             canvasRoot.style.width = window.screen.availWidth / 1.5 + "px";
//             canvasRoot.style.height = window.screen.availHeight / 1.5 + "px";
//             canvas.width = window.screen.availWidth / 1.5;
//             canvas.height = window.screen.availHeight / 1.5;
//           }
//         }}
//         style={{ padding: "8px", margin: "8px" }}
//       >
//         Force Mobile
//       </Button>
//       <Button
//         onClick={() => {
//           const canvasRoot = document.querySelector<HTMLCanvasElement>(
//             "div#mmd-render-root"
//           )!;
//           const canvas =
//             document.querySelector<HTMLCanvasElement>("canvas#mmd-render")!;
//           const widthOffset = window.screen.orientation.type.startsWith(
//             "landscape"
//           )
//             ? -400
//             : 0;
//           const heightOffset = window.screen.orientation.type.startsWith(
//             "landscape"
//           )
//             ? 0
//             : -400;
//           if (document.fullscreenElement) {
//             canvasRoot.style.width =
//               window.screen.availWidth * 4 + widthOffset + "px";
//             canvasRoot.style.height =
//               window.screen.availHeight * 4 + heightOffset + "px";
//             canvas.width = window.screen.availWidth * 4 + widthOffset;
//             canvas.height = window.screen.availHeight * 4 + heightOffset;
//           } else {
//             canvasRoot.style.width =
//               (window.screen.availWidth * 4) / 1.5 + widthOffset + "px";
//             canvasRoot.style.height =
//               (window.screen.availHeight * 4) / 1.5 + heightOffset + "px";
//             canvas.width = (window.screen.availWidth * 4) / 1.5 + widthOffset;
//             canvas.height =
//               (window.screen.availHeight * 4) / 1.5 + heightOffset;
//           }
//         }}
//         style={{ padding: "16px" }}
//       >
//         Force Mobile x2
//       </Button>
//       <div style={{ display: "flex" }}>
//         <Button
//           sx={{ flex: 1, padding: "16px" }}
//           fullWidth
//           onClick={() => {
//             MMDLoadDetails.zCamOffset.y -= 2;
//           }}
//         >
//           Lower
//         </Button>
//         <Button
//           sx={{ flex: 1, padding: "16px" }}
//           fullWidth
//           onClick={() => {
//             MMDLoadDetails.zCamOffset.y += 2;
//           }}
//         >
//           Higher
//         </Button>
//       </div>
//       <div style={{ display: "flex" }}>
//         <Button
//           sx={{ flex: 1, padding: "16px" }}
//           fullWidth
//           onClick={() => {
//             MMDLoadDetails.zCamOffset.x -= 2;
//           }}
//         >
//           Left
//         </Button>
//         <Button
//           sx={{ flex: 1, padding: "16px" }}
//           fullWidth
//           onClick={() => {
//             MMDLoadDetails.zCamOffset.x += 2;
//           }}
//         >
//           right
//         </Button>
//       </div>
//       <div style={{ display: "flex" }}>
//         <Button
//           sx={{ flex: 1, padding: "16px" }}
//           fullWidth
//           onClick={() => {
//             MMDLoadDetails.zCamOffset.z -= 2;
//           }}
//         >
//           Back
//         </Button>
//         <Button
//           sx={{ flex: 1, padding: "16px" }}
//           fullWidth
//           onClick={() => {
//             MMDLoadDetails.zCamOffset.z += 2;
//           }}
//         >
//           Forward
//         </Button>
//       </div>
//       <Button
//         sx={{ padding: "16px" }}
//         onClick={async () => {
//           let wakeLock = null;

//           try {
//             wakeLock = await navigator.wakeLock.request("screen");
//           } catch (err) {}
//         }}
//         style={{ padding: "8px", margin: "8px" }}
//       >
//         Wake Lock
//       </Button>
//     </Box>
//   );
// }

//#endregion
