import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Mountain, RotateCcw, Waves } from "lucide-react";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
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
type HeightChannelMode = "r" | "g" | "b" | "a" | "luma" | "rg";

const heightLayers: TextureOption[] = [
  {
    id: "rgba",
    label: "K3ST RGBA",
    path: "extracted/maps/candidates/san11pkres/entry_04793_1f58cc67_K3ST0006/entry_04793_1f58cc67_K3ST0006_map_rgba.png"
  }
];

const colorLayers: TextureOption[] = [
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

const meshSegments = 256;
const terrainSize = 720;

export function TerrainMapPage() {
  const [heightLayerId, setHeightLayerId] = useState(heightLayers[0].id);
  const [colorLayerId, setColorLayerId] = useState(colorLayers[0].id);
  const [heightChannelMode, setHeightChannelMode] = useState<HeightChannelMode>("luma");
  const [heightScale, setHeightScale] = useState(26);
  const [heightBias, setHeightBias] = useState(-10);
  const [seaLevel, setSeaLevel] = useState(-8);
  const [heightSampleMode, setHeightSampleMode] = useState<HeightSampleMode>("left");
  const [wireframe, setWireframe] = useState(false);
  const [showSea, setShowSea] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const heightLayer = heightLayers.find((layer) => layer.id === heightLayerId) ?? heightLayers[0];
  const colorLayer = colorLayers.find((layer) => layer.id === colorLayerId) ?? colorLayers[0];

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden bg-[#d6ddd2]">
      <TerrainViewport
        colorUrl={repoFile(colorLayer.path)}
        heightBias={heightBias}
        heightChannelMode={heightChannelMode}
        heightSampleMode={heightSampleMode}
        heightScale={heightScale}
        heightUrl={repoFile(heightLayer.path)}
        seaLevel={seaLevel}
        showGrid={showGrid}
        showSea={showSea}
        wireframe={wireframe}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="pointer-events-auto max-w-[460px] rounded-md border border-white/50 bg-white/88 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">3D 世界地图</h1>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            实验性地形渲染：K3ST 通道驱动高度，GCOL 提供地表颜色。参数用于校正通道语义。
          </p>
        </div>

        <div className="pointer-events-auto grid w-full max-w-[720px] gap-3 rounded-md border border-white/50 bg-white/88 p-3 shadow-lg backdrop-blur md:grid-cols-2 xl:grid-cols-4">
          <ControlBlock label="高度源">
            <Select value={heightLayerId} onChange={(event) => setHeightLayerId(event.target.value)} className="w-full">
              {heightLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.label}
                </option>
              ))}
            </Select>
          </ControlBlock>

          <ControlBlock label="通道组合">
            <Select
              value={heightChannelMode}
              onChange={(event) => setHeightChannelMode(event.target.value as HeightChannelMode)}
              className="w-full"
            >
              <option value="luma">RGB 加权</option>
              <option value="rg">R/G 平均</option>
              <option value="r">R / c0</option>
              <option value="g">G / c1</option>
              <option value="b">B / c2</option>
              <option value="a">A / c3</option>
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

          <RangeControl label="高度倍率" max={120} min={0} onChange={setHeightScale} value={heightScale} />
          <RangeControl label="高度偏移" max={30} min={-60} onChange={setHeightBias} value={heightBias} />
          <RangeControl label="海平面" max={40} min={-50} onChange={setSeaLevel} value={seaLevel} />

          <ControlBlock label="显示">
            <div className="flex flex-wrap gap-2">
              <ToggleButton isActive={showSea} label="海面" onClick={() => setShowSea((value) => !value)} />
              <ToggleButton isActive={wireframe} label="线框" onClick={() => setWireframe((value) => !value)} />
              <ToggleButton isActive={showGrid} label="网格" onClick={() => setShowGrid((value) => !value)} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setHeightChannelMode("luma");
                  setHeightScale(26);
                  setHeightBias(-10);
                  setSeaLevel(-8);
                  setHeightSampleMode("left");
                }}
                title="重置地形参数"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </ControlBlock>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-white/50 bg-white/86 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
        拖拽旋转，滚轮缩放，右键平移
      </div>
    </div>
  );
}

function TerrainViewport({
  colorUrl,
  heightBias,
  heightChannelMode,
  heightSampleMode,
  heightScale,
  heightUrl,
  seaLevel,
  showGrid,
  showSea,
  wireframe
}: {
  colorUrl: string;
  heightBias: number;
  heightChannelMode: HeightChannelMode;
  heightSampleMode: HeightSampleMode;
  heightScale: number;
  heightUrl: string;
  seaLevel: number;
  showGrid: boolean;
  showSea: boolean;
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
          heightBias={heightBias}
          heightChannelMode={heightChannelMode}
          heightSampleMode={heightSampleMode}
          heightScale={heightScale}
          heightUrl={heightUrl}
          wireframe={wireframe}
        />
        {showSea ? <SeaPlane seaLevel={seaLevel} /> : null}
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
  heightBias,
  heightChannelMode,
  heightSampleMode,
  heightScale,
  heightUrl,
  wireframe
}: {
  colorUrl: string;
  heightBias: number;
  heightChannelMode: HeightChannelMode;
  heightSampleMode: HeightSampleMode;
  heightScale: number;
  heightUrl: string;
  wireframe: boolean;
}) {
  const [diffuseTexture, heightTexture] = useLoader(THREE.TextureLoader, [colorUrl, heightUrl]);

  useEffect(() => {
    diffuseTexture.colorSpace = THREE.SRGBColorSpace;
    diffuseTexture.anisotropy = 8;
    diffuseTexture.wrapS = THREE.ClampToEdgeWrapping;
    diffuseTexture.wrapT = THREE.ClampToEdgeWrapping;
    heightTexture.colorSpace = THREE.NoColorSpace;
    heightTexture.wrapS = THREE.ClampToEdgeWrapping;
    heightTexture.wrapT = THREE.ClampToEdgeWrapping;
    heightTexture.minFilter = THREE.LinearFilter;
    heightTexture.magFilter = THREE.LinearFilter;

    if (heightSampleMode === "left") {
      heightTexture.offset.set(0, 0);
      heightTexture.repeat.set(0.5, 1);
    } else if (heightSampleMode === "right") {
      heightTexture.offset.set(0.5, 0);
      heightTexture.repeat.set(0.5, 1);
    } else {
      heightTexture.offset.set(0, 0);
      heightTexture.repeat.set(1, 1);
    }
    heightTexture.needsUpdate = true;
  }, [diffuseTexture, heightSampleMode, heightTexture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainSize, terrainSize, meshSegments, meshSegments]} />
      <TerrainMaterial
        colorMap={diffuseTexture}
        heightBias={heightBias}
        heightChannelMode={heightChannelMode}
        heightMap={heightTexture}
        heightSampleMode={heightSampleMode}
        heightScale={heightScale}
        wireframe={wireframe}
      />
    </mesh>
  );
}

function TerrainMaterial({
  colorMap,
  heightBias,
  heightChannelMode,
  heightMap,
  heightSampleMode,
  heightScale,
  wireframe
}: {
  colorMap: THREE.Texture;
  heightBias: number;
  heightChannelMode: HeightChannelMode;
  heightMap: THREE.Texture;
  heightSampleMode: HeightSampleMode;
  heightScale: number;
  wireframe: boolean;
}) {
  const uniforms = useMemo(
    () => ({
      colorMap: { value: colorMap },
      heightBias: { value: heightBias },
      heightChannelMode: { value: channelModeToUniform(heightChannelMode) },
      heightMap: { value: heightMap },
      heightSampleMode: { value: sampleModeToUniform(heightSampleMode) },
      heightScale: { value: heightScale }
    }),
    [colorMap, heightBias, heightChannelMode, heightMap, heightSampleMode, heightScale]
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

function channelModeToUniform(mode: HeightChannelMode) {
  if (mode === "r") {
    return 0;
  }
  if (mode === "g") {
    return 1;
  }
  if (mode === "b") {
    return 2;
  }
  if (mode === "a") {
    return 3;
  }
  if (mode === "rg") {
    return 5;
  }
  return 4;
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
  uniform int heightChannelMode;
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

  float heightValue(vec4 sampleValue) {
    if (heightChannelMode == 0) {
      return sampleValue.r;
    }
    if (heightChannelMode == 1) {
      return sampleValue.g;
    }
    if (heightChannelMode == 2) {
      return sampleValue.b;
    }
    if (heightChannelMode == 3) {
      return sampleValue.a;
    }
    if (heightChannelMode == 5) {
      return (sampleValue.r + sampleValue.g) * 0.5;
    }
    return dot(sampleValue.rgb, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vUv = uv;
    vec4 heightSample = texture2D(heightMap, heightUv(uv));
    float h = heightValue(heightSample);
    vHeight = h;
    vec3 displaced = position;
    displaced.z += h * heightScale + heightBias;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const terrainFragmentShader = `
  uniform sampler2D colorMap;

  varying float vHeight;
  varying vec2 vUv;

  void main() {
    vec3 baseColor = texture2D(colorMap, vUv).rgb;
    float shade = mix(0.72, 1.12, smoothstep(0.08, 0.9, vHeight));
    vec3 fogTint = vec3(0.78, 0.84, 0.76);
    vec3 color = mix(baseColor * shade, fogTint, 0.08);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function SeaPlane({ seaLevel }: { seaLevel: number }) {
  return (
    <mesh position={[0, seaLevel, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainSize * 1.05, terrainSize * 1.05, 1, 1]} />
      <meshPhysicalMaterial
        color="#2f7889"
        depthWrite={false}
        metalness={0}
        opacity={0.24}
        roughness={0.38}
        transparent
        transmission={0}
      />
    </mesh>
  );
}

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
