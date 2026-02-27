import * as THREE from "three";
// IMPORTANT: use GLTFLoader from the same package as VRMLoaderPlugin
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { Landmark } from "./utils";

export interface VrmController {
    updateFromLandmarks(landmarks: Landmark[]): void;
    dispose(): void;
}

/**
 * Initialize a Three.js scene with a VRM avatar.
 * - container: DOM element to attach the renderer canvas into.
 * - vrmUrl: path or URL to the .vrm file.
 */
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

    // cache some right-arm bones
    let rightShoulder: THREE.Object3D | null = null;
    let rightUpperArm: THREE.Object3D | null = null;
    let rightLowerArm: THREE.Object3D | null = null;
    let rightHandBone: THREE.Object3D | null = null;

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

                    // Debug: list humanoid bones we actually have
                    if (vrm.humanoid) {
                        console.log("VRM humanoid bones:");
                        for (const [name, node] of Object.entries(vrm.humanoid.humanBones)) {
                            console.log(name, "->", node?.node?.name);
                        }
                    } else {
                        console.log("No humanoid on VRM");
                    }

                    // Face the camera by default
                    vrm.scene.rotation.y = Math.PI;
                    scene.add(vrm.scene);

                    const humanoid = vrm.humanoid;

                    rightShoulder =
                        humanoid?.getBoneNode("rightShoulder") ??
                        vrm.scene.getObjectByName("J_Bip_R_Shoulder") ??
                        vrm.scene.getObjectByName("RightShoulder") ??
                        vrm.scene.getObjectByName("rightShoulder") ??
                        null;

                    rightUpperArm =
                        humanoid?.getBoneNode("rightUpperArm") ??
                        vrm.scene.getObjectByName("J_Bip_R_UpperArm") ??
                        vrm.scene.getObjectByName("RightUpperArm") ??
                        vrm.scene.getObjectByName("rightUpperArm") ??
                        null;

                    rightLowerArm =
                        humanoid?.getBoneNode("rightLowerArm") ??
                        vrm.scene.getObjectByName("J_Bip_R_LowerArm") ??
                        vrm.scene.getObjectByName("RightLowerArm") ??
                        vrm.scene.getObjectByName("rightLowerArm") ??
                        null;

                    rightHandBone =
                        humanoid?.getBoneNode("rightHand") ??
                        vrm.scene.getObjectByName("J_Bip_R_Hand") ??
                        vrm.scene.getObjectByName("RightHand") ??
                        vrm.scene.getObjectByName("rightHand") ??
                        null;

                    resolve();
                } catch (e) {
                    reject(e);
                }
            },
            undefined,
            (error) => reject(error)
        );
    });

    // --- Simple drag-to-rotate interaction on the whole model ---

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

        const yawSpeed = 0.005;
        const pitchSpeed = 0.005;

        vrm.scene.rotation.y += dx * yawSpeed;
        vrm.scene.rotation.x -= dy * pitchSpeed;
        vrm.scene.rotation.x = THREE.MathUtils.clamp(
            vrm.scene.rotation.x,
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
        // IMPORTANT: disable VRM internal pose update so our rotations are not overridden
        // If you later need blendshapes/lookAt, you can re-enable selectively.
        // if (vrm) {
        //     vrm.update(1 / 60);
        // }
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

    // --- Hand/arm tracking helpers ---

    const controller: VrmController = {
        updateFromLandmarks(landmarks: Landmark[]) {
            if (!vrm || !landmarks || landmarks.length === 0) return;

            // Ensure we have at least one arm bone to drive
            const anyArmBone = rightShoulder || rightUpperArm || rightLowerArm || rightHandBone;
            if (!anyArmBone) {
                console.warn("No right arm bones found on VRM.");
                return;
            }

            // MediaPipe hand: 0 = wrist, 8 = index_tip
            const wrist = landmarks[0];
            const indexTip = landmarks[8];

            // Simple 2D direction
            const dx = indexTip.x - wrist.x;        // left/right
            const dy = wrist.y - indexTip.y;        // up/down (invert so raising hand => positive)

            // Big rotations for now so movement is obvious
            const yaw = dx * Math.PI * 2;      // -360..360 deg
            const pitch = dy * Math.PI * 2;

            // Drive the chain: shoulder -> upperArm -> lowerArm -> hand
            if (rightShoulder) {
                rightShoulder.rotation.y = yaw * 0.3;
                rightShoulder.rotation.x = pitch * 0.2;
            }
            if (rightUpperArm) {
                rightUpperArm.rotation.y = yaw * 0.7;
                rightUpperArm.rotation.x = pitch * 0.7;
            }
            if (rightLowerArm) {
                rightLowerArm.rotation.y = yaw;
                rightLowerArm.rotation.x = pitch;
            }
            if (rightHandBone) {
                rightHandBone.rotation.y = yaw;
                rightHandBone.rotation.x = pitch;
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