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

            // --- SPINE (Kalidokit spine reads shoulders/hips — no arm joints involved) ---
            const pose3D: KalidokitVector[] = poseLandmarks.map(lm => ({
                x: lm.x, y: lm.y, z: lm.z, visibility: 1
            }));
            const pose2D: KalidokitVector[] = poseLandmarks.map(lm => ({
                x: lm.x, y: lm.y, z: 0, visibility: 1
            }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poseRig = Kalidokit.Pose.solve(pose3D as any, pose2D as any);
            if (poseRig?.Spine) {
                rigRotation(getBone("spine"), poseRig.Spine, 0.5, lerpFactor);
            }

            // ─────────────────────────────────────────────────────────────────
            // ISOLATED ARM SOLVERS
            // Each function receives only its own 3 landmarks.
            // No shared state, no shared computation — one side cannot bleed
            // into the other at any point in the call chain.
            // ─────────────────────────────────────────────────────────────────

            /**
             * Derives upper arm Euler angles from the shoulder→elbow direction.
             * Returns null when the landmark distance is degenerate (occluded / collapsed).
             */
            const solveUpperArm = (
                shoulder: Landmark,
                elbow: Landmark,
                side: "left" | "right"
            ): { x: number; y: number; z: number } | null => {
                const dx = elbow.x - shoulder.x;
                const dy = elbow.y - shoulder.y; // MediaPipe: +y points DOWN
                const dz = elbow.z - shoulder.z;
                if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.001) return null;

                // Elevation: how high the elbow is above the shoulder plane.
                // dy < 0 means elbow is above shoulder → arm is raised.
                const elevation = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz));

                // Forward/back swing: how much the arm points toward the camera.
                const forwardSwing = Math.atan2(-dz, Math.abs(dx));

                return {
                    x: forwardSwing * 0.5,
                    y: 0,
                    // VRM right bone is oriented as a mirror of left →
                    // negate Z so that raising either arm applies the
                    // correct rotation direction for that bone.
                    z: side === "right" ? -elevation : elevation,
                };
            };

            /**
             * Derives lower arm (elbow) bend from the upper↔lower arm angle.
             * Applied on the Z axis (flex/extend), not Y (which is forearm twist).
             */
            const solveLowerArm = (
                shoulder: Landmark,
                elbow: Landmark,
                wrist: Landmark,
                side: "left" | "right"
            ): { x: number; y: number; z: number } => {
                const upper = new THREE.Vector3(
                    elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z
                ).normalize();
                const lower = new THREE.Vector3(
                    wrist.x - elbow.x, wrist.y - elbow.y, wrist.z - elbow.z
                ).normalize();
                const angle = Math.acos(clamp(upper.dot(lower), -1, 1));
                // Sign mirrors between sides to match each bone's local Z orientation
                return { x: 0, y: 0, z: side === "right" ? angle : -angle };
            };

            // --- RIGHT ARM — reads landmark indices 12, 14, 16 ONLY ---
            const rS = poseLandmarks[12]; // RIGHT_SHOULDER
            const rE = poseLandmarks[14]; // RIGHT_ELBOW
            const rW = poseLandmarks[16]; // RIGHT_WRIST
            const rightUpperRot = solveUpperArm(rS, rE, "right");
            if (rightUpperRot) rigRotation(getBone("rightUpperArm"), rightUpperRot, 1, lerpFactor);
            rigRotation(getBone("rightLowerArm"), solveLowerArm(rS, rE, rW, "right"), 1, lerpFactor);

            // --- LEFT ARM — reads landmark indices 11, 13, 15 ONLY ---
            const lS = poseLandmarks[11]; // LEFT_SHOULDER
            const lE = poseLandmarks[13]; // LEFT_ELBOW
            const lW = poseLandmarks[15]; // LEFT_WRIST
            const leftUpperRot = solveUpperArm(lS, lE, "left");
            if (leftUpperRot) rigRotation(getBone("leftUpperArm"), leftUpperRot, 1, lerpFactor);
            rigRotation(getBone("leftLowerArm"), solveLowerArm(lS, lE, lW, "left"), 1, lerpFactor);
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