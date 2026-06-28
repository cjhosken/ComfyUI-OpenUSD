import * as THREE from "https://esm.sh/three";
import core from "../lib/core/index.js";
import { USDLoader } from "../lib/three-loader/openusd_three_loader.js";

export class USDViewport {
    constructor(container, options = {}) {
        this.container = container;
        this.width = options.width || 400;
        this.height = options.height || 260;
        this.onPrimSelected = options.onPrimSelected || null;

        // State
        this.currentModel = null;
        this.currentUsdCameras = [];
        this.shadingMode = "solid";
        this.isPlaying = false;
        this.startFrame = 0;
        this.endFrame = 0;
        this.currentFrame = 0;
        this.fps = 24;
        this.mixer = null;
        this.clock = new THREE.Clock();

        // Controls state
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };

        // USD Loader with texture resolver
        this.loader = new USDLoader({
            pxrCore: core,
            textureResolver: (asset, context) => {
                if (!asset.path) return null;
                try {
                    const parentUrl = new URL(context.sourcePath, window.location.origin);
                    const parentFile = parentUrl.searchParams.get('filename');

                    if (parentFile) {
                        if (parentFile.toLowerCase().endsWith('.usdz')) {
                            return null;
                        }
                        const baseDir = parentFile.substring(0, parentFile.lastIndexOf('/')) + '/';
                        const targetFilePath = asset.path.startsWith('/') ? asset.path : baseDir + asset.path;
                        return `/usd/view?filename=${encodeURIComponent(targetFilePath)}`;
                    }
                } catch (e) {
                    console.error("[USD Texture Resolver Error]", e);
                }
                return null;
            },
        });

        this.initScene();
        this.initControls();
        this.initUI();
    }

    initScene() {
        try {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
            this.camera.position.set(0, 0, 5);

            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(this.width, this.height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.domElement.style.pointerEvents = "auto";
            this.renderer.domElement.style.touchAction = "none";
            this.container.appendChild(this.renderer.domElement);

            // Lighting
            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(10, 10, 10);
            this.scene.add(dirLight);

            // Resize observer
            this.resizeObserver = new ResizeObserver(() => {
                this.resize();
            });
            this.resizeObserver.observe(this.container);

            this.startAnimationLoop();
        } catch (err) {
            console.error("[USD] WebGL initialization failed:", err);
            this.showError("WebGL context creation failed");
        }
    }

    initControls() {
        const canvas = this.renderer.domElement;

        const onPointerDown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
            canvas.focus();
        };

        const onPointerMove = (e) => {
            if (!this.isDragging) return;
            e.stopPropagation();
            e.preventDefault();

            const deltaMove = {
                x: e.clientX - this.previousMousePosition.x,
                y: e.clientY - this.previousMousePosition.y
            };

            if (e.buttons === 4 || (e.buttons === 1 && e.shiftKey)) {
                const factor = this.camera.position.length() * 0.0025;
                this.camera.translateX(-deltaMove.x * factor);
                this.camera.translateY(deltaMove.y * factor);
            } else if (e.buttons === 2 || (e.buttons === 1 && (e.ctrlKey || e.altKey))) {
                const factor = this.camera.position.length() * 0.005;
                this.camera.translateZ(deltaMove.y * factor);
            } else if (e.buttons === 1) {
                if (this.currentModel) {
                    this.currentModel.rotation.y += deltaMove.x * 0.01;
                    this.currentModel.rotation.x += deltaMove.y * 0.01;
                }
            }

            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        };

        const onPointerUp = (e) => {
            e.stopPropagation();
            this.isDragging = false;
        };

        const onWheel = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const factor = this.camera.position.length() * 0.05;
            this.camera.translateZ((e.deltaY > 0 ? 1 : -1) * factor);
        };

        const onContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', onContextMenu);
    }

    initUI() {
        this.createControlsOverlay();
        this.createShadingOverlay();
        this.createCameraOverlay();
    }

    createControlsOverlay() {
        this.controlOverlay = document.createElement("div");
        this.controlOverlay.className = "comfy-usd-timeline";
        this.controlOverlay.style.cssText = "position: absolute; bottom: 8px; left: 8px; right: 8px; display: none; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 11px; z-index: 100; pointer-events: auto; backdrop-filter: blur(4px);";

        this.playBtn = document.createElement("button");
        this.playBtn.className = "comfy-usd-btn";
        this.playBtn.textContent = "Play";
        this.playBtn.style.cssText = "outline: none;";
        this.playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayback();
        });

        this.slider = document.createElement("input");
        this.slider.type = "range";
        this.slider.className = "comfy-usd-slider";
        this.slider.style.cssText = "flex: 1; height: 4px; background: #3f3f46; border-radius: 2px; outline: none; cursor: pointer;";
        this.slider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.currentFrame = parseFloat(this.slider.value);
            this.frameLabel.textContent = `Frame: ${Math.round(this.currentFrame)}`;
            if (this.mixer) {
                this.mixer.setTime(this.currentFrame / this.fps);
            }
        });

        this.frameLabel = document.createElement("span");
        this.frameLabel.textContent = "Frame: 0";
        this.frameLabel.style.cssText = "color: #e4e4e7; min-width: 80px; text-align: right; font-family: monospace;";

        this.controlOverlay.appendChild(this.playBtn);
        this.controlOverlay.appendChild(this.slider);
        this.controlOverlay.appendChild(this.frameLabel);
        this.container.appendChild(this.controlOverlay);
    }

    createShadingOverlay() {
        const shadingOverlay = document.createElement("div");
        shadingOverlay.style.cssText = "position: absolute; top: 8px; right: 8px; z-index: 100; pointer-events: auto;";

        this.shadingSelect = document.createElement("select");
        this.shadingSelect.className = "comfy-usd-select";
        this.shadingSelect.style.cssText = "outline: none; cursor: pointer; backdrop-filter: blur(4px);";

        const shadingOptions = ["Rendered", "Clay", "Wireframe"];
        shadingOptions.forEach(opt => {
            const el = document.createElement("option");
            el.value = opt.toLowerCase();
            el.textContent = opt;
            this.shadingSelect.appendChild(el);
        });

        this.shadingSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            this.applyShading(this.shadingSelect.value);
        });

        shadingOverlay.appendChild(this.shadingSelect);
        this.container.appendChild(shadingOverlay);
    }

    createCameraOverlay() {
        const cameraOverlay = document.createElement("div");
        cameraOverlay.style.cssText = "position: absolute; top: 8px; left: 8px; z-index: 100; pointer-events: auto;";

        this.cameraSelect = document.createElement("select");
        this.cameraSelect.className = "comfy-usd-select";
        this.cameraSelect.style.cssText = "outline: none; cursor: pointer; backdrop-filter: blur(4px);";

        const defaultCameraOpt = document.createElement("option");
        defaultCameraOpt.value = "persp";
        defaultCameraOpt.textContent = "Camera: Perspective";
        this.cameraSelect.appendChild(defaultCameraOpt);

        this.cameraSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            this.switchCamera(this.cameraSelect.value);
        });

        cameraOverlay.appendChild(this.cameraSelect);
        this.container.appendChild(cameraOverlay);
    }

    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        this.playBtn.textContent = this.isPlaying ? "Pause" : "Play";
        this.playBtn.style.background = this.isPlaying ? "#f43f5e" : "#22252a";
        this.playBtn.style.color = this.isPlaying ? "#ffffff" : "#a1a1aa";
    }

    applyShading(mode) {
        if (!this.currentModel) return;
        this.shadingMode = mode;

        this.currentModel.traverse((child) => {
            if (!child.isMesh) return;

            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }

            // Store original geometry for quad wireframe extraction
            if (!child.userData.originalGeometry) {
                child.userData.originalGeometry = child.geometry.clone();
            }

            if (mode === "wireframe") {
                if (child.isSkinnedMesh) {
                    if (!child.userData.wireframeSkin) {
                        // Create quad wireframe geometry
                        const wireframeGeom = this.createQuadWireframeGeometry(child.geometry);
                        const wfMat = new THREE.MeshBasicMaterial({
                            color: 0x888888,
                            wireframe: true,
                            transparent: true,
                            opacity: 0.8,
                            depthTest: true,
                        });
                        const wfMesh = new THREE.SkinnedMesh(wireframeGeom, wfMat);
                        wfMesh.skeleton = child.skeleton;
                        wfMesh.bindMatrix.copy(child.bindMatrix);
                        wfMesh.bindMatrixInverse.copy(child.bindMatrixInverse);
                        wfMesh.bindMode = child.bindMode;
                        wfMesh.morphTargetInfluences = child.morphTargetInfluences;
                        wfMesh.morphTargetDictionary = child.morphTargetDictionary;
                        wfMesh.renderOrder = child.renderOrder + 1;
                        wfMesh.userData.isWireframeHelper = true;
                        child.parent.add(wfMesh);
                        child.userData.wireframeSkin = wfMesh;
                    }
                    child.userData.wireframeSkin.visible = true;
                    child.material = new THREE.MeshBasicMaterial({ visible: false });
                } else {
                    if (!child.userData.wireframeLines) {
                        // Create quad wireframe as LineSegments
                        const quadWireframeGeom = this.createQuadWireframeLinesGeometry(child.geometry);
                        const lineSegments = new THREE.LineSegments(
                            quadWireframeGeom,
                            new THREE.LineBasicMaterial({
                                color: 0x888888,
                                transparent: true,
                                opacity: 0.8,
                            })
                        );
                        lineSegments.userData.isWireframeHelper = true;
                        child.userData.wireframeLines = lineSegments;
                        child.add(lineSegments);
                    }
                    child.userData.wireframeLines.visible = true;
                    child.material = new THREE.MeshBasicMaterial({ visible: false });
                }
            } else {
                if (child.userData.wireframeSkin) {
                    child.userData.wireframeSkin.visible = false;
                }
                if (child.userData.wireframeLines) {
                    child.userData.wireframeLines.visible = false;
                }
                if (mode === "clay") {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0xf3f4f6,
                        roughness: 0.6,
                        metalness: 0.02,
                        side: THREE.DoubleSide
                    });
                } else {
                    child.material = child.userData.originalMaterial;
                }
                child.material.visible = true;
            }
        });
    }

    // Helper method to create quad wireframe geometry (maintains quad structure)
    createQuadWireframeGeometry(geometry) {
        // Clone the geometry to avoid modifying the original
        const clonedGeom = geometry.clone();
        const position = clonedGeom.attributes.position;
        const index = clonedGeom.index;

        if (!index) {
            // If no index, assume triangles are already expanded
            return this.expandToQuadWireframe(clonedGeom);
        }

        // Convert triangle indices to quad wireframe indices
        const triIndices = index.array;
        const quadIndices = [];

        for (let i = 0; i < triIndices.length; i += 3) {
            const a = triIndices[i];
            const b = triIndices[i + 1];
            const c = triIndices[i + 2];

            // For quads, we need to detect if this triangle is part of a quad
            // and create wireframe edges accordingly
            // We'll use a simple approach: create all edges and deduplicate
            quadIndices.push(a, b);
            quadIndices.push(b, c);
            quadIndices.push(c, a);
        }

        // Deduplicate edges (for clean quad wireframe)
        const edgeSet = new Set();
        const uniqueEdges = [];

        for (let i = 0; i < quadIndices.length; i += 2) {
            const a = quadIndices[i];
            const b = quadIndices[i + 1];
            const key = Math.min(a, b) + ',' + Math.max(a, b);

            if (!edgeSet.has(key)) {
                edgeSet.add(key);
                uniqueEdges.push(a, b);
            }
        }

        // Create new buffer geometry with only wireframe edges
        const wireframeGeom = new THREE.BufferGeometry();
        const vertices = [];

        // Map original vertex positions
        const posAttr = position;
        const positions = posAttr.array;

        for (let i = 0; i < uniqueEdges.length; i++) {
            const idx = uniqueEdges[i];
            const baseIdx = idx * 3;
            vertices.push(
                positions[baseIdx],
                positions[baseIdx + 1],
                positions[baseIdx + 2]
            );
        }

        wireframeGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        // Copy morph attributes if they exist
        if (geometry.morphAttributes && geometry.morphAttributes.position) {
            wireframeGeom.morphAttributes.position = geometry.morphAttributes.position.map((morphAttr) => {
                const morphPositions = [];
                const morphArray = morphAttr.array;
                for (let i = 0; i < uniqueEdges.length; i++) {
                    const idx = uniqueEdges[i];
                    const baseIdx = idx * 3;
                    morphPositions.push(
                        morphArray[baseIdx],
                        morphArray[baseIdx + 1],
                        morphArray[baseIdx + 2]
                    );
                }
                return new THREE.Float32BufferAttribute(morphPositions, 3);
            });
        }

        return wireframeGeom;
    }

    // Helper method to create quad wireframe lines (for non-skinned meshes)
    createQuadWireframeLinesGeometry(geometry) {
        // Similar to above but returns LineSegments geometry
        const clonedGeom = geometry.clone();
        const position = clonedGeom.attributes.position;
        const index = clonedGeom.index;

        // Get edge vertices (deduplicated)
        const triIndices = index ? index.array : null;
        const edgePairs = [];
        const edgeSet = new Set();

        if (triIndices) {
            for (let i = 0; i < triIndices.length; i += 3) {
                const a = triIndices[i];
                const b = triIndices[i + 1];
                const c = triIndices[i + 2];

                // Add all triangle edges
                const edges = [[a, b], [b, c], [c, a]];
                for (const [v1, v2] of edges) {
                    const key = Math.min(v1, v2) + ',' + Math.max(v1, v2);
                    if (!edgeSet.has(key)) {
                        edgeSet.add(key);
                        edgePairs.push(v1, v2);
                    }
                }
            }
        } else {
            // No index, assume triangle soup
            const posCount = position.count;
            for (let i = 0; i < posCount; i += 3) {
                const a = i;
                const b = i + 1;
                const c = i + 2;

                const edges = [[a, b], [b, c], [c, a]];
                for (const [v1, v2] of edges) {
                    const key = Math.min(v1, v2) + ',' + Math.max(v1, v2);
                    if (!edgeSet.has(key)) {
                        edgeSet.add(key);
                        edgePairs.push(v1, v2);
                    }
                }
            }
        }

        // Build vertex array
        const vertices = [];
        const posAttr = position;
        const positions = posAttr.array;

        for (const idx of edgePairs) {
            const baseIdx = idx * 3;
            vertices.push(
                positions[baseIdx],
                positions[baseIdx + 1],
                positions[baseIdx + 2]
            );
        }

        const wireframeGeom = new THREE.BufferGeometry();
        wireframeGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        return wireframeGeom;
    }

    // Update the animation loop to handle quad wireframe updates for morph targets
    // Replace the existing animation loop with this updated version
    startAnimationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);

            const delta = this.clock.getDelta();
            if (this.isPlaying && this.endFrame > this.startFrame) {
                this.currentFrame += delta * this.fps;
                if (this.currentFrame > this.endFrame) {
                    this.currentFrame = this.startFrame;
                }
                this.slider.value = this.currentFrame;
                this.frameLabel.textContent = `Frame: ${Math.round(this.currentFrame)}`;
                if (this.mixer) {
                    this.mixer.setTime(this.currentFrame / this.fps);
                }

                // Update wireframe for morph targets - maintain quad structure
                if (this.shadingMode === "wireframe" && this.currentModel) {
                    this.currentModel.traverse((child) => {
                        if (!child.isMesh) return;

                        // Update quad wireframe for morph targets
                        if (child.userData.wireframeLines && child.morphTargetInfluences) {
                            const hasMorph = child.morphTargetInfluences.some(v => v !== 0);
                            if (hasMorph) {
                                // Recreate wireframe with current morph positions
                                const newGeom = this.createQuadWireframeLinesGeometry(child.geometry);
                                child.userData.wireframeLines.geometry.dispose();
                                child.userData.wireframeLines.geometry = newGeom;
                            }
                        }

                        // Update skinned mesh wireframe
                        if (child.userData.wireframeSkin && child.morphTargetInfluences) {
                            const hasMorph = child.morphTargetInfluences.some(v => v !== 0);
                            if (hasMorph) {
                                const newGeom = this.createQuadWireframeGeometry(child.geometry);
                                child.userData.wireframeSkin.geometry.dispose();
                                child.userData.wireframeSkin.geometry = newGeom;
                            }
                        }
                    });
                }
            }

            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    switchCamera(cameraPath) {
        if (cameraPath === "persp") {
            if (this.currentModel) {
                this.currentModel.rotation.set(0, 0, 0);
            }
            this.camera.fov = 45;
            this.camera.updateProjectionMatrix();
            this.fitCameraToModel();
            return;
        }

        const cameras = this.currentUsdCameras || [];
        const camInfo = cameras.find(c => c.path === cameraPath);
        if (!camInfo) return;

        let camObj = null;
        if (this.currentModel) {
            this.currentModel.traverse(child => {
                if (child.userData.usd?.path === cameraPath) {
                    camObj = child;
                }
            });
        }

        if (camObj) {
            camObj.updateMatrixWorld(true);
            const pos = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            camObj.matrixWorld.decompose(pos, q, s);

            this.camera.position.copy(pos);
            this.camera.quaternion.copy(q);

            if (camInfo.projection === "perspective" && camInfo.focalLength && camInfo.horizontalAperture) {
                const vertAp = camInfo.verticalAperture || (camInfo.horizontalAperture * (this.height / this.width));
                const fovDeg = 2 * Math.atan(vertAp / (2 * camInfo.focalLength)) * (180 / Math.PI);
                this.camera.fov = fovDeg;
            } else {
                this.camera.fov = 45;
            }
            this.camera.updateProjectionMatrix();
        }
    }

    fitCameraToModel() {
        if (!this.currentModel) return;

        const box = new THREE.Box3().setFromObject(this.currentModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        if (maxDim === 0) return;

        const fovRad = this.camera.fov * (Math.PI / 180);
        const dist = Math.abs(maxDim / (2 * Math.tan(fovRad / 2))) * 1.5;

        this.camera.position.set(center.x, center.y, center.z + dist);
        this.camera.lookAt(center);
        this.camera.near = dist / 100;
        this.camera.far = dist * 100;
        this.camera.updateProjectionMatrix();
    }

    async loadUSD(filePath, usdaText = null) {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }

        try {
            let model;

            if (usdaText) {
                const arrayBuffer = new TextEncoder().encode(usdaText).buffer;
                const parseOptions = {
                    sourcePath: `/usd/view?filename=${encodeURIComponent(filePath || 'scene.usda')}`
                };
                model = await this.loader.parseAsync(arrayBuffer, parseOptions);
            }
                else if (filePath) {
                const url = `/usd/view?filename=${encodeURIComponent(filePath)}`;
                model = await this.loader.loadAsync(url);
            } else {
                throw new Error("No USD data provided");
            }

            model.scene.traverse((child) => {
                if (child.isMesh) {
                    child.userData.originalMaterial = child.material;
                    if (!child.material) {
                        child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
                    }
                }
            });

            this.currentModel = model.scene;
            this.scene.add(model.scene);

            // Extract camera data
            this.currentUsdCameras = model.cameras || model.data?.cameras || [];
            this.updateCameraOptions();

            // Setup timeline
            const stageData = model.data;
            this.startFrame = stageData?.stage?.startTimeCode ?? 0;
            this.endFrame = stageData?.stage?.endTimeCode ?? 0;
            this.fps = stageData?.stage?.timeCodesPerSecond || 24;
            this.currentFrame = this.startFrame;
            this.isPlaying = false;

            this.setupTimeline();

            // Apply shading
            if (this.shadingSelect) {
                this.applyShading(this.shadingSelect.value);
            }

            // Fit camera
            this.fitCameraToModel();

            // Setup animation
            if (model.scene.animations && model.scene.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model.scene);
                model.scene.animations.forEach((clip) => {
                    this.mixer.clipAction(clip).play();
                });
                this.mixer.setTime(this.startFrame / this.fps);
            } else {
                this.mixer = null;
            }

            return model;
        } catch (error) {
            console.error("[USD] Failed to load/parse USD:", error);
            this.showError("Failed to load USD file");
            throw error;
        }
    }

    setupTimeline() {
        if (this.endFrame > this.startFrame) {
            if (this.controlOverlay) this.controlOverlay.style.display = "flex";
            if (this.slider) {
                this.slider.min = this.startFrame;
                this.slider.max = this.endFrame;
                this.slider.value = this.startFrame;
            }
            if (this.frameLabel) {
                this.frameLabel.textContent = `Frame: ${Math.round(this.startFrame)}`;
            }
        } else {
            if (this.controlOverlay) this.controlOverlay.style.display = "none";
        }
    }

    updateCameraOptions() {
        if (!this.cameraSelect) return;

        while (this.cameraSelect.options.length > 1) {
            this.cameraSelect.remove(1);
        }

        this.currentUsdCameras.forEach(cam => {
            const opt = document.createElement("option");
            opt.value = cam.path;
            opt.textContent = `Camera: ${cam.name}`;
            this.cameraSelect.appendChild(opt);
        });
        this.cameraSelect.value = "persp";
    }

    startAnimationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);

            const delta = this.clock.getDelta();
            if (this.isPlaying && this.endFrame > this.startFrame) {
                this.currentFrame += delta * this.fps;
                if (this.currentFrame > this.endFrame) {
                    this.currentFrame = this.startFrame;
                }
                this.slider.value = this.currentFrame;
                this.frameLabel.textContent = `Frame: ${Math.round(this.currentFrame)}`;
                if (this.mixer) {
                    this.mixer.setTime(this.currentFrame / this.fps);
                }

                // Update wireframe for morph targets
                if (this.shadingMode === "wireframe" && this.currentModel) {
                    this.currentModel.traverse((child) => {
                        if (!child.isMesh || child.isSkinnedMesh) return;
                        if (!child.userData.wireframeLines) return;
                        if (!child.morphTargetInfluences || child.morphTargetInfluences.every(v => v === 0)) return;
                        const newEdges = new THREE.EdgesGeometry(child.geometry, 1);
                        child.userData.wireframeLines.geometry.dispose();
                        child.userData.wireframeLines.geometry = newEdges;
                    });
                }
            }

            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    resize() {
        const w = this.container.clientWidth || this.width;
        const h = this.container.clientHeight || this.height;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    showError(message) {
        this.container.style.display = "flex";
        this.container.style.alignItems = "center";
        this.container.style.justifyContent = "center";
        this.container.style.color = "#ef4444";
        this.container.style.padding = "20px";
        this.container.style.textAlign = "center";
        this.container.style.fontFamily = "sans-serif";
        this.container.style.fontSize = "11px";
        this.container.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px; padding: 12px; width: 85%;">
                <strong>${message}</strong><br>
                Hardware acceleration might be disabled, unsupported, or blocked in your browser.
            </div>
        `;
    }

    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}