import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as Kalidokit from "kalidokit";
import type { Landmark } from "./utils";

type KalidokitVector = { x: number; y: number; z: number; visibility?: number };

// ── Official Kalidokit rest values (doc.txt: RestingDefault.Pose) ─────────────
const POSE_REST = {
    rightUpperArm: { x: 0, y: 0, z: -1.25 },
    leftUpperArm: { x: 0, y: 0, z: 1.25 },
    rightLowerArm: { x: 0, y: 0, z: 0 },
    leftLowerArm: { x: 0, y: 0, z: 0 },
    rightHand: { x: 0, y: 0, z: 0 },
    leftHand: { x: 0, y: 0, z: 0 },
};

// ── Official Kalidokit finger rest values (doc.txt: RestingDefault.RightHand / LeftHand) ──
// Keys match VRM humanoid bone names exactly so they can be iterated directly.
const RIGHT_FINGER_REST: Record<string, { x: number; y: number; z: number }> = {
    rightHand: { x: -0.13, y: -0.07, z: -1.04 },
    rightIndexProximal: { x: 0, y: 0, z: -0.24 },
    rightIndexIntermediate: { x: 0, y: 0, z: -0.25 },
    rightIndexDistal: { x: 0, y: 0, z: -0.06 },
    rightMiddleProximal: { x: 0, y: 0, z: -0.09 },
    rightMiddleIntermediate: { x: 0, y: 0, z: -0.44 },
    rightMiddleDistal: { x: 0, y: 0, z: -0.06 },
    rightRingProximal: { x: 0, y: 0, z: -0.13 },
    rightRingIntermediate: { x: 0, y: 0, z: -0.40 },
    rightRingDistal: { x: 0, y: 0, z: -0.04 },
    rightLittleProximal: { x: 0, y: 0, z: -0.09 },
    rightLittleIntermediate: { x: 0, y: 0, z: -0.225 },
    rightLittleDistal: { x: 0, y: 0, z: -0.10 },
    rightThumbMetacarpal: { x: -0.23, y: -0.33, z: -0.12 },
    rightThumbProximal: { x: -0.2, y: -0.199, z: -0.014 },
    rightThumbDistal: { x: -0.2, y: 0.002, z: 0.15 },
};

const LEFT_FINGER_REST: Record<string, { x: number; y: number; z: number }> = {
    leftHand: { x: -0.13, y: -0.07, z: -1.04 },
    leftIndexProximal: { x: 0, y: 0, z: 0.24 },
    leftIndexIntermediate: { x: 0, y: 0, z: 0.25 },
    leftIndexDistal: { x: 0, y: 0, z: 0.06 },
    leftMiddleProximal: { x: 0, y: 0, z: 0.09 },
    leftMiddleIntermediate: { x: 0, y: 0, z: 0.44 },
    leftMiddleDistal: { x: 0, y: 0, z: 0.066 },
    leftRingProximal: { x: 0, y: 0, z: 0.13 },
    leftRingIntermediate: { x: 0, y: 0, z: 0.40 },
    leftRingDistal: { x: 0, y: 0, z: 0.049 },
    leftLittleProximal: { x: 0, y: 0, z: 0.17 },
    leftLittleIntermediate: { x: 0, y: 0, z: 0.40 },
    leftLittleDistal: { x: 0, y: 0, z: 0.10 },
    leftThumbMetacarpal: { x: -0.23, y: 0.33, z: 0.12 },
    leftThumbProximal: { x: -0.2, y: 0.25, z: 0.05 },
    leftThumbDistal: { x: -0.2, y: 0.17, z: -0.06 },
};
// ─────────────────────────────────────────────────────────────────────────────

export interface VrmController {
    updateFromLandmarks(landmarks: Landmark[], handedness: "Left" | "Right"): void;
    updateFromPose?(poseLandmarks: Landmark[], worldLandmarks?: Landmark[]): void;
    resetFingers?(side?: "Left" | "Right"): void;
    dispose(): void;
}

const rigRotation = (
    bone: THREE.Object3D | null,
    rotation: { x: number; y: number; z: number },
    dampener = 1,
    lerpFactor = 0.3
) => {
    if (!bone) return;
    const euler = new THREE.Euler(
        rotation.x * dampener,
        rotation.y * dampener,
        rotation.z * dampener,
        "XYZ"
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    bone.quaternion.slerp(quaternion, lerpFactor);
};

export const initVrmScene = async (
    container: HTMLElement,
    vrmUrl: string
): Promise<VrmController> => {
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

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let vrm: VRM | null = null;

    await new Promise<void>((resolve, reject) => {
        loader.load(
            vrmUrl,
            (gltf) => {
                try {
                    const loadedVrm = gltf.userData.vrm as VRM | undefined;
                    if (!loadedVrm) throw new Error("No VRM instance found in gltf.userData.vrm");
                    vrm = loadedVrm;
                    vrm.scene.rotation.y = Math.PI;
                    scene.add(vrm.scene);
                    resolve();
                } catch (e) { reject(e); }
            },
            undefined,
            (error) => reject(error)
        );
    });

    const getBone = (name: VRMHumanBoneName): THREE.Object3D | null =>
        vrm?.humanoid?.getNormalizedBoneNode(name) ?? null;

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

    const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const scale = ev.ctrlKey ? 0.05 : 0.005;
        camera.position.z = THREE.MathUtils.clamp(
            camera.position.z + ev.deltaY * scale,
            0.8,
            5.0
        );
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const clock = new THREE.Clock();
    let animationFrameId: number;
    const renderLoop = () => {
        const delta = clock.getDelta();

        // Required by @pixiv/three-vrm v3.x — updates spring bones + internal VRM state
        if (vrm) vrm.update(delta);
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

    const lerpFactor = 0.4;
    const REST_LERP = lerpFactor * 0.25; // slow glide back to rest

    const controller: VrmController = {
        updateFromLandmarks(landmarks: Landmark[], handedness: "Left" | "Right") {
            if (!vrm || !landmarks || landmarks.length === 0) return;

            const side = handedness === "Left" ? "left" : "right";
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
            const pose3D: KalidokitVector[] = src3D.map(lm => ({ x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 }));
            const pose2D: KalidokitVector[] = poseLandmarks.map(lm => ({ x: lm.x, y: lm.y, z: 0, visibility: lm.visibility ?? 1 }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poseRig = Kalidokit.Pose.solve(pose3D as any, pose2D as any);
            if (!poseRig) return;

            if (poseRig.Spine) rigRotation(getBone("spine"), poseRig.Spine, 0.5, lerpFactor);

            // ── Kalidokit convention: Right* keys ← MediaPipe LEFT landmarks, Left* ← RIGHT ──
            const MIN_VIS = 0.5;
            const vis = (lm: Landmark) => lm.visibility ?? 1;

            const kRS = poseLandmarks[11]; const kRE = poseLandmarks[13]; const kRW = poseLandmarks[15];
            const kLS = poseLandmarks[12]; const kLE = poseLandmarks[14]; const kLW = poseLandmarks[16];

            // RIGHT ARM
            if (vis(kRS) >= MIN_VIS && vis(kRE) >= MIN_VIS && poseRig.RightUpperArm) {
                rigRotation(getBone("rightUpperArm"), poseRig.RightUpperArm, 1, lerpFactor);
            } else { rigRotation(getBone("rightUpperArm"), POSE_REST.rightUpperArm, 1, REST_LERP); }

            if (vis(kRE) >= MIN_VIS && vis(kRW) >= MIN_VIS && poseRig.RightLowerArm) {
                rigRotation(getBone("rightLowerArm"), poseRig.RightLowerArm, 1, lerpFactor);
            } else { rigRotation(getBone("rightLowerArm"), POSE_REST.rightLowerArm, 1, REST_LERP); }

            // LEFT ARM
            if (vis(kLS) >= MIN_VIS && vis(kLE) >= MIN_VIS && poseRig.LeftUpperArm) {
                rigRotation(getBone("leftUpperArm"), poseRig.LeftUpperArm, 1, lerpFactor);
            } else { rigRotation(getBone("leftUpperArm"), POSE_REST.leftUpperArm, 1, REST_LERP); }

            if (vis(kLE) >= MIN_VIS && vis(kLW) >= MIN_VIS && poseRig.LeftLowerArm) {
                rigRotation(getBone("leftLowerArm"), poseRig.LeftLowerArm, 1, lerpFactor);
            } else { rigRotation(getBone("leftLowerArm"), POSE_REST.leftLowerArm, 1, REST_LERP); }

            // WRIST from pose (doc.txt: calcArms Hand.r/l) — fallback when hand landmarks absent
            if (vis(kRE) >= MIN_VIS && vis(kRW) >= MIN_VIS && poseRig.RightHand) {
                rigRotation(getBone("rightHand"), poseRig.RightHand, 0.7, lerpFactor);
            } else { rigRotation(getBone("rightHand"), POSE_REST.rightHand, 1, REST_LERP); }

            if (vis(kLE) >= MIN_VIS && vis(kLW) >= MIN_VIS && poseRig.LeftHand) {
                rigRotation(getBone("leftHand"), poseRig.LeftHand, 0.7, lerpFactor);
            } else { rigRotation(getBone("leftHand"), POSE_REST.leftHand, 1, REST_LERP); }
        },

        resetFingers(side?: "Left" | "Right") {
            if (!vrm) return;
            const doRight = !side || side === "Right";
            const doLeft = !side || side === "Left";
            if (doRight) {
                Object.entries(RIGHT_FINGER_REST).forEach(([bone, rot]) => {
                    rigRotation(getBone(bone as VRMHumanBoneName), rot, 1, REST_LERP);
                });
            }
            if (doLeft) {
                Object.entries(LEFT_FINGER_REST).forEach(([bone, rot]) => {
                    rigRotation(getBone(bone as VRMHumanBoneName), rot, 1, REST_LERP);
                });
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