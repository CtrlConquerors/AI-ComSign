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

    // --- Drag-to-rotate + scroll/pinch-to-zoom interaction ---
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
        // ── FIX: was (- dy) which inverted up/down; now (+ dy) matches drag direction ──
        vrm.scene.rotation.x = THREE.MathUtils.clamp(
            vrm.scene.rotation.x + dy * 0.005,
            -Math.PI / 4,
            Math.PI / 4
        );
    };

    const onPointerUp = (ev: PointerEvent) => {
        isDragging = false;
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
    };

    // Scroll wheel + touchpad pinch → zoom by moving camera along Z axis.
    // ctrlKey is true for touchpad pinch gestures (browser-normalised pinch-to-zoom).
    const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        // Pinch deltas are much smaller than scroll wheel deltas — scale accordingly
        const scale = ev.ctrlKey ? 0.05 : 0.005;
        camera.position.z = THREE.MathUtils.clamp(
            camera.position.z + ev.deltaY * scale,
            0.8,  // closest (almost touching)
            5.0   // farthest
        );
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    // passive: false is required so ev.preventDefault() can suppress the page scroll
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

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

            // Direct mapping: user's left hand → VRM left bones, right → right.
            // MediaPipe reports handedness from the user's anatomical perspective.
            const side = handedness === "Left" ? "left" : "right";

            // kalidokitSide MUST equal the MediaPipe label — Kalidokit uses it to
            // choose the palm-normal vector and the invert multiplier in rigFingers
            // (doc.txt: invert = side === RIGHT ? 1 : -1).
            // Using the VRM-bone side here would flip all finger z-rotations.
            const kalidokitSide = handedness;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const handRig = Kalidokit.Hand.solve(landmarks as any, kalidokitSide);
            if (!handRig) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rot = (key: string) => (handRig as any)[key] as { x: number; y: number; z: number } | undefined;

            const wristRot = rot(`${kalidokitSide}Wrist`);
            if (wristRot) rigRotation(getBone(`${side}Hand` as VRMHumanBoneName), wristRot, 1, lerpFactor);

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

            if (poseRig.Spine) {
                rigRotation(getBone("spine"), poseRig.Spine, 0.5, lerpFactor);
            }

            // ── Kalidokit landmark convention (doc.txt: calcArms) ───────────────────────
            // RightUpperArm / RightHand ← computed from MediaPipe LEFT landmarks (11,13,15,17,19)
            // LeftUpperArm  / LeftHand  ← computed from MediaPipe RIGHT landmarks (12,14,16,18,20)
            // ────────────────────────────────────────────────────────────────────────────
            const MIN_VIS = 0.3;
            const vis = (lm: Landmark) => lm.visibility ?? 1;

            const kRS = poseLandmarks[11]; const kRE = poseLandmarks[13]; const kRW = poseLandmarks[15];
            const kLS = poseLandmarks[12]; const kLE = poseLandmarks[14]; const kLW = poseLandmarks[16];

            // RIGHT ARM
            if (vis(kRS) >= MIN_VIS && vis(kRE) >= MIN_VIS && poseRig.RightUpperArm) {
                rigRotation(getBone("rightUpperArm"), poseRig.RightUpperArm, 1, lerpFactor);
            }
            if (vis(kRE) >= MIN_VIS && vis(kRW) >= MIN_VIS && poseRig.RightLowerArm) {
                rigRotation(getBone("rightLowerArm"), poseRig.RightLowerArm, 1, lerpFactor);
            }

            // LEFT ARM
            if (vis(kLS) >= MIN_VIS && vis(kLE) >= MIN_VIS && poseRig.LeftUpperArm) {
                rigRotation(getBone("leftUpperArm"), poseRig.LeftUpperArm, 1, lerpFactor);
            }
            if (vis(kLE) >= MIN_VIS && vis(kLW) >= MIN_VIS && poseRig.LeftLowerArm) {
                rigRotation(getBone("leftLowerArm"), poseRig.LeftLowerArm, 1, lerpFactor);
            }

            // ── Wrist from pose (doc.txt: calcArms Hand.r/l) ────────────────────────────
            // poseRig.RightHand = findRotation(lm[15], lerp(lm[17], lm[19], 0.5))
            // poseRig.LeftHand  = findRotation(lm[16], lerp(lm[18], lm[20], 0.5))
            // Coarser than hand-landmark wrist but provides fallback when hands are
            // off-screen. updateFromLandmarks overwrites these bones when hands are visible.
            // ────────────────────────────────────────────────────────────────────────────
            if (vis(kRE) >= MIN_VIS && vis(kRW) >= MIN_VIS && poseRig.RightHand) {
                rigRotation(getBone("rightHand"), poseRig.RightHand, 0.7, lerpFactor);
            }
            if (vis(kLE) >= MIN_VIS && vis(kLW) >= MIN_VIS && poseRig.LeftHand) {
                rigRotation(getBone("leftHand"), poseRig.LeftHand, 0.7, lerpFactor);
            }
        },

        dispose() {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", handleResize);

            renderer.domElement.removeEventListener("pointerdown", onPointerDown);
            renderer.domElement.removeEventListener("pointermove", onPointerMove);
            renderer.domElement.removeEventListener("pointerup", onPointerUp);
            renderer.domElement.removeEventListener("pointerleave", onPointerUp);
            renderer.domElement.removeEventListener("wheel", onWheel);

            renderer.dispose();
            if (renderer.domElement.parentElement === container) {
                container.removeChild(renderer.domElement);
            }
        },
    };

    return controller;
};