import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ISLANDS, type IslandId } from "../data/islands";
import { useT } from "../i18n";
import { LangToggle } from "../ui/LangToggle";

// Placeholder island scene: a flat sea and a sandy shoal. Phase 1 replaces it with the land DEM,
// Allen Coral Atlas shallow bathymetry and habitat texture, and the heat-stress wash.
export default function IslandScene({ island, onBack }: { island: IslandId; onBack: () => void }) {
  const t = useT();
  const name = ISLANDS.find((i) => i.id === island)?.name ?? island;
  return (
    <div className="scene">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 40, 70], fov: 45 }} gl={{ antialias: false, powerPreference: "low-power" }}>
        <color attach="background" args={["#06324a"]} />
        <hemisphereLight args={["#cfefff", "#0b3a53", 1.2]} />
        <directionalLight position={[30, 60, 20]} intensity={1.5} />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#0d6b8c" />
        </mesh>
        <mesh position-y={0.5} scale={[40, 1, 8]}>
          <cylinderGeometry args={[1, 1.2, 1, 48]} />
          <meshStandardMaterial color="#e9d9b0" />
        </mesh>
        <OrbitControls maxPolarAngle={Math.PI / 2.2} minDistance={20} maxDistance={150} />
      </Canvas>
      <div className="scene-ui">
        <button onClick={onBack}>← {t("scene.back")}</button>
        <h2>{name}</h2>
        <LangToggle />
      </div>
      <div className="scene-note">
        <p>{t("scene.placeholder")}</p>
        <p className="small">{t("scene.modelNote")}</p>
      </div>
    </div>
  );
}
