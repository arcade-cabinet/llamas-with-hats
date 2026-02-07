# Controls & VR Support

## Overview

The game provides intuitive camera controls for desktop and mobile, with optional WebXR VR support for immersive headsets.

## Desktop Controls

### Mouse Controls

| Action | Input | Description |
|--------|-------|-------------|
| Rotate Camera | Left-click + Drag | Orbit around the scene center |
| Zoom | Scroll Wheel | Move camera closer/farther |
| Pan | Right-click + Drag | Shift the camera target point |
| Interact | Left-click on Carl | Trigger next dialogue event |

### Camera Constraints

```typescript
const camera = new ArcRotateCamera(
  'mainCamera',
  Math.PI / 4,        // alpha: horizontal angle (45°)
  Math.PI / 3,        // beta: vertical angle (60°)
  8,                  // radius: distance from target
  new Vector3(0, 1, -1), // target: slightly above floor center
  scene
);

// Movement limits
camera.lowerRadiusLimit = 4;      // Minimum zoom (closest)
camera.upperRadiusLimit = 15;     // Maximum zoom (farthest)
camera.lowerBetaLimit = 0.3;      // Minimum vertical (~17°, near horizontal)
camera.upperBetaLimit = Math.PI / 2 - 0.1; // Maximum vertical (~85°, near top-down)

// Sensitivity
camera.wheelPrecision = 20;       // Scroll sensitivity (higher = slower)
camera.panningSensibility = 500;  // Pan sensitivity (higher = slower)
```

### Camera Target

The camera orbits around `Vector3(0, 1, -1)`:
- X: 0 (centered)
- Y: 1 (about waist height for llamas)
- Z: -1 (slightly toward the couch/back wall)

This keeps both llamas and the main furniture in view.

## Mobile/Touch Controls

Babylon.js automatically maps touch inputs:

| Action | Input | Description |
|--------|-------|-------------|
| Rotate Camera | Single finger drag | Orbit around scene |
| Zoom | Pinch gesture | Two-finger zoom in/out |
| Pan | Two-finger drag | Shift camera target |
| Interact | Tap on Carl | Trigger next dialogue |

## Click Detection

### Pointer Event Handling

```typescript
scene.onPointerDown = (_evt, pickResult) => {
  if (pickResult.hit && pickResult.pickedMesh) {
    const meshName = pickResult.pickedMesh.name;
    // Check if clicked on Carl or his invisible click target
    if (meshName.includes('carl') || meshName === 'carl-clickTarget') {
      onCarlClick();
    }
  }
};
```

### Carl's Click Target

An invisible bounding box ensures reliable click detection:

```typescript
const clickTarget = MeshBuilder.CreateBox('carl-clickTarget', {
  width: 1.2,
  height: 2.2,
  depth: 0.8,
}, scene);
clickTarget.position = new Vector3(0.1, 1, 0);
clickTarget.visibility = 0;      // Invisible
clickTarget.isPickable = true;   // But clickable
clickTarget.parent = llamaRoot;
```

## UI Controls

### HUD Elements

Located in top header bar:

```
┌────────────────────────────────────────────────────────┐
│ Disturbing Level [████░░░░░░] 4/10    [VR] [🔊]  Incidents │
│                                                      4  │
└────────────────────────────────────────────────────────┘
```

| Control | Function |
|---------|----------|
| Horror Meter | Visual indicator of progress (read-only) |
| VR Button | Enter immersive VR mode (if supported) |
| Mute Button | Toggle audio on/off |
| Incident Counter | Number of dialogues triggered |

### Dialogue Dismissal

Click anywhere on the dialogue overlay to dismiss:

```typescript
<div style={styles.container} onClick={onDismiss}>
  {/* Dialogue content */}
</div>
```

## WebXR VR Support

### Initialization

VR is set up automatically if the browser supports WebXR:

```typescript
const setupXR = async () => {
  try {
    const floorMesh = scene.getMeshByName('floor');
    const xr = await scene.createDefaultXRExperienceAsync({
      floorMeshes: floorMesh ? [floorMesh] : [],
      uiOptions: {
        sessionMode: 'immersive-vr',
      },
    });
    
    if (xr.baseExperience) {
      xrRef.current = xr;
      vrSupportedRef.current = true;
      
      // Provide enter function to parent
      const enterVR = async () => {
        await xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
      };
      
      if (onVRStatusChange) {
        onVRStatusChange(true, enterVR);
      }
    }
  } catch {
    // WebXR not supported on this device/browser
    vrSupportedRef.current = false;
  }
};
```

### Supported Devices

- Meta Quest 2/3/Pro (via Quest Browser)
- Pico headsets
- Windows Mixed Reality
- HTC Vive (via SteamVR + browser)
- Any WebXR-compatible headset

### VR Session Modes

| Mode | Description |
|------|-------------|
| `immersive-vr` | Full VR with headset tracking |
| `local-floor` | Reference space anchored to floor |

### VR Controls (In Headset)

- **Look Around**: Head tracking
- **Move**: Teleportation (Babylon.js default XR locomotion)
- **Interact**: Controller pointer + trigger

### Entering VR

1. Click "VR" button in HUD
2. Put on headset when prompted
3. Accept browser permission for immersive session
4. Scene renders in stereoscopic 3D

### Exiting VR

- Press headset menu button
- Use browser's exit VR function
- Remove headset (some browsers auto-exit)

## Accessibility Considerations

### Current Support
- High contrast text on overlays
- Large click targets
- Keyboard not required (mouse/touch only)

### Future Improvements
- Keyboard navigation (Tab through UI)
- Screen reader announcements for dialogue
- Colorblind-friendly horror indicators
- Reduced motion option (disable shake effects)

## Troubleshooting

### Camera Stuck
If camera becomes unresponsive:
- Refresh the page
- Check for browser zoom level (reset to 100%)

### Click Not Registering
- Ensure clicking on Carl's body area
- Wait for current dialogue to dismiss
- Check that game has started (past start menu)

### VR Button Missing
- WebXR not supported in current browser
- Try Chrome, Edge, or Firefox on desktop
- Use Quest Browser for standalone VR

### VR Session Fails
- Ensure headset is connected and tracking
- Grant browser permission for VR access
- Check headset battery level
- Restart browser if session crashes
