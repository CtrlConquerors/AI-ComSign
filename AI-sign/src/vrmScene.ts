import * as THREE from "three";
// IMPORTANT: use GLTFLoader from the same package as VRMLoaderPlugin
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { Landmark } from "./utils";

export interface VrmController {
    updateFromLandmarks(landmarks: Landmark[]): void;
    updateFromPose?(poseLandmarks: Landmark[]): void;
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

    // cache some left-arm bones
    let leftShoulder: THREE.Object3D | null = null;
    let leftUpperArm: THREE.Object3D | null = null;
    let leftLowerArm: THREE.Object3D | null = null;

    // torso chain
    let hips: THREE.Object3D | null = null;
    let spine: THREE.Object3D | null = null;
    let chest: THREE.Object3D | null = null;
    let upperChest: THREE.Object3D | null = null;
    let neck: THREE.Object3D | null = null;

    // Simple smoothing so the avatar body does not jitter too much
    const POSE_SMOOTHING = 0.25;

    let rightYawSmoothed = 0;
    let rightPitchSmoothed = 0;
    let rightElbowSmoothed = 0;

    let leftYawSmoothed = 0;
    let leftPitchSmoothed = 0;
    let leftElbowSmoothed = 0;

    // torso smoothing
    let torsoTwistSmoothed = 0;
    let torsoBendSmoothed = 0;

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

                    // Lightweight interface for both VRM0 and VRM1 humanoid APIs
                    type HumanoidApi = {
                        getRawBoneNode?: (boneName: string) => THREE.Object3D | null;
                        getBoneNode?: (boneName: string) => THREE.Object3D | null;
                    };

                    const humanoidApi: HumanoidApi | null =
                        (humanoid as unknown as HumanoidApi | null) ?? null;

                    // Helper that prefers the new VRM 1.0 API but still falls back to scene lookup
                    const getBone = (boneName: string, ...fallbackNames: string[]) => {
                        const fromHumanoid =
                            // getRawBoneNode is recommended over getBoneNode (deprecated)
                            humanoidApi?.getRawBoneNode?.(boneName) ??
                            humanoidApi?.getBoneNode?.(boneName);

                        if (fromHumanoid) return fromHumanoid;

                        for (const n of fallbackNames) {
                            const found = vrm!.scene.getObjectByName(n);
                            if (found) return found;
                        }
                        return null;
                    };

                    // TORSO BONES
                    hips = getBone("hips", "J_Bip_C_Hips");
                    spine = getBone("spine", "J_Bip_C_Spine");
                    chest = getBone("chest", "J_Bip_C_Chest");
                    upperChest = getBone("upperChest", "J_Bip_C_UpperChest");
                    neck = getBone("neck", "J_Bip_C_Neck");

                    // RIGHT ARM BONES
                    rightShoulder = getBone(
                        "rightShoulder",
                        "J_Bip_R_Shoulder",
                        "RightShoulder",
                        "rightShoulder"
                    );

                    rightUpperArm = getBone(
                        "rightUpperArm",
                        "J_Bip_R_UpperArm",
                        "RightUpperArm",
                        "rightUpperArm"
                    );

                    rightLowerArm = getBone(
                        "rightLowerArm",
                        "J_Bip_R_LowerArm",
                        "RightLowerArm",
                        "rightLowerArm"
                    );

                    rightHandBone = getBone(
                        "rightHand",
                        "J_Bip_R_Hand",
                        "RightHand",
                        "rightHand"
                    );

                    // LEFT ARM BONES
                    leftShoulder = getBone(
                        "leftShoulder",
                        "J_Bip_L_Shoulder",
                        "LeftShoulder",
                        "leftShoulder"
                    );

                    leftUpperArm = getBone(
                        "leftUpperArm",
                        "J_Bip_L_UpperArm",
                        "LeftUpperArm",
                        "leftUpperArm"
                    );

                    leftLowerArm = getBone(
                        "leftLowerArm",
                        "J_Bip_L_LowerArm",
                        "LeftLowerArm",
                        "leftLowerArm"
                    );

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

    // --- Hand/arm + body tracking helpers ---

    const controller: VrmController = {
        // Hand tracking -> right hand rotation (wrist + a bit of forearm twist)
        updateFromLandmarks(landmarks: Landmark[]) {
            if (!vrm || !landmarks || landmarks.length === 0) return;

            // MediaPipe hand: 0 = wrist, 5 = index_mcp, 17 = pinky_mcp
            const wrist = landmarks[0];
            const indexMcp = landmarks[5];
            const pinkyMcp = landmarks[17];

            const dx = indexMcp.x - wrist.x;
            const dy = wrist.y - indexMcp.y;

            const yaw = dx * Math.PI * 2;
            const pitch = dy * Math.PI * 2;

            if (rightHandBone) {
                rightHandBone.rotation.y = yaw * 0.8;
                rightHandBone.rotation.x = pitch * 0.8;
            }

            // cheap roll from wrist–pinky direction (gives third DOF at wrist)
            if (rightLowerArm && pinkyMcp) {
                const roll = (pinkyMcp.y - indexMcp.y) * Math.PI * 1.2;
                rightLowerArm.rotation.z = THREE.MathUtils.clamp(roll, -Math.PI / 2, Math.PI / 2);
            }
        },

        // Pose tracking -> arms + lightweight torso motion
        updateFromPose(pose: Landmark[]) {
            if (!vrm || !pose || pose.length < 29) return;

            const maxYaw = THREE.MathUtils.degToRad(110);
            const maxPitchUp = THREE.MathUtils.degToRad(110);
            const maxPitchDown = THREE.MathUtils.degToRad(70);

            // -----------------------
            // RIGHT ARM (indices 12, 14, 16)
            // -----------------------
            const shoulderR = pose[12];
            const elbowR = pose[14];
            const wristR = pose[16];

            if (rightShoulder && rightUpperArm && rightLowerArm && shoulderR && elbowR && wristR) {
                const upper = new THREE.Vector3(
                    elbowR.x - shoulderR.x,
                    elbowR.y - shoulderR.y,
                    elbowR.z - shoulderR.z
                );
                const lower = new THREE.Vector3(
                    wristR.x - elbowR.x,
                    wristR.y - elbowR.y,
                    wristR.z - elbowR.z
                );

                upper.normalize();
                lower.normalize();

                // MediaPipe: x right, y down, z negative toward camera.
                // Treat -z as "forward" in avatar space.
                const yaw = Math.atan2(upper.x, -upper.z); // left/right sweep
                const pitch = Math.atan2(
                    -upper.y,                                      // invert because y is down
                    Math.sqrt(upper.x * upper.x + upper.z * upper.z)
                ); // up/down

                const dot = THREE.MathUtils.clamp(upper.dot(lower), -1, 1);
                const elbowAngle = Math.PI - Math.acos(dot); // 0 = straight

                rightYawSmoothed = THREE.MathUtils.lerp(rightYawSmoothed, yaw, POSE_SMOOTHING);
                rightPitchSmoothed = THREE.MathUtils.lerp(rightPitchSmoothed, pitch, POSE_SMOOTHING);
                rightElbowSmoothed = THREE.MathUtils.lerp(rightElbowSmoothed, elbowAngle, POSE_SMOOTHING);

                const clampedYaw = THREE.MathUtils.clamp(rightYawSmoothed, -maxYaw, maxYaw);
                const clampedPitch = THREE.MathUtils.clamp(
                    rightPitchSmoothed,
                    -maxPitchDown,
                    maxPitchUp
                );
                const clampedElbow = THREE.MathUtils.clamp(
                    rightElbowSmoothed,
                    0,
                    Math.PI * 0.95
                );

                // Shoulder: small correction, most motion on upper arm
                rightShoulder.rotation.y = clampedYaw * 0.25;
                rightShoulder.rotation.x = clampedPitch * 0.2;

                rightUpperArm.rotation.y = clampedYaw;       // main yaw
                rightUpperArm.rotation.x = clampedPitch;     // main pitch

                rightLowerArm.rotation.x = clampedElbow;     // pure bend
            }

            // -----------------------
            // LEFT ARM (indices 11, 13, 15)
            // -----------------------
            const shoulderL = pose[11];
            const elbowL = pose[13];
            const wristL = pose[15];

            if (leftShoulder && leftUpperArm && leftLowerArm && shoulderL && elbowL && wristL) {
                const upperL = new THREE.Vector3(
                    elbowL.x - shoulderL.x,
                    elbowL.y - shoulderL.y,
                    elbowL.z - shoulderL.z
                );
                const lowerL = new THREE.Vector3(
                    wristL.x - elbowL.x,
                    wristL.y - elbowL.y,
                    wristL.z - elbowL.z
                );

                upperL.normalize();
                lowerL.normalize();

                // Mirror yaw for left side (MediaPipe x right, avatar faces camera)
                const yawL = Math.atan2(-upperL.x, -upperL.z);
                const pitchL = Math.atan2(
                    -upperL.y,
                    Math.sqrt(upperL.x * upperL.x + upperL.z * upperL.z)
                );

                const dotL = THREE.MathUtils.clamp(upperL.dot(lowerL), -1, 1);
                const elbowAngleL = Math.PI - Math.acos(dotL);

                leftYawSmoothed = THREE.MathUtils.lerp(leftYawSmoothed, yawL, POSE_SMOOTHING);
                leftPitchSmoothed = THREE.MathUtils.lerp(leftPitchSmoothed, pitchL, POSE_SMOOTHING);
                leftElbowSmoothed = THREE.MathUtils.lerp(leftElbowSmoothed, elbowAngleL, POSE_SMOOTHING);

                const clampedYawL = THREE.MathUtils.clamp(leftYawSmoothed, -maxYaw, maxYaw);
                const clampedPitchL = THREE.MathUtils.clamp(
                    leftPitchSmoothed,
                    -maxPitchDown,
                    maxPitchUp
                );
                const clampedElbowL = THREE.MathUtils.clamp(
                    leftElbowSmoothed,
                    0,
                    Math.PI * 0.95
                );

                leftShoulder.rotation.y = clampedYawL * 0.25;
                leftShoulder.rotation.x = clampedPitchL * 0.2;

                leftUpperArm.rotation.y = clampedYawL;
                leftUpperArm.rotation.x = clampedPitchL;

                leftLowerArm.rotation.x = clampedElbowL;
            }

            // -----------------------
            // TORSO (approximate like Kalidoface body line)
            // -----------------------
            if (chest || upperChest || spine || hips) {
                const avgYaw = (rightYawSmoothed - leftYawSmoothed) * 0.5;
                const avgPitch = (rightPitchSmoothed + leftPitchSmoothed) * 0.5;

                const targetTwist = THREE.MathUtils.clamp(avgYaw * 0.3, -Math.PI / 6, Math.PI / 6);
                const targetBend = THREE.MathUtils.clamp(avgPitch * 0.2, -Math.PI / 10, Math.PI / 6);

                torsoTwistSmoothed = THREE.MathUtils.lerp(
                    torsoTwistSmoothed,
                    targetTwist,
                    POSE_SMOOTHING
                );
                torsoBendSmoothed = THREE.MathUtils.lerp(
                    torsoBendSmoothed,
                    targetBend,
                    POSE_SMOOTHING
                );

                const twistHips = torsoTwistSmoothed * 0.25;
                const twistSpine = torsoTwistSmoothed * 0.35;
                const twistChest = torsoTwistSmoothed * 0.4;

                const bendSpine = torsoBendSmoothed * 0.4;
                const bendChest = torsoBendSmoothed * 0.6;

                if (hips) {
                    hips.rotation.y = twistHips;
                }
                if (spine) {
                    spine.rotation.y = twistSpine;
                    spine.rotation.x = bendSpine;
                }
                if (chest) {
                    chest.rotation.y = twistChest;
                    chest.rotation.x = bendChest;
                }
                if (upperChest || neck) {
                    const node = upperChest ?? neck!;
                    node.rotation.x = bendChest * 0.4;
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