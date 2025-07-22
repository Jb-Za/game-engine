# Game Engine

A WebGPU-based renderer (and hopefully one day, game engine) built with TypeScript, React, and Vite.
Interactive Link here: game-engine-two.vercel.app
## Features

- **WebGPU Rendering**: GPU-accelerated rendering pipeline
- **GLTF Model Support**: Load and display 3D models with Skeletal animations (Still a WIP)
- **Shadow Mapping**: Real-time dynamic shadows

## Prerequisites

### Browser Requirements

This application requires a WebGPU-compatible browser:

- **Chrome**: Version 113 or higher
- **Edge**: Version 113 or higher
- **Firefox**: WebGPU support is experimental (enable `dom.webgpu.enabled` in about:config)
- **Safari**: WebGPU support is in development

### System Requirements

- **GPU**: DirectX 12, Vulkan, or Metal compatible graphics card
- **OS**: Windows 10/11, macOS, or Linux with modern GPU drivers
- **Node.js**: Version 18.17.0 or higher (required for React 19)
- **npm**: Version 9.0.0 or higher

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd game-engine
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

Start the development server with hot reloading:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is busy).

### Production Build

Build the application for production:

```bash
npm run build
```

### Enabling WebGPU in Firefox

1. Open `about:config`
2. Set `dom.webgpu.enabled` to `true`
3. Restart Firefox

## Development

### Adding New Scenes

1. Create a new scene file in `src/scenes/`
2. Add scene information to `sceneList.ts`
3. Implement the scene's render loop and initialization

### Asset Management

3D models and textures are stored in `public/assets/`. Supported formats:
- **Models**: GLB files
- **Textures**: PNG, JPG formats

## Troubleshooting

### Common Issues

**"WebGPU is not supported"**
- Update your browser to Chrome 113+ or Edge 113+
- Ensure your GPU drivers are current
- Check if hardware acceleration is enabled

## Contributing

You're welcome to contribute

## License

This project is open source. Feel free to do as you wish.

---

**Note**: This is an experimental project. Browser support and performance may vary.

## Sources And Credits: 
The basis for this project structure is continued from this awesome tutorial series:
https://www.youtube.com/watch?v=dXPHLNovCjE
https://github.com/luka712/youtube_webgpu_pong/tree/main

The GLTF animation basis is expanded upon from this source:
https://webgpu.github.io/webgpu-samples/?sample=skinnedMesh
https://github.com/webgpu/webgpu-samples/tree/main/sample/skinnedMesh

with a lot of reading through this awesome guide:
https://webgl2fundamentals.org/webgl/lessons/webgl-skinning.html

