import { Bounds, Center, Grid, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

export function ModelViewport({
  showAxes,
  showGrid,
  url,
  wireframe
}: {
  showAxes: boolean;
  showGrid: boolean;
  url: string;
  wireframe: boolean;
}) {
  return (
    <div className="h-[420px] overflow-hidden rounded-md border bg-background">
      <Canvas camera={{ position: [0, 80, 220], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={["#f8fafc"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[180, 220, 160]} intensity={1.2} />
        <directionalLight position={[-160, 120, -80]} intensity={0.45} />

        <Suspense fallback={<ViewportMessage text="Loading GLB" />}>
          <Bounds fit clip observe margin={1.25}>
            <Center>
              <LoadedModel url={url} wireframe={wireframe} />
            </Center>
          </Bounds>
        </Suspense>

        {showGrid ? <Grid args={[280, 28]} cellColor="#cbd5e1" sectionColor="#64748b" fadeDistance={420} /> : null}
        {showAxes ? <axesHelper args={[120]} /> : null}
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}

function LoadedModel({ url, wireframe }: { url: string; wireframe: boolean }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      object.castShadow = false;
      object.receiveShadow = false;
      const wasMaterialArray = Array.isArray(object.material);
      const materials: THREE.Material[] = wasMaterialArray ? object.material : [object.material];
      const clonedMaterials = materials.map((material) => {
        const cloneMaterial = material.clone();
        cloneMaterial.side = THREE.DoubleSide;
        if ("wireframe" in cloneMaterial) {
          cloneMaterial.wireframe = wireframe;
        }
        return cloneMaterial;
      });
      object.material = wasMaterialArray ? clonedMaterials : clonedMaterials[0];
    });
    return clone;
  }, [scene, wireframe]);

  return <primitive object={clonedScene} />;
}

function ViewportMessage({ text }: { text: string }) {
  return (
    <Html center>
      <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">{text}</div>
    </Html>
  );
}
