import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Mountain, RotateCcw, Waves } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { repoFile } from "../lib/data-client";
import { cn } from "../lib/utils";

type TextureOption = {
  id: string;
  label: string;
  path: string;
};

type GroundTextureOption = {
  id: string;
  label: string;
  tilePaths: string[];
};

const heightLayers: TextureOption[] = [
  {
    id: "control-b00",
    label: "K3ST height b00",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_control_b00_map.png"
  }
];

const diagnosticLayers: TextureOption[] = [
  {
    id: "none",
    label: "无",
    path: ""
  },
  {
    id: "control-b01",
    label: "K3ST diffuse red b01",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_control_b01_map.png"
  },
  {
    id: "control-b02",
    label: "K3ST diffuse green b02",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_control_b02_map.png"
  },
  {
    id: "control-b03",
    label: "K3ST diffuse blue b03",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_control_b03_map.png"
  },
  {
    id: "aux-b00",
    label: "K3ST aux qword b00",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_qword_b00_map.png"
  },
  {
    id: "aux-b05",
    label: "K3ST aux raw byte b05",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_qword_b05_map.png"
  },
  {
    id: "aux-water-height",
    label: "K3ST aux bits44-51 water height",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_bits44_51_water_height_map.png"
  },
  {
    id: "aux-has-water",
    label: "K3ST aux bits44-51 water mask",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_bits44_51_has_water_map.png"
  },
  {
    id: "aux-water-flags",
    label: "K3ST aux bits52-53 water flags",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_bits52_53_water_flags_map.png"
  },
  {
    id: "derived-b07",
    label: "K3ST derived water height",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_derived_b07_map.png"
  },
  {
    id: "derived-b08",
    label: "K3ST derived corner mask",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_derived_b08_map.png"
  }
];

const colorLayers: TextureOption[] = [
  {
    id: "k3st-diffuse",
    label: "K3ST diffuse debug b01/b02/b03",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_control_diffuse_b01_b02_b03_map_rgb.png"
  },
  {
    id: "gcol-spring-4788",
    label: "spring color 4788",
    path: "extracted/maps/candidates/san11pkres/entry_04788_1ec1c496_GCOL0001/entry_04788_1ec1c496_GCOL0001_map_rgb.png"
  },
  {
    id: "gcol-summer-4789",
    label: "summer color 4789",
    path: "extracted/maps/candidates/san11pkres/entry_04789_1ef1dca1_GCOL0001/entry_04789_1ef1dca1_GCOL0001_map_rgb.png"
  },
  {
    id: "gcol-autumn-4787",
    label: "autumn color 4787",
    path: "extracted/maps/candidates/san11pkres/entry_04787_1e91ac8b_GCOL0001/entry_04787_1e91ac8b_GCOL0001_map_rgb.png"
  },
  {
    id: "gcol-winter-4790",
    label: "winter color 4790",
    path: "extracted/maps/candidates/san11pkres/entry_04790_1f21f4ac_GCOL0001/entry_04790_1f21f4ac_GCOL0001_map_rgb.png"
  }
];

const groundTileSpecs = [
  "64x64_24bpp",
  "64x64_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "64x64_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "64x64_24bpp",
  "128x128_24bpp",
  "256x256_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "128x128_24bpp",
  "64x64_24bpp",
  "64x64_24bpp",
  "128x128_32bpp"
];

function buildGroundTilePaths(seasonFolder: string) {
  return groundTileSpecs.map(
    (spec, index) =>
      `extracted/maps/original_textures/decompiled_wftx_ground/${seasonFolder}/tile_${String(index).padStart(2, "0")}_${spec}.png`
  );
}

const groundTextures: GroundTextureOption[] = [
  {
    id: "ground-spring-4801",
    label: "spring ground 4801",
    tilePaths: buildGroundTilePaths("spring_4801")
  },
  {
    id: "ground-summer-4802",
    label: "summer ground 4802",
    tilePaths: buildGroundTilePaths("summer_4802")
  },
  {
    id: "ground-autumn-4800",
    label: "autumn ground 4800",
    tilePaths: buildGroundTilePaths("autumn_4800")
  },
  {
    id: "ground-winter-4803",
    label: "winter ground 4803",
    tilePaths: buildGroundTilePaths("winter_4803")
  }
];

const waterMaskPath =
  "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_bits44_51_has_water_map.png";

const meshSegments = 256;
const terrainSize = 720;

export function TerrainMapPage() {
  const [heightLayerId, setHeightLayerId] = useState(heightLayers[0].id);
  const [colorLayerId, setColorLayerId] = useState("gcol-summer-4789");
  const [groundTextureId, setGroundTextureId] = useState("ground-summer-4802");
  const [diagnosticLayerId, setDiagnosticLayerId] = useState(diagnosticLayers[0].id);
  const [diagnosticOpacity, setDiagnosticOpacity] = useState(45);
  const [groundStrength, setGroundStrength] = useState(26);
  const [heightScale, setHeightScale] = useState(14);
  const [heightBias, setHeightBias] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [showSea, setShowSea] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [waterRepeat, setWaterRepeat] = useState(30);
  const [waterSpeed, setWaterSpeed] = useState(10);
  const [waterOpacity, setWaterOpacity] = useState(50);

  const heightLayer = heightLayers.find((layer) => layer.id === heightLayerId) ?? heightLayers[0];
  const colorLayer = colorLayers.find((layer) => layer.id === colorLayerId) ?? colorLayers[0];
  const groundTexture = groundTextures.find((texture) => texture.id === groundTextureId) ?? groundTextures[0];
  const diagnosticLayer = diagnosticLayers.find((layer) => layer.id === diagnosticLayerId) ?? diagnosticLayers[0];

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden bg-[#d6ddd2]">
      <TerrainViewport
        colorUrl={repoFile(colorLayer.path)}
        diagnosticOpacity={diagnosticLayer.id === "none" ? 0 : diagnosticOpacity / 100}
        diagnosticUrl={diagnosticLayer.id === "none" ? repoFile(heightLayer.path) : repoFile(diagnosticLayer.path)}
        groundStrength={groundStrength / 100}
        groundTileUrls={groundTexture.tilePaths.map(repoFile)}
        heightBias={heightBias}
        heightScale={heightScale}
        heightUrl={repoFile(heightLayer.path)}
        seaLevel={seaLevel}
        showGrid={showGrid}
        showSea={showSea}
        waterOpacity={waterOpacity / 100}
        waterRepeat={waterRepeat}
        waterSpeed={waterSpeed / 100}
        waterMaskUrl={repoFile(waterMaskPath)}
        wireframe={wireframe}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="pointer-events-auto hidden max-w-[460px] rounded-md border border-white/50 bg-white/88 p-3 shadow-lg backdrop-blur sm:block">
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">3D 世界地图</h1>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            K3ST b00 驱动地形高度；K3ST diffuse/GCOL 提供完整地形色图；ground WFTX 只是候选细节材质。
          </p>
        </div>

        <div className="pointer-events-auto grid max-h-[42vh] w-full max-w-[920px] gap-3 overflow-y-auto rounded-md border border-white/50 bg-white/88 p-3 shadow-lg backdrop-blur md:grid-cols-2 lg:max-h-none lg:overflow-visible xl:grid-cols-5">
          <ControlBlock label="高度源">
            <Select value={heightLayerId} onChange={(event) => setHeightLayerId(event.target.value)} className="w-full">
              {heightLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.label}
                </option>
              ))}
            </Select>
          </ControlBlock>

          <ControlBlock label="诊断叠加">
            <Select value={diagnosticLayerId} onChange={(event) => setDiagnosticLayerId(event.target.value)} className="w-full">
              {diagnosticLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.label}
                </option>
              ))}
            </Select>
          </ControlBlock>

          <ControlBlock label="颜色层">
            <Select value={colorLayerId} onChange={(event) => setColorLayerId(event.target.value)} className="w-full">
              {colorLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.label}
                </option>
              ))}
            </Select>
          </ControlBlock>

          <ControlBlock label="WFTX 细节候选">
            <Select value={groundTextureId} onChange={(event) => setGroundTextureId(event.target.value)} className="w-full">
              {groundTextures.map((texture) => (
                <option key={texture.id} value={texture.id}>
                  {texture.label}
                </option>
              ))}
            </Select>
          </ControlBlock>

          <RangeControl label="高度倍率" max={40} min={0} onChange={setHeightScale} value={heightScale} />
          <RangeControl label="高度偏移" max={30} min={-30} onChange={setHeightBias} value={heightBias} />
          <RangeControl label="海平面" max={40} min={-50} onChange={setSeaLevel} value={seaLevel} />
          <RangeControl label="诊断透明" max={100} min={0} onChange={setDiagnosticOpacity} value={diagnosticOpacity} />
          <RangeControl label="WFTX 强度" max={100} min={0} onChange={setGroundStrength} value={groundStrength} />

          <RangeControl label="水面重复" max={96} min={4} onChange={setWaterRepeat} value={waterRepeat} />
          <RangeControl label="水面流速" max={80} min={0} onChange={setWaterSpeed} value={waterSpeed} />
          <RangeControl label="水面透明" max={100} min={0} onChange={setWaterOpacity} value={waterOpacity} />

          <ControlBlock label="显示">
            <div className="flex flex-wrap gap-2">
              <ToggleButton isActive={showSea} label="海面" onClick={() => setShowSea((value) => !value)} />
              <ToggleButton isActive={wireframe} label="线框" onClick={() => setWireframe((value) => !value)} />
              <ToggleButton isActive={showGrid} label="网格" onClick={() => setShowGrid((value) => !value)} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setHeightLayerId(heightLayers[0].id);
                  setColorLayerId("gcol-summer-4789");
                  setGroundTextureId("ground-summer-4802");
                  setDiagnosticLayerId(diagnosticLayers[0].id);
                  setDiagnosticOpacity(45);
                  setGroundStrength(26);
                  setHeightScale(14);
                  setHeightBias(0);
                  setSeaLevel(0);
                  setShowSea(true);
                  setShowGrid(false);
                  setWaterRepeat(30);
                  setWaterSpeed(10);
                  setWaterOpacity(50);
                }}
                title="重置地形参数"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </ControlBlock>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-md border border-white/50 bg-white/86 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur sm:block">
        拖拽旋转，滚轮缩放，右键平移
      </div>
    </div>
  );
}

function TerrainViewport({
  colorUrl,
  diagnosticOpacity,
  diagnosticUrl,
  groundStrength,
  groundTileUrls,
  heightBias,
  heightScale,
  heightUrl,
  seaLevel,
  showGrid,
  showSea,
  waterOpacity,
  waterRepeat,
  waterSpeed,
  waterMaskUrl,
  wireframe
}: {
  colorUrl: string;
  diagnosticOpacity: number;
  diagnosticUrl: string;
  groundStrength: number;
  groundTileUrls: string[];
  heightBias: number;
  heightScale: number;
  heightUrl: string;
  seaLevel: number;
  showGrid: boolean;
  showSea: boolean;
  waterOpacity: number;
  waterRepeat: number;
  waterSpeed: number;
  waterMaskUrl: string;
  wireframe: boolean;
}) {
  return (
    <Canvas
      camera={{ fov: 42, near: 1, far: 2200, position: [0, 330, 560] }}
      className="h-full w-full"
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#d6ddd2"]} />
      <fog attach="fog" args={["#d6ddd2", 760, 1350]} />
      <CameraTarget />
      <ambientLight intensity={0.78} />
      <directionalLight color="#fff5dd" intensity={1.65} position={[-260, 420, 280]} />
      <directionalLight color="#dae8ff" intensity={0.42} position={[320, 160, -280]} />

      <Suspense fallback={<ViewportMessage />}>
        <TerrainMesh
          colorUrl={colorUrl}
          diagnosticOpacity={diagnosticOpacity}
          diagnosticUrl={diagnosticUrl}
          groundStrength={groundStrength}
          groundTileUrls={groundTileUrls}
          heightBias={heightBias}
          heightScale={heightScale}
          heightUrl={heightUrl}
          showGrid={showGrid}
          waterMaskUrl={waterMaskUrl}
          wireframe={wireframe}
        />
        {showSea ? (
          <>
            <WaterSurface
              opacity={waterOpacity}
              repeat={waterRepeat}
              seaLevel={seaLevel}
              speed={waterSpeed}
              waterMaskUrl={waterMaskUrl}
            />
            <MistSurface
              heightBias={heightBias}
              heightScale={heightScale}
              heightUrl={heightUrl}
              seaLevel={seaLevel}
              waterMaskUrl={waterMaskUrl}
            />
          </>
        ) : null}
      </Suspense>

      <OrbitControls
        makeDefault
        dampingFactor={0.08}
        enableDamping
        maxDistance={1150}
        maxPolarAngle={1.42}
        minDistance={120}
        minPolarAngle={0.18}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

function CameraTarget() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function TerrainMesh({
  colorUrl,
  diagnosticOpacity,
  diagnosticUrl,
  groundStrength,
  groundTileUrls,
  heightBias,
  heightScale,
  heightUrl,
  showGrid,
  waterMaskUrl,
  wireframe
}: {
  colorUrl: string;
  diagnosticOpacity: number;
  diagnosticUrl: string;
  groundStrength: number;
  groundTileUrls: string[];
  heightBias: number;
  heightScale: number;
  heightUrl: string;
  showGrid: boolean;
  waterMaskUrl: string;
  wireframe: boolean;
}) {
  const [diffuseTexture, heightTexture, diagnosticTexture, waterMaskTexture] = useLoader(THREE.TextureLoader, [
    colorUrl,
    heightUrl,
    diagnosticUrl,
    waterMaskUrl
  ]);
  const groundTileTextures = useLoader(THREE.TextureLoader, groundTileUrls);
  const groundAtlasTexture = useMemo(() => buildGroundAtlasTexture(groundTileTextures), [groundTileTextures]);

  useEffect(() => {
    diffuseTexture.colorSpace = THREE.SRGBColorSpace;
    diffuseTexture.anisotropy = 8;
    diffuseTexture.wrapS = THREE.ClampToEdgeWrapping;
    diffuseTexture.wrapT = THREE.ClampToEdgeWrapping;
    configureDetailTexture(groundAtlasTexture, 12);
    configureHeightTexture(heightTexture);
    diagnosticTexture.colorSpace = THREE.NoColorSpace;
    diagnosticTexture.wrapS = THREE.ClampToEdgeWrapping;
    diagnosticTexture.wrapT = THREE.ClampToEdgeWrapping;
    diagnosticTexture.minFilter = THREE.LinearFilter;
    diagnosticTexture.magFilter = THREE.LinearFilter;
    diagnosticTexture.needsUpdate = true;
    configureHeightTexture(waterMaskTexture);
  }, [diagnosticTexture, diffuseTexture, groundAtlasTexture, heightTexture, waterMaskTexture]);

  useEffect(() => {
    return () => {
      groundAtlasTexture.dispose();
    };
  }, [groundAtlasTexture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainSize, terrainSize, meshSegments, meshSegments]} />
      <TerrainMaterial
        colorMap={diffuseTexture}
        diagnosticMap={diagnosticTexture}
        diagnosticOpacity={diagnosticOpacity}
        groundMap={groundAtlasTexture}
        groundStrength={groundStrength}
        heightBias={heightBias}
        heightMap={heightTexture}
        heightScale={heightScale}
        showGrid={showGrid}
        waterMaskMap={waterMaskTexture}
        wireframe={wireframe}
      />
    </mesh>
  );
}

function configureHeightTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.offset.set(0, 0);
  texture.repeat.set(1, 1);
  texture.needsUpdate = true;
}

function configureDetailTexture(texture: THREE.Texture, anisotropy: number) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
}

function buildGroundAtlasTexture(tileTextures: THREE.Texture[]) {
  const columns = 6;
  const cellSize = 256;
  const canvas = document.createElement("canvas");
  canvas.width = columns * cellSize;
  canvas.height = columns * cellSize;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create ground atlas canvas context");
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);

  tileTextures.forEach((texture, index) => {
    const image = texture.image as CanvasImageSource | undefined;
    if (!image) {
      return;
    }

    const x = (index % columns) * cellSize;
    const y = Math.floor(index / columns) * cellSize;
    const pattern = context.createPattern(image, "repeat");
    context.save();
    context.beginPath();
    context.rect(x, y, cellSize, cellSize);
    context.clip();

    if (pattern) {
      context.translate(x, y);
      context.fillStyle = pattern;
      context.fillRect(0, 0, cellSize, cellSize);
    } else {
      context.drawImage(image, x, y, cellSize, cellSize);
    }

    context.restore();
  });

  const atlasTexture = new THREE.CanvasTexture(canvas);
  atlasTexture.name = "decompiled-wftx-ground-atlas";
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.wrapS = THREE.RepeatWrapping;
  atlasTexture.wrapT = THREE.RepeatWrapping;
  atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;
  atlasTexture.generateMipmaps = true;
  atlasTexture.needsUpdate = true;
  return atlasTexture;
}

function TerrainMaterial({
  colorMap,
  diagnosticMap,
  diagnosticOpacity,
  groundMap,
  groundStrength,
  heightBias,
  heightMap,
  heightScale,
  showGrid,
  waterMaskMap,
  wireframe
}: {
  colorMap: THREE.Texture;
  diagnosticMap: THREE.Texture;
  diagnosticOpacity: number;
  groundMap: THREE.Texture;
  groundStrength: number;
  heightBias: number;
  heightMap: THREE.Texture;
  heightScale: number;
  showGrid: boolean;
  waterMaskMap: THREE.Texture;
  wireframe: boolean;
}) {
  const uniforms = useMemo(
    () => ({
      colorMap: { value: colorMap },
      diagnosticMap: { value: diagnosticMap },
      diagnosticOpacity: { value: diagnosticOpacity },
      groundMap: { value: groundMap },
      groundStrength: { value: groundStrength },
      heightBias: { value: heightBias },
      heightMap: { value: heightMap },
      heightScale: { value: heightScale },
      showGrid: { value: showGrid ? 1 : 0 },
      waterMaskMap: { value: waterMaskMap }
    }),
    [
      colorMap,
      diagnosticMap,
      diagnosticOpacity,
      groundMap,
      groundStrength,
      heightBias,
      heightMap,
      heightScale,
      showGrid,
      waterMaskMap
    ]
  );

  return (
    <shaderMaterial
      fragmentShader={terrainFragmentShader}
      uniforms={uniforms}
      vertexShader={terrainVertexShader}
      wireframe={wireframe}
    />
  );
}

const terrainVertexShader = `
  uniform sampler2D heightMap;
  uniform float heightBias;
  uniform float heightScale;

  varying float vHeight;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  float sampleHeight(vec2 sampleUv) {
    return texture2D(heightMap, clamp(sampleUv, vec2(0.0), vec2(1.0))).r;
  }

  void main() {
    vUv = uv;
    float h = sampleHeight(uv);
    vHeight = h;
    vec2 texel = vec2(1.0 / 1025.0);
    float hL = sampleHeight(uv - vec2(texel.x, 0.0));
    float hR = sampleHeight(uv + vec2(texel.x, 0.0));
    float hD = sampleHeight(uv - vec2(0.0, texel.y));
    float hU = sampleHeight(uv + vec2(0.0, texel.y));
    vec2 gradient = vec2(hR - hL, hU - hD) * heightScale;
    vec3 localNormal = normalize(vec3(-gradient.x, -gradient.y, 0.72));
    vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
    vec3 displaced = position;
    displaced.z += h * heightScale + heightBias;
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const terrainFragmentShader = `
  uniform sampler2D colorMap;
  uniform sampler2D diagnosticMap;
  uniform sampler2D groundMap;
  uniform sampler2D heightMap;
  uniform sampler2D waterMaskMap;
  uniform float diagnosticOpacity;
  uniform float groundStrength;
  uniform float heightScale;
  uniform int showGrid;

  varying float vHeight;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  float selectGroundTile(vec3 baseColor, float heightValue) {
    float greenBias = baseColor.g - max(baseColor.r, baseColor.b) * 0.82;
    float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
    float highland = smoothstep(0.36, 0.78, heightValue);
    float mountain = max(highland, smoothstep(0.08, 0.18, baseColor.b - baseColor.g));
    float tile = 29.0;

    if (greenBias > 0.055 && heightValue < 0.64) {
      tile = 23.0;
    }
    if (luma > 0.58 || (luma > 0.48 && highland > 0.3)) {
      tile = 31.0;
    }
    if (mountain > 0.72) {
      tile = 6.0;
    }

    return tile;
  }

  vec3 sampleGroundTile(sampler2D atlas, vec2 uv, float tileIndex, float repeatScale) {
    float columns = 6.0;
    float tileSize = 1.0 / columns;
    float index = floor(tileIndex + 0.5);
    float column = mod(index, columns);
    float row = floor(index / columns);
    vec2 localUv = fract(uv * repeatScale);
    vec2 inset = vec2(0.75 / 1024.0);
    vec2 atlasUv = vec2(column, row) * tileSize + localUv * (tileSize - inset * 2.0) + inset;
    return texture2D(atlas, atlasUv).rgb;
  }

  float sampleHeight(vec2 uv) {
    return texture2D(heightMap, clamp(uv, vec2(0.0), vec2(1.0))).r;
  }

  float hash(vec2 value) {
    return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453);
  }

  float valueNoise(vec2 value) {
    vec2 base = floor(value);
    vec2 local = fract(value);
    vec2 curve = local * local * (3.0 - 2.0 * local);
    float a = hash(base);
    float b = hash(base + vec2(1.0, 0.0));
    float c = hash(base + vec2(0.0, 1.0));
    float d = hash(base + vec2(1.0, 1.0));
    return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
  }

  vec3 applyHeightShading(vec3 color, vec2 uv, float heightValue) {
    vec2 texel = vec2(1.0 / 1025.0);
    float hL = sampleHeight(uv - vec2(texel.x, 0.0));
    float hR = sampleHeight(uv + vec2(texel.x, 0.0));
    float hD = sampleHeight(uv - vec2(0.0, texel.y));
    float hU = sampleHeight(uv + vec2(0.0, texel.y));
    vec2 gradient = vec2(hR - hL, hU - hD) * heightScale;
    float slope = clamp(length(gradient) * 1.35, 0.0, 1.0);
    vec3 normal = normalize(vec3(-gradient.x, -gradient.y, 0.72));
    vec3 lightDir = normalize(vec3(-0.42, 0.68, 0.58));
    float light = dot(normal, lightDir);
    float shade = mix(0.78, 1.17, smoothstep(-0.18, 0.72, light));
    float highland = smoothstep(0.34, 0.82, heightValue);
    vec3 ink = mix(vec3(0.40, 0.43, 0.36), vec3(0.72, 0.70, 0.60), highland);
    color = mix(color, color * shade, 0.48);
    color = mix(color, ink, slope * highland * 0.18);
    color += slope * highland * vec3(0.055, 0.045, 0.03);
    return color;
  }

  float smoothedWaterMask(vec2 uv) {
    vec2 texel = vec2(1.0 / 1025.0);
    float center = texture2D(waterMaskMap, uv).r;
    float near = texture2D(waterMaskMap, uv + vec2(texel.x, 0.0)).r
      + texture2D(waterMaskMap, uv - vec2(texel.x, 0.0)).r
      + texture2D(waterMaskMap, uv + vec2(0.0, texel.y)).r
      + texture2D(waterMaskMap, uv - vec2(0.0, texel.y)).r;
    return (center * 2.0 + near) / 6.0;
  }

  vec3 applyInkEdge(vec3 color, vec2 uv, float heightValue, float cameraDistance) {
    vec2 texel = vec2(1.0 / 1025.0);
    float hL = sampleHeight(uv - vec2(texel.x * 2.5, 0.0));
    float hR = sampleHeight(uv + vec2(texel.x * 2.5, 0.0));
    float hD = sampleHeight(uv - vec2(0.0, texel.y * 2.5));
    float hU = sampleHeight(uv + vec2(0.0, texel.y * 2.5));
    float hNearL = sampleHeight(uv - vec2(texel.x, 0.0));
    float hNearR = sampleHeight(uv + vec2(texel.x, 0.0));
    float hNearD = sampleHeight(uv - vec2(0.0, texel.y));
    float hNearU = sampleHeight(uv + vec2(0.0, texel.y));
    vec2 wideGradient = vec2(hR - hL, hU - hD);
    vec2 nearGradient = vec2(hNearR - hNearL, hNearU - hNearD);
    float slope = clamp(length(wideGradient) * heightScale * 2.25, 0.0, 1.0);
    float crease = clamp(abs(length(nearGradient) - length(wideGradient)) * heightScale * 7.5, 0.0, 1.0);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float ndv = abs(dot(normalize(vWorldNormal), viewDir));
    float highland = smoothstep(0.22, 0.76, heightValue);
    float mountainInk = smoothstep(0.34, 0.92, heightValue);
    float viewContourCore = smoothstep(0.22, 0.045, ndv);
    float viewContourWide = smoothstep(0.46, 0.10, ndv);
    float viewContour = max(viewContourCore, viewContourWide * 0.42);
    float ridge = smoothstep(0.18, 0.62, slope) * highland * viewContourWide;
    float distanceFade = 1.0 - smoothstep(840.0, 1280.0, cameraDistance);

    float edgeFine = max(
      abs(sampleHeight(uv + vec2(texel.x * 1.5, 0.0)) - sampleHeight(uv - vec2(texel.x * 1.5, 0.0))),
      abs(sampleHeight(uv + vec2(0.0, texel.y * 1.5)) - sampleHeight(uv - vec2(0.0, texel.y * 1.5)))
    ) * heightScale;
    float edgeMid = max(
      abs(sampleHeight(uv + vec2(texel.x * 4.0, texel.y * 1.4)) - sampleHeight(uv - vec2(texel.x * 4.0, texel.y * 1.4))),
      abs(sampleHeight(uv + vec2(texel.x * 1.4, -texel.y * 4.0)) - sampleHeight(uv - vec2(texel.x * 1.4, -texel.y * 4.0)))
    ) * heightScale;
    float edgeWide = max(
      abs(sampleHeight(uv + vec2(texel.x * 8.0, 0.0)) - sampleHeight(uv - vec2(texel.x * 8.0, 0.0))),
      abs(sampleHeight(uv + vec2(0.0, texel.y * 8.0)) - sampleHeight(uv - vec2(0.0, texel.y * 8.0)))
    ) * heightScale;
    float thickEdge = smoothstep(0.045, 0.22, edgeFine) * 0.36
      + smoothstep(0.070, 0.30, edgeMid) * 0.40
      + smoothstep(0.095, 0.38, edgeWide) * 0.24;
    float brush = valueNoise(uv * 132.0 + vec2(heightValue * 25.0, -heightValue * 18.0));
    float fiber = sin((uv.x * 180.0 + uv.y * 223.0 + heightValue * 24.0) * 6.28318) * 0.5 + 0.5;
    float edgeFiber = mix(0.72, 1.04, fiber) * mix(0.84, 1.08, brush);
    float inkBreakup = mix(0.76, 1.10, brush) * mix(0.74, 1.0, fiber);
    float apparentEdge = viewContour * mix(0.35, 1.0, mountainInk) * mix(0.52, 1.10, slope) * edgeFiber;
    float blackEdge = clamp(
      apparentEdge * 1.18
        + ridge * 0.28
        + crease * viewContourWide * 0.10
        + thickEdge * viewContourWide * mix(0.02, 0.16, mountainInk),
      0.0,
      1.0
    );
    float ink = clamp(
      blackEdge,
      0.0,
      1.0
    ) * distanceFade * inkBreakup;
    float wash = viewContourWide * highland * distanceFade;
    vec3 inkTone = vec3(0.0);
    vec3 washed = mix(color, vec3(0.24, 0.24, 0.20), wash * 0.07);
    float inkAlpha = clamp(ink * mix(0.32, 0.90, mountainInk), 0.0, 0.90);
    return mix(washed, inkTone, inkAlpha);
  }

  vec3 applyLowlandMist(vec3 color, vec2 uv, float heightValue, float cameraDistance) {
    float waterInfluence = smoothstep(0.02, 0.42, smoothedWaterMask(uv));
    float lowland = smoothstep(0.32, 0.04, heightValue);
    float distanceMist = smoothstep(260.0, 880.0, cameraDistance);
    float mist = max(waterInfluence * 0.38, lowland * 0.20) * mix(0.78, 1.0, distanceMist);
    vec3 mistColor = vec3(0.70, 0.74, 0.69);
    return mix(color, mistColor, clamp(mist, 0.0, 0.42));
  }

  float terrainGridMask(vec2 uv) {
    vec2 cell = fract(uv * 48.0);
    vec2 edge = min(cell, 1.0 - cell);
    float line = 1.0 - smoothstep(0.0, 0.035, min(edge.x, edge.y));
    return line;
  }

  void main() {
    vec3 baseColor = texture2D(colorMap, vUv).rgb;
    float groundTile = selectGroundTile(baseColor, vHeight);
    float groundRepeat = 42.0;
    vec3 groundLowDetail = sampleGroundTile(groundMap, vUv, groundTile, groundRepeat * 0.28);
    vec3 groundMidDetail = sampleGroundTile(groundMap, vUv, groundTile, groundRepeat * 0.52);
    vec3 groundFineDetail = sampleGroundTile(groundMap, vUv, groundTile, groundRepeat * 0.78);
    float cameraDistance = distance(cameraPosition, vWorldPosition);
    float midWeight = 1.0 - smoothstep(520.0, 900.0, cameraDistance);
    float fineWeight = 1.0 - smoothstep(260.0, 560.0, cameraDistance);
    vec3 groundDetail = mix(groundLowDetail, groundMidDetail, midWeight * 0.82);
    groundDetail = mix(groundDetail, groundFineDetail, fineWeight);
    float groundLuma = dot(groundDetail, vec3(0.299, 0.587, 0.114));
    vec3 groundTone = mix(vec3(groundLuma), groundDetail, 0.28);
    vec3 detailMultiplier = mix(vec3(1.0), groundTone * 1.22, 0.28);
    float detailWeight = groundStrength * mix(0.30, 0.58, fineWeight);
    baseColor = mix(baseColor, baseColor * detailMultiplier, detailWeight);
    baseColor += (groundLuma - 0.5) * groundStrength * 0.055;

    baseColor = applyHeightShading(baseColor, vUv, vHeight);
    float shade = mix(0.88, 1.05, smoothstep(0.08, 0.9, vHeight));
    vec3 fogTint = vec3(0.82, 0.86, 0.80);
    vec3 color = mix(baseColor * shade, fogTint, 0.05);
    color = applyLowlandMist(color, vUv, vHeight, cameraDistance);
    color = applyInkEdge(color, vUv, vHeight, cameraDistance);
    if (showGrid == 1) {
      float grid = terrainGridMask(vUv);
      color = mix(color, vec3(0.92, 0.96, 0.90), grid * 0.48);
      color = mix(color, vec3(0.18, 0.22, 0.18), grid * 0.08);
    }
    float diagnosticValue = texture2D(diagnosticMap, vUv).r;
    vec3 diagnosticColor = vec3(diagnosticValue);
    color = mix(color, diagnosticColor, diagnosticOpacity);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function WaterSurface({
  opacity,
  repeat,
  seaLevel,
  speed,
  waterMaskUrl
}: {
  opacity: number;
  repeat: number;
  seaLevel: number;
  speed: number;
  waterMaskUrl: string;
}) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const waterMaskTexture = useLoader(THREE.TextureLoader, waterMaskUrl);

  useEffect(() => {
    waterMaskTexture.colorSpace = THREE.NoColorSpace;
    waterMaskTexture.wrapS = THREE.ClampToEdgeWrapping;
    waterMaskTexture.wrapT = THREE.ClampToEdgeWrapping;
    waterMaskTexture.minFilter = THREE.LinearFilter;
    waterMaskTexture.magFilter = THREE.LinearFilter;
    waterMaskTexture.needsUpdate = true;
  }, [waterMaskTexture]);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      waterMaskMap: { value: waterMaskTexture },
      waterOpacity: { value: opacity },
      waterRepeat: { value: repeat },
      waterSpeed: { value: speed }
    }),
    [opacity, repeat, speed, waterMaskTexture]
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, seaLevel + 0.18, 0]} renderOrder={3} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainSize * 1.02, terrainSize * 1.02, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        depthTest
        depthWrite={false}
        fragmentShader={waterFragmentShader}
        transparent
        uniforms={uniforms}
        vertexShader={waterVertexShader}
      />
    </mesh>
  );
}

function MistSurface({
  heightBias,
  heightScale,
  heightUrl,
  seaLevel,
  waterMaskUrl
}: {
  heightBias: number;
  heightScale: number;
  heightUrl: string;
  seaLevel: number;
  waterMaskUrl: string;
}) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const [heightTexture, waterMaskTexture] = useLoader(THREE.TextureLoader, [heightUrl, waterMaskUrl]);
  const mistHeight = seaLevel + heightBias + Math.max(2.8, heightScale * 0.34);

  useEffect(() => {
    configureHeightTexture(heightTexture);
    configureHeightTexture(waterMaskTexture);
  }, [heightTexture, waterMaskTexture]);

  const uniforms = useMemo(
    () => ({
      heightMap: { value: heightTexture },
      time: { value: 0 },
      waterMaskMap: { value: waterMaskTexture }
    }),
    [heightTexture, waterMaskTexture]
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, mistHeight, 0]} renderOrder={4} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainSize * 1.015, terrainSize * 1.015, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        depthTest
        depthWrite={false}
        fragmentShader={mistFragmentShader}
        transparent
        uniforms={uniforms}
        vertexShader={mistVertexShader}
      />
    </mesh>
  );
}

const waterVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const waterFragmentShader = `
  uniform sampler2D waterMaskMap;
  uniform float time;
  uniform float waterOpacity;
  uniform float waterRepeat;
  uniform float waterSpeed;

  varying vec2 vUv;

  float smoothedWaterMask(vec2 uv) {
    vec2 texel = vec2(1.0 / 1025.0);
    float center = texture2D(waterMaskMap, uv).r;
    float near = texture2D(waterMaskMap, uv + vec2(texel.x, 0.0)).r
      + texture2D(waterMaskMap, uv - vec2(texel.x, 0.0)).r
      + texture2D(waterMaskMap, uv + vec2(0.0, texel.y)).r
      + texture2D(waterMaskMap, uv - vec2(0.0, texel.y)).r;
    float far = texture2D(waterMaskMap, uv + vec2(texel.x, texel.y) * 2.0).r
      + texture2D(waterMaskMap, uv + vec2(-texel.x, texel.y) * 2.0).r
      + texture2D(waterMaskMap, uv + vec2(texel.x, -texel.y) * 2.0).r
      + texture2D(waterMaskMap, uv + vec2(-texel.x, -texel.y) * 2.0).r;
    return (center * 4.0 + near * 1.4 + far * 0.55) / 11.8;
  }

  void main() {
    float waterMaskValue = smoothedWaterMask(vUv);
    float waterMask = smoothstep(0.035, 0.34, waterMaskValue);
    if (waterMask <= 0.01) {
      discard;
    }

    vec2 tiledUv = vUv * waterRepeat * 0.34;
    vec2 flow = vec2(time * waterSpeed * 0.040, time * waterSpeed * 0.028);
    float waveA = sin((tiledUv.x * 0.72 + tiledUv.y * 0.18 + flow.x) * 6.28318);
    float waveB = sin((tiledUv.y * 0.52 - tiledUv.x * 0.22 + flow.y) * 6.28318);
    float waveC = sin((tiledUv.x * 1.4 - tiledUv.y * 0.85 + time * waterSpeed * 0.045) * 6.28318);
    float shine = smoothstep(-0.15, 1.05, waveA * 0.42 + waveB * 0.32 + waveC * 0.18);
    vec3 deep = vec3(0.055, 0.15, 0.21);
    vec3 shallow = vec3(0.12, 0.29, 0.34);
    vec3 highlight = vec3(0.42, 0.54, 0.52);
    float wave = smoothstep(0.34, 0.96, shine);
    vec3 color = mix(deep, shallow, wave);
    color = mix(color, highlight, wave * 0.075);
    float alpha = waterOpacity * waterMask * mix(0.42, 0.68, wave);

    gl_FragColor = vec4(color, alpha);
  }
`;

const mistVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mistFragmentShader = `
  uniform sampler2D heightMap;
  uniform sampler2D waterMaskMap;
  uniform float time;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float sampleHeight(vec2 uv) {
    return texture2D(heightMap, clamp(uv, vec2(0.0), vec2(1.0))).r;
  }

  float smoothedWaterMask(vec2 uv) {
    vec2 texel = vec2(1.0 / 1025.0);
    float center = texture2D(waterMaskMap, uv).r;
    float near = texture2D(waterMaskMap, uv + vec2(texel.x, 0.0)).r
      + texture2D(waterMaskMap, uv - vec2(texel.x, 0.0)).r
      + texture2D(waterMaskMap, uv + vec2(0.0, texel.y)).r
      + texture2D(waterMaskMap, uv - vec2(0.0, texel.y)).r;
    float far = texture2D(waterMaskMap, uv + vec2(texel.x, texel.y) * 3.0).r
      + texture2D(waterMaskMap, uv + vec2(-texel.x, texel.y) * 3.0).r
      + texture2D(waterMaskMap, uv + vec2(texel.x, -texel.y) * 3.0).r
      + texture2D(waterMaskMap, uv + vec2(-texel.x, -texel.y) * 3.0).r;
    return (center * 3.0 + near * 1.35 + far * 0.72) / 11.28;
  }

  float hash(vec2 value) {
    return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453);
  }

  float valueNoise(vec2 value) {
    vec2 base = floor(value);
    vec2 local = fract(value);
    vec2 curve = local * local * (3.0 - 2.0 * local);
    float a = hash(base);
    float b = hash(base + vec2(1.0, 0.0));
    float c = hash(base + vec2(0.0, 1.0));
    float d = hash(base + vec2(1.0, 1.0));
    return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
  }

  void main() {
    float heightValue = sampleHeight(vUv);
    float waterValue = smoothedWaterMask(vUv);
    float waterMist = smoothstep(0.025, 0.34, waterValue);
    float lowlandMist = smoothstep(0.38, 0.10, heightValue);

    vec2 wind = vec2(time * 0.038, -time * 0.021);
    vec2 crossWind = vec2(-time * 0.017, time * 0.029);
    float broadNoiseA = valueNoise(vUv * 13.0 + wind);
    float broadNoiseB = valueNoise(vUv * 21.0 + crossWind + vec2(19.2, -7.4));
    float fineNoise = valueNoise(vUv * 58.0 - wind * 1.7);
    float filament = sin((vUv.x * 38.0 + vUv.y * 52.0 + time * 0.34) * 6.28318) * 0.5 + 0.5;
    float cloudBody = broadNoiseA * 0.52 + broadNoiseB * 0.36 + fineNoise * 0.12;
    float cloudEdge = smoothstep(0.34, 0.78, cloudBody + filament * 0.10);
    float evaporate = smoothstep(0.14, 0.64, valueNoise(vUv * 33.0 + vec2(time * 0.055, time * 0.018)));
    float veil = cloudEdge * mix(0.45, 1.0, evaporate);

    float cameraDistance = distance(cameraPosition, vWorldPosition);
    float nearDissolve = smoothstep(260.0, 620.0, cameraDistance);
    float farFade = 1.0 - smoothstep(1120.0, 1620.0, cameraDistance);
    float mist = (waterMist * 0.36 + lowlandMist * 0.24) * veil * nearDissolve * farFade;
    if (mist <= 0.015) {
      discard;
    }

    vec3 mistColor = mix(vec3(0.78, 0.81, 0.75), vec3(0.64, 0.69, 0.63), waterMist * 0.45);
    gl_FragColor = vec4(mistColor, clamp(mist, 0.0, 0.46));
  }
`;

function ViewportMessage() {
  return (
    <Html center>
      <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">加载地形贴图</div>
    </Html>
  );
}

function ControlBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <ControlBlock label={`${label} ${value}`}>
      <input
        className="h-9 w-full accent-primary"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </ControlBlock>
  );
}

function ToggleButton({ isActive, label, onClick }: { isActive: boolean; label: string; onClick: () => void }) {
  return (
    <Button className={cn("h-8", isActive ? "" : "opacity-65")} onClick={onClick} size="sm" variant={isActive ? "default" : "outline"}>
      {label === "海面" ? <Waves className="h-3.5 w-3.5" /> : null}
      {label}
    </Button>
  );
}
