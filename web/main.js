import { app } from "../../../scripts/app.js";
import * as THREE from "https://esm.sh/three";
import core from "./lib/core/index.js";
import { USDLoader } from "./lib/three-loader/openusd_three_loader.js";

// --- Global Fetch Interceptor to support relative USD references in ComfyUI's query-param file system ---
const originalFetch = window.fetch;
let activeInterceptorBaseDir = '';
let activeInterceptorType = 'output';

app.registerExtension({
  name: "usd.slot_colors",

  async setup() {
    const color = "#8E6BFF";

    // Link color
    LGraphCanvas.link_type_colors.USD = color;

    // Optional: slot fill colors
    LiteGraph.slot_types_default_in.USD = color;
    LiteGraph.slot_types_default_out.USD = color;
  },
});

window.fetch = async function(resource, init) {
    let urlString = '';
    if (typeof resource === 'string') {
        urlString = resource;
    } else if (resource instanceof URL) {
        urlString = resource.href;
    } else if (resource && typeof resource === 'object' && 'url' in resource) {
        urlString = resource.url;
    }
    
    if (activeInterceptorBaseDir) {
        try {
            const url = new URL(urlString, window.location.origin);
            // If it's a relative reference request to the server, rewrite it
            if (url.origin === window.location.origin && 
                !url.pathname.startsWith('/api/') && 
                !url.pathname.startsWith('/extensions/') && 
                !url.pathname.startsWith('/usd/view') && 
                url.pathname !== '/' && 
                url.pathname !== '/index.html') {
                
                let relativePath = url.pathname.substring(1);
                if (relativePath.startsWith('usd/')) {
                    relativePath = relativePath.substring(4);
                }
                
                let targetFilePath;
                if (url.pathname.startsWith('/home/')) {
                    targetFilePath = url.pathname;
                } else if (relativePath.startsWith('home/')) {
                    targetFilePath = '/' + relativePath;
                } else {
                    targetFilePath = activeInterceptorBaseDir + relativePath;
                }
                
                const interceptedUrl = `/usd/view?filename=${encodeURIComponent(targetFilePath)}`;
                console.log(`[USD Interceptor] Redirecting fetch: ${url.pathname} -> ${interceptedUrl}`);
                return originalFetch(interceptedUrl, init);
            }
        } catch (e) {
            console.error("[USD Interceptor Error]", e);
        }
    }
    return originalFetch(resource, init);
};

const loader = new USDLoader({
    pxrCore: core,
    textureResolver(asset, context) {
        if (!asset.path) return null;
        try {
            const parentUrl = new URL(context.sourcePath, window.location.origin);
            const parentFile = parentUrl.searchParams.get('filename');
            
            if (parentFile) {
                // If the main file is a USDZ, let the loader extract textures internally from the ZIP.
                if (parentFile.toLowerCase().endsWith('.usdz')) {
                    return null;
                }
                const baseDir = parentFile.substring(0, parentFile.lastIndexOf('/')) + '/';
                // If the asset path is already absolute, use it directly; otherwise resolve relative to the USD file's directory
                const targetFilePath = asset.path.startsWith('/') ? asset.path : baseDir + asset.path;
                const resolvedUrl = `/usd/view?filename=${encodeURIComponent(targetFilePath)}`;
                console.log(`[USD Texture Resolver] Resolved: ${asset.path} -> ${resolvedUrl}`);
                return resolvedUrl;
            }
        } catch (e) {
            console.error("[USD Texture Resolver Error]", e);
        }
        return null;
    },
});

const NODE_W = 400;
const NODE_H = 260;

app.registerExtension({
    name: "USD.Viewer",
    init(app) {
        // init hook is called before app.canvas is initialized
    },
    setup(app) {
        // Removed custom USD connection type styling
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PreviewOpenUSD") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                this.size = [NODE_W, NODE_H + 40];

                // Inject ComfyUI style overrides
                if (!document.getElementById("comfy-usd-styles")) {
                    const styleEl = document.createElement("style");
                    styleEl.id = "comfy-usd-styles";
                    styleEl.textContent = `
                        .comfy-usd-timeline {
                            background: rgba(30, 30, 30, 0.9) !important;
                            border: 1px solid rgba(255, 255, 255, 0.1) !important;
                            font-family: monospace !important;
                            color: #ffffff !important;
                        }
                        .comfy-usd-btn {
                            background: #22252a !important;
                            border: 1px solid rgba(255, 255, 255, 0.1) !important;
                            color: #a1a1aa !important;
                            border-radius: 4px !important;
                            padding: 3px 10px !important;
                            cursor: pointer !important;
                            font-size: 10px !important;
                            font-weight: 500 !important;
                            transition: background 0.1s, color 0.1s !important;
                            outline: none !important;
                        }
                        .comfy-usd-btn:hover {
                            background: #3a3f4a !important;
                            color: #ffffff !important;
                        }
                        .comfy-usd-select {
                            background: rgba(30, 30, 30, 0.9) !important;
                            color: #a1a1aa !important;
                            border: 1px solid rgba(255, 255, 255, 0.1) !important;
                            border-radius: 4px !important;
                            padding: 3px 8px !important;
                            font-size: 10px !important;
                            outline: none !important;
                            cursor: pointer !important;
                            transition: background 0.1s, color 0.1s !important;
                        }
                        .comfy-usd-select:hover {
                            background: #3a3f4a !important;
                            color: #ffffff !important;
                        }
                        .comfy-usd-slider {
                            accent-color: #3b82f6 !important;
                        }
                    `;
                    document.head.appendChild(styleEl);
                }

                const div = document.createElement("div");
                div.style.width = "100%";
                div.style.height = "100%";
                div.style.backgroundColor = "#111";
                div.style.overflow = "hidden";
                div.style.position = "relative";
                div.style.pointerEvents = "auto";
                div.style.touchAction = "none";
                
                // Timeline overlay
                const controlOverlay = document.createElement("div");
                controlOverlay.className = "usd-controls-overlay comfy-usd-timeline";
                controlOverlay.style.cssText = "position: absolute; bottom: 8px; left: 8px; right: 8px; display: none; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 11px; z-index: 100; pointer-events: auto; backdrop-filter: blur(4px);";


                
                const playBtn = document.createElement("button");
                playBtn.className = "comfy-usd-btn";
                playBtn.textContent = "Play";
                playBtn.style.cssText = "outline: none;";
                
                const slider = document.createElement("input");
                slider.type = "range";
                slider.className = "comfy-usd-slider";
                slider.style.cssText = "flex: 1; height: 4px; background: #3f3f46; border-radius: 2px; outline: none; cursor: pointer;";
                
                const frameLabel = document.createElement("span");
                frameLabel.textContent = "Frame: 0";
                frameLabel.style.cssText = "color: #e4e4e7; min-width: 80px; text-align: right; font-family: monospace;";
                
                controlOverlay.appendChild(playBtn);
                controlOverlay.appendChild(slider);
                controlOverlay.appendChild(frameLabel);
                div.appendChild(controlOverlay);

                // Shading mode overlay
                const shadingOverlay = document.createElement("div");
                shadingOverlay.style.cssText = "position: absolute; top: 8px; right: 8px; z-index: 100; pointer-events: auto;";
                
                const shadingSelect = document.createElement("select");
                shadingSelect.className = "comfy-usd-select";
                shadingSelect.style.cssText = "outline: none; cursor: pointer; backdrop-filter: blur(4px);";
                
                const shadingOptions = ["Rendered", "Clay", "Wireframe"];
                shadingOptions.forEach(opt => {
                    const el = document.createElement("option");
                    el.value = opt.toLowerCase();
                    el.textContent = opt;
                    shadingSelect.appendChild(el);
                });
                shadingOverlay.appendChild(shadingSelect);
                div.appendChild(shadingOverlay);

                // Camera select overlay (top left)
                const cameraOverlay = document.createElement("div");
                cameraOverlay.style.cssText = "position: absolute; top: 8px; left: 8px; z-index: 100; pointer-events: auto;";
                
                const cameraSelect = document.createElement("select");
                cameraSelect.className = "comfy-usd-select";
                cameraSelect.style.cssText = "outline: none; cursor: pointer; backdrop-filter: blur(4px);";
                
                const defaultCameraOpt = document.createElement("option");
                defaultCameraOpt.value = "persp";
                defaultCameraOpt.textContent = "Camera: Perspective";
                cameraSelect.appendChild(defaultCameraOpt);
                cameraOverlay.appendChild(cameraSelect);
                div.appendChild(cameraOverlay);
                
                const widget = this.addDOMWidget("usd_viewport", "HTML", div);
                widget.serializeValue = () => undefined;
                if (widget.element) {
                    widget.element.style.pointerEvents = "auto";
                }

                // Stop mouse/touch events from bubbling up to ComfyUI's main canvas
                const stopBubble = (e) => {
                    e.stopPropagation();
                    if (e.type === "wheel") {
                        e.preventDefault();
                    }
                };
                ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu'].forEach(eventName => {
                    div.addEventListener(eventName, stopBubble, { passive: eventName !== "wheel" });
                });

                let scene, camera, renderer;
                try {
                    scene = new THREE.Scene();
                    camera = new THREE.PerspectiveCamera(45, NODE_W / NODE_H, 0.1, 1000);
                    camera.position.set(0, 0, 5);

                    renderer = new THREE.WebGLRenderer({ antialias: true });
                    renderer.setSize(NODE_W, NODE_H);
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                    renderer.domElement.style.pointerEvents = "auto";
                    renderer.domElement.style.touchAction = "none";
                    div.appendChild(renderer.domElement);

                    // Stop event propagation on WebGL canvas for click and zoom to prevent ComfyUI from panning the graph
                    const stopCanvasEvent = (e) => {
                        e.stopPropagation();
                        if (e.type === "wheel") {
                            e.preventDefault();
                        }
                    };
                    ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu'].forEach(eventName => {
                        renderer.domElement.style.pointerEvents = "auto";
                        renderer.domElement.style.touchAction = "none";
                        renderer.domElement.addEventListener(eventName, stopCanvasEvent, { passive: eventName !== "wheel" });
                    });

                    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
                    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
                    dirLight.position.set(10, 10, 10);
                    scene.add(dirLight);

                    // --- Custom Event-Based 3D Viewport Controls (No OrbitControls Dependency) ---
                    let isDragging = false;
                    let previousMousePosition = { x: 0, y: 0 };
                    
                    const onPointerDown = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        isDragging = true;
                        previousMousePosition = { x: e.clientX, y: e.clientY };
                        renderer.domElement.focus();
                    };
                    
                    const onPointerMove = (e) => {
                        if (!isDragging) return;
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const deltaMove = {
                            x: e.clientX - previousMousePosition.x,
                            y: e.clientY - previousMousePosition.y
                        };
                        
                        if (e.buttons === 4 || (e.buttons === 1 && e.shiftKey)) {
                            // Pan locally relative to distance
                            const factor = camera.position.length() * 0.0025;
                            camera.translateX(-deltaMove.x * factor);
                            camera.translateY(deltaMove.y * factor);
                        } else if (e.buttons === 2 || (e.buttons === 1 && (e.ctrlKey || e.altKey))) {
                            // Zoom locally along view vector
                            const factor = camera.position.length() * 0.005;
                            camera.translateZ(deltaMove.y * factor);
                        } else if (e.buttons === 1) {
                            // Rotate model in front of camera
                            if (this.currentModel) {
                                this.currentModel.rotation.y += deltaMove.x * 0.01;
                                this.currentModel.rotation.x += deltaMove.y * 0.01;
                            }
                        }
                        
                        previousMousePosition = { x: e.clientX, y: e.clientY };
                    };
                    
                    const onPointerUp = (e) => {
                        e.stopPropagation();
                        if (isDragging) {
                            isDragging = false;
                        }
                    };
                    
                    const onWheel = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Zoom camera locally along Z view axis
                        const factor = camera.position.length() * 0.05;
                        camera.translateZ((e.deltaY > 0 ? 1 : -1) * factor);
                    };
                    
                    const onContextMenu = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    };

                    renderer.domElement.addEventListener('pointerdown', onPointerDown);
                    renderer.domElement.addEventListener('pointermove', onPointerMove);
                    renderer.domElement.addEventListener('pointerup', onPointerUp);
                    renderer.domElement.addEventListener('pointerleave', onPointerUp);
                    renderer.domElement.addEventListener('pointercancel', onPointerUp);
                    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
                    renderer.domElement.addEventListener('contextmenu', onContextMenu);
                } catch (err) {
                    console.error("[USD] WebGL initialization failed:", err);
                    controlOverlay.style.display = "none";
                    shadingOverlay.style.display = "none";
                    div.style.display = "flex";
                    div.style.alignItems = "center";
                    div.style.justifyContent = "center";
                    div.style.color = "#ef4444";
                    div.style.padding = "20px";
                    div.style.textAlign = "center";
                    div.style.fontFamily = "sans-serif";
                    div.style.fontSize = "11px";
                    div.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px; padding: 12px; width: 85%;">
                            <strong>WebGL context creation failed</strong><br>
                            Hardware acceleration might be disabled, unsupported, or blocked in your browser.
                        </div>
                    `;
                    return;
                }

                // Animation playback state
                this.startFrame = 0;
                this.endFrame = 0;
                this.currentFrame = 0;
                this.fps = 24;
                this.isPlaying = false;
                this.mixer = null;
                this.clock = new THREE.Clock();

                // Apply shading modes
                this.shadingMode = "solid";
                this.applyShading = (mode) => {
                    if (!this.currentModel) return;
                    this.shadingMode = mode;
                    this.currentModel.traverse((child) => {
                        if (!child.isMesh) return;

                        if (!child.userData.originalMaterial) {
                            child.userData.originalMaterial = child.material;
                        }

                        if (mode === "wireframe") {
                            // ---- Skinned mesh: use a sibling SkinnedMesh that shares the skeleton ----
                            if (child.isSkinnedMesh) {
                                if (!child.userData.wireframeSkin) {
                                    const wfMat = new THREE.MeshBasicMaterial({
                                        color: 0x888888,
                                        wireframe: true,
                                        transparent: true,
                                        opacity: 0.8,
                                        depthTest: true,
                                    });
                                    const wfMesh = new THREE.SkinnedMesh(child.geometry, wfMat);
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

                            // ---- Static / morph-target mesh: EdgesGeometry (rebuilt on morph changes) ----
                            } else {
                                if (!child.userData.wireframeLines) {
                                    const edges = new THREE.EdgesGeometry(child.geometry, 1);
                                    const lineSegments = new THREE.LineSegments(
                                        edges,
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
                            // Hide skinned wireframe helper
                            if (child.userData.wireframeSkin) {
                                child.userData.wireframeSkin.visible = false;
                            }
                            // Hide edge-line helper
                            if (child.userData.wireframeLines) {
                                child.userData.wireframeLines.visible = false;
                            }
                            if (mode === "clay") {
                                child.material = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide });
                            } else {
                                child.material = child.userData.originalMaterial;
                            }
                            child.material.visible = true;
                        }
                    });
                };

                // Play / Pause Toggle
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.isPlaying = !this.isPlaying;
                    playBtn.textContent = this.isPlaying ? "Pause" : "Play";
                    playBtn.style.background = this.isPlaying ? "#f43f5e" : "#22252a";
                    playBtn.style.color = this.isPlaying ? "#ffffff" : "#a1a1aa";
                });

                // Timeline scrub
                slider.addEventListener('input', (e) => {
                    e.stopPropagation();
                    this.currentFrame = parseFloat(slider.value);
                    frameLabel.textContent = `Frame: ${Math.round(this.currentFrame)}`;
                    if (this.mixer) {
                        this.mixer.setTime(this.currentFrame / this.fps);
                    }
                });

                // Shading selection
                shadingSelect.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.applyShading(shadingSelect.value);
                });

                // Camera selection
                cameraSelect.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const val = cameraSelect.value;
                    if (this.currentModel) {
                        this.currentModel.rotation.set(0, 0, 0);
                    }
                    if (val === "persp") {
                        camera.fov = 45;
                        camera.updateProjectionMatrix();
                        if (this.currentModel) {
                            const box = new THREE.Box3().setFromObject(this.currentModel);
                            const center = box.getCenter(new THREE.Vector3());
                            const size = box.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);
                            const fovRad = camera.fov * (Math.PI / 180);
                            const dist = Math.abs(maxDim / (2 * Math.tan(fovRad / 2))) * 1.5;
                            camera.position.set(center.x, center.y, center.z + dist);
                            camera.lookAt(center);
                        }
                    } else {
                        const cameras = this.currentUsdCameras || [];
                        const camInfo = cameras.find(c => c.path === val);
                        if (camInfo) {
                            let camObj = null;
                            if (this.currentModel) {
                                this.currentModel.traverse(child => {
                                    if (child.userData.usd?.path === val) {
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
                                
                                camera.position.copy(pos);
                                camera.quaternion.copy(q);
                                
                                if (camInfo.projection === "perspective" && camInfo.focalLength && camInfo.horizontalAperture) {
                                    const vertAp = camInfo.verticalAperture || (camInfo.horizontalAperture * (NODE_H / NODE_W));
                                    const fovDeg = 2 * Math.atan(vertAp / (2 * camInfo.focalLength)) * (180 / Math.PI);
                                    camera.fov = fovDeg;
                                } else {
                                    camera.fov = 45;
                                }
                                camera.updateProjectionMatrix();
                            }
                        }
                    }
                });

                // Caches for Executed bindings
                this.controlOverlay = controlOverlay;
                this.slider = slider;
                this.frameLabel = frameLabel;
                this.playBtn = playBtn;
                this.shadingSelect = shadingSelect;
                this.cameraSelect = cameraSelect;

                // Add ResizeObserver to handle canvas resizing dynamically
                const ro = new ResizeObserver(() => {
                    const w = div.clientWidth || NODE_W;
                    const h = div.clientHeight || NODE_H;
                    renderer.setSize(w, h);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                });
                ro.observe(div);

                const animate = () => {
                    requestAnimationFrame(animate);
                    
                    const delta = this.clock.getDelta();
                    if (this.isPlaying && this.endFrame > this.startFrame) {
                        this.currentFrame += delta * this.fps;
                        if (this.currentFrame > this.endFrame) {
                            this.currentFrame = this.startFrame;
                        }
                        slider.value = this.currentFrame;
                        frameLabel.textContent = `Frame: ${Math.round(this.currentFrame)}`;
                        if (this.mixer) {
                            this.mixer.setTime(this.currentFrame / this.fps);
                        }

                        // Rebuild edge-wireframe geometry for morphed (non-skinned) meshes
                        if (this.shadingMode === "wireframe" && this.currentModel) {
                            this.currentModel.traverse((child) => {
                                if (!child.isMesh || child.isSkinnedMesh) return;
                                if (!child.userData.wireframeLines) return;
                                if (!child.morphTargetInfluences || child.morphTargetInfluences.every(v => v === 0)) return;
                                // Rebuild edges from the live geometry
                                const newEdges = new THREE.EdgesGeometry(child.geometry, 1);
                                child.userData.wireframeLines.geometry.dispose();
                                child.userData.wireframeLines.geometry = newEdges;
                            });
                        }
                    }
                    
                    renderer.render(scene, camera);
                };
                animate();

                this.threeScene = scene;
                this.threeCamera = camera;
                this.currentModel = null;
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = async function (message) {
                onExecuted?.apply(this, arguments);
                if (!this.threeScene || !this.threeCamera) {
                    console.warn("[USD] Viewport WebGL not initialized, skipping file load.");
                    return;
                }
                console.log("[USD] onExecuted fired, message:", message);

                const filePath = message?.usd_path?.[0];
                const usdaText = message?.usda_text?.[0];
                console.log("[USD] filePath:", filePath, "| usdaText length:", usdaText?.length ?? 0);

                // Resolve the base directory dynamically from the node input, text widget, or USDA header metadata
                const pathWidget = this.widgets?.find(w => w.name === "usd_path");
                const widgetPath = pathWidget?.value || "";
                
                // Parse path comment or comment metadata from USDA text if present
                let headerPath = "";
                if (usdaText) {
                    const commentMatch = usdaText.match(/comment\s*=\s*"usd_path:\s*(.+?)"/);
                    if (commentMatch && commentMatch[1]) {
                        headerPath = commentMatch[1].trim();
                        console.log("[USD] Extracted path from USDA comment metadata:", headerPath);
                    } else {
                        const pathMatch = usdaText.match(/^#\s*usd_path:\s*(.+)$/m);
                        if (pathMatch && pathMatch[1]) {
                            headerPath = pathMatch[1].trim();
                            console.log("[USD] Extracted path from USDA header comment:", headerPath);
                        }
                    }
                }
                
                const baseFile = filePath || headerPath || widgetPath;
                if (baseFile) {
                    activeInterceptorBaseDir = baseFile.substring(0, baseFile.lastIndexOf('/')) + '/';
                    console.log("[USD] Set workspace directory to:", activeInterceptorBaseDir);
                }

                if (!filePath && !usdaText) {
                    console.warn("[USD] No input received, returning early");
                    return;
                }

                if (this.currentModel) {
                    this.threeScene.remove(this.currentModel);
                    this.currentModel = null;
                }

                try {
                    let model;

                    if (filePath) {
                        const url = `/usd/view?filename=${encodeURIComponent(filePath)}`;
                        console.log("[USD] loadAsync:", url);
                        
                        // Set active interceptor base path for ComfyUI's query-param server
                        activeInterceptorBaseDir = filePath.substring(0, filePath.lastIndexOf('/')) + '/';
                        
                        model = await loader.loadAsync(url);
                    } else {
                        console.log("[USD] Parsing USDA text, length:", usdaText.length);
                        const arrayBuffer = new TextEncoder().encode(usdaText).buffer;
                        
                        const parseOptions = {};
                        if (activeInterceptorBaseDir) {
                            // Provide virtual sourcePath so the parser runs reference resolution
                            parseOptions.sourcePath = `/usd/view?filename=${encodeURIComponent(activeInterceptorBaseDir + 'scene.usda')}`;
                        }
                        
                        model = await loader.parseAsync(arrayBuffer, parseOptions);
                    }

                    console.log("[USD] model:", model);

                    model.scene.traverse((child) => {
                        if (child.isMesh) {
                            child.userData.originalMaterial = child.material;
                            if (!child.material) {
                                child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
                            }
                        }
                    });

                    this.currentModel = model.scene;
                    this.threeScene.add(model.scene);

                    // Populate camera selection options from USD stage cameras
                    if (this.cameraSelect) {
                        while (this.cameraSelect.options.length > 1) {
                            this.cameraSelect.remove(1);
                        }
                        const cameras = model.cameras || model.data?.cameras || [];
                        this.currentUsdCameras = cameras;
                        cameras.forEach(cam => {
                            const opt = document.createElement("option");
                            opt.value = cam.path;
                            opt.textContent = `Camera: ${cam.name}`;
                            this.cameraSelect.appendChild(opt);
                        });
                        this.cameraSelect.value = "persp";
                    }

                    // Setup timeline and playback state
                    const stageData = model.data;
                    const startF = stageData?.stage?.startTimeCode ?? 0;
                    const endF = stageData?.stage?.endTimeCode ?? 0;
                    const fps = stageData?.stage?.timeCodesPerSecond || 24;

                    this.startFrame = startF;
                    this.endFrame = endF;
                    this.currentFrame = startF;
                    this.fps = fps;
                    this.isPlaying = false;
                    
                    if (this.playBtn) {
                        this.playBtn.textContent = "Play";
                        this.playBtn.style.background = "#6366f1";
                    }

                    if (endF > startF) {
                        if (this.controlOverlay) this.controlOverlay.style.display = "flex";
                        if (this.slider) {
                            this.slider.min = startF;
                            this.slider.max = endF;
                            this.slider.value = startF;
                        }
                        if (this.frameLabel) {
                            this.frameLabel.textContent = `Frame: ${Math.round(startF)}`;
                        }
                        
                        if (model.scene.animations && model.scene.animations.length > 0) {
                            const mixer = new THREE.AnimationMixer(model.scene);
                            model.scene.animations.forEach((clip) => {
                                mixer.clipAction(clip).play();
                            });
                            this.mixer = mixer;
                            this.mixer.setTime(startF / fps);
                        } else {
                            this.mixer = null;
                        }
                    } else {
                        if (this.controlOverlay) this.controlOverlay.style.display = "none";
                        this.mixer = null;
                    }

                    // Apply current shading setting from dropdown
                    if (this.shadingSelect) {
                        this.applyShading(this.shadingSelect.value);
                    }

                    const box = new THREE.Box3().setFromObject(model.scene);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    console.log("[USD] bounds center:", center, "| size:", size);

                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim === 0) {
                        console.error("[USD] Zero bounding box - model may have no geometry");
                        return;
                    }

                    const fov = this.threeCamera.fov * (Math.PI / 180);
                    const dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;

                    this.threeCamera.position.set(center.x, center.y, center.z + dist);
                    this.threeCamera.lookAt(center);
                    this.threeCamera.near = dist / 100;
                    this.threeCamera.far = dist * 100;
                    this.threeCamera.updateProjectionMatrix();
                    // camera position and target set successfully


                } catch (error) {
                    console.error("[USD] Failed to load/parse USD:", error);
                    console.error("[USD] Stack:", error.stack);
                }
            };
        }

        if (nodeData.name === "ApplyUSDMaterial") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                
                const convertToColorPicker = (widgetName) => {
                    const w = this.widgets?.find(x => x.name === widgetName);
                    if (w) {
                        w.draw = function(ctx, node, widget_width, y, widget_height) {
                            ctx.save();
                            // Background box
                            ctx.fillStyle = "#1e1e1f";
                            ctx.fillRect(15, y, widget_width - 30, widget_height - 4);
                            
                            // Color swatch preview
                            ctx.fillStyle = this.value || "#ffffff";
                            ctx.fillRect(20, y + 4, 30, widget_height - 12);
                            
                            // Label hex text
                            ctx.fillStyle = "#ffffff";
                            ctx.font = "10px monospace";
                            ctx.fillText(this.name + ": " + this.value, 60, y + 14);
                            ctx.restore();
                        };
                        
                        w.mouse = function(event, pos, node) {
                            if (event.type === "mousedown") {
                                const input = document.createElement("input");
                                input.type = "color";
                                input.value = this.value;
                                input.style.position = "absolute";
                                input.style.opacity = 0;
                                document.body.appendChild(input);
                                input.click();
                                input.addEventListener("input", () => {
                                    this.value = input.value;
                                    node.setDirtyCanvas(true, true);
                                });
                                input.addEventListener("change", () => {
                                    this.value = input.value;
                                    document.body.removeChild(input);
                                });
                            }
                        };
                    }
                };

                // Apply picker overrides to our color input fields
                setTimeout(() => {
                    convertToColorPicker("diffuse_color");
                    convertToColorPicker("emissive_color");
                }, 100);
            };
        }
    }
});