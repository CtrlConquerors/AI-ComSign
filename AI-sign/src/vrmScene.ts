import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as Kalidokit from "kalidokit";
import type { Landmark } from "./utils";

// Define the type Kalidokit expects
type KalidokitVector = { x: number; y: number; z: number; visibility?: number };

export interface VrmController {
    updateFromLandmarks(landmarks: Landmark[], handedness: "Left" | "Right"): void;
    updateFromPose?(poseLandmarks: Landmark[]): void;
    dispose(): void;
}

// Helper to clamp rotation values
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

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

            const side = handedness === "Right" ? "left" : "right";
            const wristBone = getBone(`${side}Hand` as VRMHumanBoneName);

            if (!wristBone) return;

            const wrist = landmarks[0];
            const middleMcp = landmarks[9];

            const dx = middleMcp.x - wrist.x;
            const dy = middleMcp.y - wrist.y;
            const dz = middleMcp.z - wrist.z;

            const yaw = Math.atan2(dx, -dz) * (side === "left" ? -1 : 1);
            const pitch = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz));

            wristBone.rotation.x = THREE.MathUtils.lerp(wristBone.rotation.x, pitch * 0.8, lerpFactor);
            wristBone.rotation.y = THREE.MathUtils.lerp(wristBone.rotation.y, yaw * 0.8, lerpFactor);
        },

        updateFromPose(poseLandmarks: Landmark[]) {
            if (!vrm || !poseLandmarks || poseLandmarks.length < 33) return;

            // MediaPipe pose indices
            const LEFT_SHOULDER = 11;
            const RIGHT_SHOULDER = 12;
            const LEFT_ELBOW = 13;
            const RIGHT_ELBOW = 14;
            const LEFT_WRIST = 15;
            const RIGHT_WRIST = 16;

            const pose3D: KalidokitVector[] = poseLandmarks.map(lm => ({
                x: lm.x, y: lm.y, z: lm.z, visibility: 1
            }));
            const pose2D: KalidokitVector[] = poseLandmarks.map(lm => ({
                x: lm.x, y: lm.y, z: 0, visibility: 1
            }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poseRig = Kalidokit.Pose.solve(pose3D as any, pose2D as any);
            if (!poseRig) return;

            // --- SPINE ---
            rigRotation(getBone("spine"), poseRig.Spine, 0.5, lerpFactor);

            // --- RIGHT ARM ---
            const rightUpperArm = getBone("rightUpperArm");
            const rightLowerArm = getBone("rightLowerArm");

            if (rightUpperArm && poseRig.RightUpperArm) {
                // FIX 1: Negate Z — VRM right arm bone faces the opposite direction to left,
                // so the same world-space raise requires an inverted Z sign.
                rigRotation(
                    rightUpperArm,
                    { x: poseRig.RightUpperArm.x, y: poseRig.RightUpperArm.y, z: -poseRig.RightUpperArm.z },
                    1,
                    lerpFactor
                );
            }

            if (rightLowerArm) {
                if (poseRig.RightLowerArm) {
                    // Use Kalidokit's own elbow values — they're calibrated to pair with the upper arm
                    rigRotation(rightLowerArm, poseRig.RightLowerArm, 1, lerpFactor);
                } else {
                    // Fallback: manual angle — FIX 2: use rotation.z, not .y (Y = twist, Z = flex)
                    const upper = new THREE.Vector3(
                        poseLandmarks[RIGHT_ELBOW].x - poseLandmarks[RIGHT_SHOULDER].x,
                        poseLandmarks[RIGHT_ELBOW].y - poseLandmarks[RIGHT_SHOULDER].y,
                        poseLandmarks[RIGHT_ELBOW].z - poseLandmarks[RIGHT_SHOULDER].z
                    ).normalize();
                    const lower = new THREE.Vector3(
                        poseLandmarks[RIGHT_WRIST].x - poseLandmarks[RIGHT_ELBOW].x,
                        poseLandmarks[RIGHT_WRIST].y - poseLandmarks[RIGHT_ELBOW].y,
                        poseLandmarks[RIGHT_WRIST].z - poseLandmarks[RIGHT_ELBOW].z
                    ).normalize();
                    const angle = Math.acos(clamp(upper.dot(lower), -1, 1));
                    rightLowerArm.rotation.z = THREE.MathUtils.lerp(rightLowerArm.rotation.z, angle, lerpFactor);
                }
            }

            // --- LEFT ARM ---
            const leftUpperArm = getBone("leftUpperArm");
            const leftLowerArm = getBone("leftLowerArm");

            if (leftUpperArm && poseRig.LeftUpperArm) {
                // Left arm bone orientation is standard — apply directly
                rigRotation(leftUpperArm, poseRig.LeftUpperArm, 1, lerpFactor);
            }

            if (leftLowerArm) {
                if (poseRig.LeftLowerArm) {
                    rigRotation(leftLowerArm, poseRig.LeftLowerArm, 1, lerpFactor);
                } else {
                    // Fallback: manual angle on Z axis
                    const upper = new THREE.Vector3(
                        poseLandmarks[LEFT_ELBOW].x - poseLandmarks[LEFT_SHOULDER].x,
                        poseLandmarks[LEFT_ELBOW].y - poseLandmarks[LEFT_SHOULDER].y,
                        poseLandmarks[LEFT_ELBOW].z - poseLandmarks[LEFT_SHOULDER].z
                    ).normalize();
                    const lower = new THREE.Vector3(
                        poseLandmarks[LEFT_WRIST].x - poseLandmarks[LEFT_ELBOW].x,
                        poseLandmarks[LEFT_WRIST].y - poseLandmarks[LEFT_ELBOW].y,
                        poseLandmarks[LEFT_WRIST].z - poseLandmarks[LEFT_ELBOW].z
                    ).normalize();
                    const angle = Math.acos(clamp(upper.dot(lower), -1, 1));
                    leftLowerArm.rotation.z = THREE.MathUtils.lerp(leftLowerArm.rotation.z, -angle, lerpFactor);
                }
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