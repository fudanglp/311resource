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

type HeightSampleMode = "left" | "right" | "full";

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
    label: "K3ST diffuse b01/b02/b03",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_control_diffuse_b01_b02_b03_map_rgb.png"
  },
  {
    id: "gcol-4787",
    label: "GCOL 4787",
    path: "extracted/maps/candidates/san11pkres/entry_04787_1e91ac8b_GCOL0001/entry_04787_1e91ac8b_GCOL0001_map_rgb.png"
  },
  {
    id: "gcol-4788",
    label: "GCOL 4788",
    path: "extracted/maps/candidates/san11pkres/entry_04788_1ec1c496_GCOL0001/entry_04788_1ec1c496_GCOL0001_map_rgb.png"
  },
  {
    id: "gcol-4789",
    label: "GCOL 4789",
    path: "extracted/maps/candidates/san11pkres/entry_04789_1ef1dca1_GCOL0001/entry_04789_1ef1dca1_GCOL0001_map_rgb.png"
  },
  {
    id: "gcol-4790",
    label: "GCOL 4790",
    path: "extracted/maps/candidates/san11pkres/entry_04790_1f21f4ac_GCOL0001/entry_04790_1f21f4ac_GCOL0001_map_rgb.png"
  }
];

const waterTextures: TextureOption[] = [
  {
    id: "water-4800",
    label: "water 4800",
    path: "extracted/resources/output/san11pkres/wftx/64x64_24bpp/entry_04800_211911e7.png"
  },
  {
    id: "water-4801",
    label: "water 4801",
    path: "extracted/resources/output/san11pkres/wftx/64x64_24bpp/entry_04801_21477317.png"
  },
  {
    id: "water-4802",
    label: "water 4802",
    path: "extracted/resources/output/san11pkres/wftx/64x64_24bpp/entry_04802_2175d447.png"
  },
  {
    id: "water-4803",
    label: "water 4803",
    path: "extracted/resources/output/san11pkres/wftx/64x64_24bpp/entry_04803_21a43577.png"
  }
];

const waterMaskPath =
  "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_aux_bits44_51_has_water_map.png";

const meshSegments = 256;
const terrainSize = 720;

export function TerrainMapPage() {
  const [heightLayerId, setHeightLayerId] = useState(heightLayers[0].id);
  const [colorLayerId, setColorLayerId] = useState("gcol-4787");
  const [diagnosticLayerId, setDiagnosticLayerId] = useState(diagnosticLayers[0].id);
  const [diagnosticOpacity, setDiagnosticOpacity] = useState(45);
  const [heightScale, setHeightScale] = useState(18);
  const [heightBias, setHeightBias] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [heightSampleMode, setHeightSampleMode] = useState<HeightSampleMode>("full");
  const [wireframe, setWireframe] = useState(false);
  const [showSea, setShowSea] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [waterTextureId, setWaterTextureId] = useState(waterTextures[0].id);
  const [waterRepeat, setWaterRepeat] = useState(38);
  const [waterSpeed, setWaterSpeed] = useState(14);
  const [waterOpacity, setWaterOpacity] = useState(58);

  const heightLayer = heightLayers.find((layer) => layer.id === heightLayerId) ?? heightLayers[0];
  const colorLayer = colorLayers.find((layer) => layer.id === colorLayerId) ?? colorLayers[0];
  const diagnosticLayer = diagnosticLayers.find((layer) => layer.id === diagnosticLayerId) ?? diagnosticLayers[0];
  const waterTexture = waterTextures.find((texture) => texture.id === waterTextureId) ?? waterTextures[0];

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden bg-[#d6ddd2]">
      <TerrainViewport
        colorUrl={repoFile(colorLayer.path)}
        diagnosticOpacity={diagnosticLayer.id === "none" ? 0 : diagnosticOpacity / 100}
        diagnosticUrl={diagnosticLayer.id === "none" ? repoFile(heightLayer.path) : repoFile(diagnosticLayer.path)}
        heightBias={heightBias}
        heightSampleMode={heightSampleMode}
        heightScale={heightScale}
        heightUrl={repoFile(heightLayer.path)}
        seaLevel={seaLevel}
        showGrid={showGrid}
        showSea={showSea}
        waterOpacity={waterOpacity / 100}
        waterRepeat={waterRepeat}
        waterSpeed={waterSpeed / 100}
        waterMaskUrl={repoFile(waterMaskPath)}
        waterUrl={repoFile(waterTexture.path)}
        wireframe={wireframe}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="pointer-events-auto max-w-[460px] rounded-md border border-white/50 bg-white/88 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">3D 世界地图</h1>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            K3ST 诊断视图。b00 驱动地形高度；b01/b02/b03 可作为 terrain diffuse 颜色层。
          </p>
        </div>

        <div className="pointer-events-auto grid max-h-[calc(100vh-15rem)] w-full max-w-[920px] gap-3 overflow-y-auto rounded-md border border-white/50 bg-white/88 p-3 shadow-lg backdrop-blur md:grid-cols-2 lg:max-h-none lg:overflow-visible xl:grid-cols-5">
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

          <ControlBlock label="高度采样">
            <Select
              value={heightSampleMode}
              onChange={(event) => setHeightSampleMode(event.target.value as HeightSampleMode)}
              className="w-full"
            >
              <option value="left">左半拉伸</option>
              <option value="right">右半拉伸</option>
              <option value="full">全图直采</option>
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

          <RangeControl label="高度倍率" max={40} min={0} onChange={setHeightScale} value={heightScale} />
          <RangeControl label="高度偏移" max={30} min={-30} onChange={setHeightBias} value={heightBias} />
          <RangeControl label="海平面" max={40} min={-50} onChange={setSeaLevel} value={seaLevel} />
          <RangeControl label="诊断透明" max={100} min={0} onChange={setDiagnosticOpacity} value={diagnosticOpacity} />

          <ControlBlock label="水面贴图">
            <Select value={waterTextureId} onChange={(event) => setWaterTextureId(event.target.value)} className="w-full">
              {waterTextures.map((texture) => (
                <option key={texture.id} value={texture.id}>
                  {texture.label}
                </option>
              ))}
            </Select>
          </ControlBlock>

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
                  setColorLayerId("gcol-4787");
                  setDiagnosticLayerId(diagnosticLayers[0].id);
                  setDiagnosticOpacity(45);
                  setHeightScale(18);
                  setHeightBias(0);
                  setSeaLevel(0);
                  setHeightSampleMode("full");
                  setWaterTextureId(waterTextures[0].id);
                  setWaterRepeat(38);
                  setWaterSpeed(14);
                  setWaterOpacity(58);
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
  heightBias,
  heightSampleMode,
  heightScale,
  heightUrl,
  seaLevel,
  showGrid,
  showSea,
  waterOpacity,
  waterRepeat,
  waterSpeed,
  waterMaskUrl,
  waterUrl,
  wireframe
}: {
  colorUrl: string;
  diagnosticOpacity: number;
  diagnosticUrl: string;
  heightBias: number;
  heightSampleMode: HeightSampleMode;
  heightScale: number;
  heightUrl: string;
  seaLevel: number;
  showGrid: boolean;
  showSea: boolean;
  waterOpacity: number;
  waterRepeat: number;
  waterSpeed: number;
  waterMaskUrl: string;
  waterUrl: string;
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
          heightBias={heightBias}
          heightSampleMode={heightSampleMode}
          heightScale={heightScale}
          heightUrl={heightUrl}
          wireframe={wireframe}
        />
        {showSea ? (
          <WaterSurface
            opacity={waterOpacity}
            repeat={waterRepeat}
            seaLevel={seaLevel}
            speed={waterSpeed}
            waterMaskUrl={waterMaskUrl}
            waterUrl={waterUrl}
          />
        ) : null}
        {showGrid ? <gridHelper args={[terrainSize, 24, "#2f6f83", "#8aa29a"]} position={[0, seaLevel + 0.5, 0]} /> : null}
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
  heightBias,
  heightSampleMode,
  heightScale,
  heightUrl,
  wireframe
}: {
  colorUrl: string;
  diagnosticOpacity: number;
  diagnosticUrl: string;
  heightBias: number;
  heightSampleMode: HeightSampleMode;
  heightScale: number;
  heightUrl: string;
  wireframe: boolean;
}) {
  const [diffuseTexture, heightTexture, diagnosticTexture] = useLoader(THREE.TextureLoader, [colorUrl, heightUrl, diagnosticUrl]);

  useEffect(() => {
    diffuseTexture.colorSpace = THREE.SRGBColorSpace;
    diffuseTexture.anisotropy = 8;
    diffuseTexture.wrapS = THREE.ClampToEdgeWrapping;
    diffuseTexture.wrapT = THREE.ClampToEdgeWrapping;
    configureHeightTexture(heightTexture, heightSampleMode);
    diagnosticTexture.colorSpace = THREE.NoColorSpace;
    diagnosticTexture.wrapS = THREE.ClampToEdgeWrapping;
    diagnosticTexture.wrapT = THREE.ClampToEdgeWrapping;
    diagnosticTexture.minFilter = THREE.LinearFilter;
    diagnosticTexture.magFilter = THREE.LinearFilter;
    diagnosticTexture.needsUpdate = true;
  }, [diagnosticTexture, diffuseTexture, heightSampleMode, heightTexture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainSize, terrainSize, meshSegments, meshSegments]} />
      <TerrainMaterial
        colorMap={diffuseTexture}
        diagnosticMap={diagnosticTexture}
        diagnosticOpacity={diagnosticOpacity}
        heightBias={heightBias}
        heightMap={heightTexture}
        heightSampleMode={heightSampleMode}
        heightScale={heightScale}
        wireframe={wireframe}
      />
    </mesh>
  );
}

function configureHeightTexture(texture: THREE.Texture, heightSampleMode: HeightSampleMode) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  if (heightSampleMode === "left") {
    texture.offset.set(0, 0);
    texture.repeat.set(0.5, 1);
  } else if (heightSampleMode === "right") {
    texture.offset.set(0.5, 0);
    texture.repeat.set(0.5, 1);
  } else {
    texture.offset.set(0, 0);
    texture.repeat.set(1, 1);
  }
  texture.needsUpdate = true;
}

function TerrainMaterial({
  colorMap,
  diagnosticMap,
  diagnosticOpacity,
  heightBias,
  heightMap,
  heightSampleMode,
  heightScale,
  wireframe
}: {
  colorMap: THREE.Texture;
  diagnosticMap: THREE.Texture;
  diagnosticOpacity: number;
  heightBias: number;
  heightMap: THREE.Texture;
  heightSampleMode: HeightSampleMode;
  heightScale: number;
  wireframe: boolean;
}) {
  const uniforms = useMemo(
    () => ({
      colorMap: { value: colorMap },
      diagnosticMap: { value: diagnosticMap },
      diagnosticOpacity: { value: diagnosticOpacity },
      heightBias: { value: heightBias },
      heightMap: { value: heightMap },
      heightSampleMode: { value: sampleModeToUniform(heightSampleMode) },
      heightScale: { value: heightScale }
    }),
    [colorMap, diagnosticMap, diagnosticOpacity, heightBias, heightMap, heightSampleMode, heightScale]
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

function sampleModeToUniform(mode: HeightSampleMode) {
  if (mode === "left") {
    return 0;
  }
  if (mode === "right") {
    return 1;
  }
  return 2;
}

const terrainVertexShader = `
  uniform sampler2D heightMap;
  uniform float heightBias;
  uniform int heightSampleMode;
  uniform float heightScale;

  varying float vHeight;
  varying vec2 vUv;

  vec2 heightUv(vec2 uv) {
    if (heightSampleMode == 0) {
      return vec2(uv.x * 0.5, uv.y);
    }
    if (heightSampleMode == 1) {
      return vec2(0.5 + uv.x * 0.5, uv.y);
    }
    return uv;
  }

  void main() {
    vUv = uv;
    float h = texture2D(heightMap, heightUv(uv)).r;
    vHeight = h;
    vec3 displaced = position;
    displaced.z += h * heightScale + heightBias;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const terrainFragmentShader = `
  uniform sampler2D colorMap;
  uniform sampler2D diagnosticMap;
  uniform float diagnosticOpacity;

  varying float vHeight;
  varying vec2 vUv;

  void main() {
    vec3 baseColor = texture2D(colorMap, vUv).rgb;
    float shade = mix(0.72, 1.12, smoothstep(0.08, 0.9, vHeight));
    vec3 fogTint = vec3(0.78, 0.84, 0.76);
    vec3 color = mix(baseColor * shade, fogTint, 0.08);
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
  waterMaskUrl,
  waterUrl
}: {
  opacity: number;
  repeat: number;
  seaLevel: number;
  speed: number;
  waterMaskUrl: string;
  waterUrl: string;
}) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const [waterTexture, waterMaskTexture] = useLoader(THREE.TextureLoader, [waterUrl, waterMaskUrl]);

  useEffect(() => {
    waterTexture.colorSpace = THREE.SRGBColorSpace;
    waterTexture.wrapS = THREE.RepeatWrapping;
    waterTexture.wrapT = THREE.RepeatWrapping;
    waterTexture.minFilter = THREE.LinearFilter;
    waterTexture.magFilter = THREE.LinearFilter;
    waterTexture.anisotropy = 8;
    waterTexture.needsUpdate = true;
    waterMaskTexture.colorSpace = THREE.NoColorSpace;
    waterMaskTexture.wrapS = THREE.ClampToEdgeWrapping;
    waterMaskTexture.wrapT = THREE.ClampToEdgeWrapping;
    waterMaskTexture.minFilter = THREE.LinearFilter;
    waterMaskTexture.magFilter = THREE.LinearFilter;
    waterMaskTexture.needsUpdate = true;
  }, [waterMaskTexture, waterTexture]);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      waterMap: { value: waterTexture },
      waterMaskMap: { value: waterMaskTexture },
      waterOpacity: { value: opacity },
      waterRepeat: { value: repeat },
      waterSpeed: { value: speed }
    }),
    [opacity, repeat, speed, waterMaskTexture, waterTexture]
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

const waterVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const waterFragmentShader = `
  uniform sampler2D waterMap;
  uniform sampler2D waterMaskMap;
  uniform float time;
  uniform float waterOpacity;
  uniform float waterRepeat;
  uniform float waterSpeed;

  varying vec2 vUv;

  void main() {
    float waterMaskValue = texture2D(waterMaskMap, vUv).r;
    float waterMask = smoothstep(0.05, 0.22, waterMaskValue);
    if (waterMask <= 0.01) {
      discard;
    }

    vec2 flow = vec2(time * waterSpeed * 0.18, time * waterSpeed * 0.11);
    vec3 tile = texture2D(waterMap, vUv * waterRepeat + flow).rgb;
    float shine = dot(tile, vec3(0.299, 0.587, 0.114));
    vec3 deep = vec3(0.015, 0.20, 0.34);
    vec3 shallow = vec3(0.04, 0.42, 0.58);
    vec3 highlight = vec3(0.22, 0.68, 0.76);
    float wave = smoothstep(0.24, 0.92, shine);
    vec3 color = mix(deep, shallow, wave);
    color = mix(color, highlight, wave * 0.22);
    color = mix(color, tile, 0.04);
    float alpha = waterOpacity * waterMask * mix(0.64, 0.96, wave);

    gl_FragColor = vec4(color, alpha);
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
