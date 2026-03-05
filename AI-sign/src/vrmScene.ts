import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as Kalidokit from "kalidokit";
import type { Landmark } from "./utils";

// Define the type Kalidokit expects
type KalidokitVector = { x: number; y: number; z: number; visibility?: number };

export interface VrmController {
    updateFromLandmarks(landmarks: Landmark[], handedness: "Left" | "Right"): void;
    // worldLandmarks: MediaPipe world-space coords (meters) for accurate 3D arm solving
    updateFromPose?(poseLandmarks: Landmark[], worldLandmarks?: Landmark[]): void;
    dispose(): void;
}

// Helper function to apply rotation with lerp - standard Kalidokit pattern
const rigRotation = (
    bone: THREE.Object3D | null,
    rotation: { x: number; y: number; z: number },
    dampener = 1,
    lerpFactor = 0.3
) => {
    if (!bone) return;

    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, rotation.x * dampener, lerpFactor);
    bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, rotation.y * dampener, lerpFactor);
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, rotation.z * dampener, lerpFactor);
};

export const initVrmScene = async (
    container: HTMLElement,
    vrmUrl: string
): Promise<VrmController> => {
    // --- Basic Three.js setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050814);

    const camera = new THREE.PerspectiveCamera(
        30,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.4, 2.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // --- Load VRM ---
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let vrm: VRM | null = null;

    await new Promise<void>((resolve, reject) => {
        loader.load(
            vrmUrl,
            (gltf) => {
                try {
                    const loadedVrm = gltf.userData.vrm as VRM | undefined;
                    if (!loadedVrm) {
                        throw new Error("No VRM instance found in gltf.userData.vrm");
                    }

                    vrm = loadedVrm;
                    vrm.scene.rotation.y = Math.PI;
                    scene.add(vrm.scene);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            },
            undefined,
            (error) => reject(error)
        );
    });

    // Helper to get bone from VRM
    const getBone = (name: VRMHumanBoneName): THREE.Object3D | null => {
        return vrm?.humanoid?.getRawBoneNode(name) ?? null;
    };

    // --- Drag-to-rotate interaction ---
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (ev: PointerEvent) => {
        isDragging = true;
        lastX = ev.clientX;
        lastY = ev.clientY;
        (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging || !vrm) return;
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;

        vrm.scene.rotation.y += dx * 0.005;
        vrm.scene.rotation.x = THREE.MathUtils.clamp(
            vrm.scene.rotation.x - dy * 0.005,
            -Math.PI / 4,
            Math.PI / 4
        );
    };

    const onPointerUp = (ev: PointerEvent) => {
        isDragging = false;
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);

    let animationFrameId: number;
    const renderLoop = () => {
        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const handleResize = () => {
        const { clientWidth, clientHeight } = container;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener("resize", handleResize);

    const lerpFactor = 0.3;

    // --- Controller ---
    const controller: VrmController = {
        updateFromLandmarks(landmarks: Landmark[], handedness: "Left" | "Right") {
            if (!vrm || !landmarks || landmarks.length === 0) return;

            // MediaPipe "Right" = VRM left side (webcam mirror + VRM faces the viewer)
            const side = handedness === "Right" ? "left" : "right";

            // ── FIX: Kalidokit side must match the VRM bone side, NOT the MediaPipe label ──
            // From doc.txt rigFingers: invert = side === RIGHT ? 1 : -1
            // Passing the wrong side flips the invert multiplier → all finger z values
            // end up with the opposite sign → fingers curl in the reverse direction.
            const kalidokitSide = (side === "left" ? "Left" : "Right") as "Left" | "Right";

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const handRig = Kalidokit.Hand.solve(landmarks as any, kalidokitSide);
            if (!handRig) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rot = (key: string) => (handRig as any)[key] as { x: number; y: number; z: number } | undefined;

            // Wrist — key prefix is kalidokitSide ("Left" or "Right")
            const wristRot = rot(`${kalidokitSide}Wrist`);
            if (wristRot) rigRotation(getBone(`${side}Hand` as VRMHumanBoneName), wristRot, 1, lerpFactor);

            // All finger joints — [KalidokitKey, VRMBoneName]
            // Thumb: Kalidokit Proximal → VRM Metacarpal, Intermediate → VRM Proximal
            const fingerMap: [string, string][] = [
                [`${kalidokitSide}IndexProximal`, `${side}IndexProximal`],
                [`${kalidokitSide}IndexIntermediate`, `${side}IndexIntermediate`],
                [`${kalidokitSide}IndexDistal`, `${side}IndexDistal`],
                [`${kalidokitSide}MiddleProximal`, `${side}MiddleProximal`],
                [`${kalidokitSide}MiddleIntermediate`, `${side}MiddleIntermediate`],
                [`${kalidokitSide}MiddleDistal`, `${side}MiddleDistal`],
                [`${kalidokitSide}RingProximal`, `${side}RingProximal`],
                [`${kalidokitSide}RingIntermediate`, `${side}RingIntermediate`],
                [`${kalidokitSide}RingDistal`, `${side}RingDistal`],
                [`${kalidokitSide}LittleProximal`, `${side}LittleProximal`],
                [`${kalidokitSide}LittleIntermediate`, `${side}LittleIntermediate`],
                [`${kalidokitSide}LittleDistal`, `${side}LittleDistal`],
                [`${kalidokitSide}ThumbProximal`, `${side}ThumbMetacarpal`],
                [`${kalidokitSide}ThumbIntermediate`, `${side}ThumbProximal`],
                [`${kalidokitSide}ThumbDistal`, `${side}ThumbDistal`],
            ];

            fingerMap.forEach(([kKey, vrmBone]) => {
                const r = rot(kKey);
                if (r) rigRotation(getBone(vrmBone as VRMHumanBoneName), r, 1, lerpFactor);
            });
        },

        updateFromPose(poseLandmarks: Landmark[], worldLandmarks?: Landmark[]) {
            if (!vrm || !poseLandmarks || poseLandmarks.length < 33) return;

            // ── FIX: Kalidokit.Pose.solve() expects two DIFFERENT landmark sets ──────────
            // pose3D → world-space coordinates in metres  (MediaPipe worldLandmarks)
            // pose2D → normalized screen coordinates 0-1  (MediaPipe landmarks)
            // Passing the same normalised array for both gives Pose.solve() wrong
            // depth data and produces near-zero arm rotations ("arms don't move").
            // Fall back to poseLandmarks for pose3D when worldLandmarks are unavailable.
            // ────────────────────────────────────────────────────────────────────────────
            const src3D = worldLandmarks ?? poseLandmarks;

            const pose3D: KalidokitVector[] = src3D.map(lm => ({
                x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1
            }));
            const pose2D: KalidokitVector[] = poseLandmarks.map(lm => ({
                x: lm.x, y: lm.y, z: 0, visibility: lm.visibility ?? 1
            }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poseRig = Kalidokit.Pose.solve(pose3D as any, pose2D as any);
            if (!poseRig) return;

            // Spine
            if (poseRig.Spine) {
                rigRotation(getBone("spine"), poseRig.Spine, 0.5, lerpFactor);
            }

            // ── Landmark index mapping (Kalidokit's calcArms, doc.txt) ──────────────────
            // Kalidokit SWAPS left/right to compensate for webcam mirror:
            //   UpperArm.r = findRotation(lm[11], lm[13])  ← MediaPipe LEFT landmarks
            //   UpperArm.l = findRotation(lm[12], lm[14])  ← MediaPipe RIGHT landmarks
            // Visibility gating must use the same indices Kalidokit used internally.
            // ────────────────────────────────────────────────────────────────────────────

            // Lowered from 0.5 → 0.3: typical webcam pose landmarks are often 0.3-0.5
            const MIN_VIS = 0.3;
            const vis = (lm: Landmark) => lm.visibility ?? 1;

            // Landmarks Kalidokit used to compute RightUpperArm (MediaPipe LEFT side)
            const kRS = poseLandmarks[11]; // LEFT_SHOULDER  → drives VRM rightUpperArm
            const kRE = poseLandmarks[13]; // LEFT_ELBOW     → drives VRM rightUpperArm
            const kRW = poseLandmarks[15]; // LEFT_WRIST     → drives VRM rightLowerArm

            // Landmarks Kalidokit used to compute LeftUpperArm (MediaPipe RIGHT side)
            const kLS = poseLandmarks[12]; // RIGHT_SHOULDER → drives VRM leftUpperArm
            const kLE = poseLandmarks[14]; // RIGHT_ELBOW    → drives VRM leftUpperArm
            const kLW = poseLandmarks[16]; // RIGHT_WRIST    → drives VRM leftLowerArm

            // RIGHT ARM — gated on MediaPipe LEFT landmarks (Kalidokit convention)
            if (vis(kRS) >= MIN_VIS && vis(kRE) >= MIN_VIS && poseRig.RightUpperArm) {
                rigRotation(getBone("rightUpperArm"), poseRig.RightUpperArm, 1, lerpFactor);
            }
            if (vis(kRE) >= MIN_VIS && vis(kRW) >= MIN_VIS && poseRig.RightLowerArm) {
                rigRotation(getBone("rightLowerArm"), poseRig.RightLowerArm, 1, lerpFactor);
            }

            // LEFT ARM — gated on MediaPipe RIGHT landmarks (Kalidokit convention)
            if (vis(kLS) >= MIN_VIS && vis(kLE) >= MIN_VIS && poseRig.LeftUpperArm) {
                rigRotation(getBone("leftUpperArm"), poseRig.LeftUpperArm, 1, lerpFactor);
            }
            if (vis(kLE) >= MIN_VIS && vis(kLW) >= MIN_VIS && poseRig.LeftLowerArm) {
                rigRotation(getBone("leftLowerArm"), poseRig.LeftLowerArm, 1, lerpFactor);
            }
        },

        dispose() {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", handleResize);

            renderer.domElement.removeEventListener("pointerdown", onPointerDown);
            renderer.domElement.removeEventListener("pointermove", onPointerMove);
            renderer.domElement.removeEventListener("pointerup", onPointerUp);
            renderer.domElement.removeEventListener("pointerleave", onPointerUp);

            renderer.dispose();
            if (renderer.domElement.parentElement === container) {
                container.removeChild(renderer.domElement);
            }
        },
    };

    return controller;
};