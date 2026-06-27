import { app } from "../../../scripts/app.js";
import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/examples/jsm/controls/OrbitControls.js";
import core from "./lib/core/index.js";
import { USDLoader } from "./lib/three-loader/openusd_three_loader.js";

// --- Global Fetch Interceptor to support relative USD references in ComfyUI's query-param file system ---
const originalFetch = window.fetch;
let activeInterceptorBaseDir = '';
let activeInterceptorType = 'output';

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
                const targetFilePath = baseDir + asset.path;
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
        // Register custom USD connection type color (Pixar USD blue) on LiteGraph and LGraphCanvas
        const usdBlue = "#00a2ff";
        if (window.LiteGraph) {
            if (!window.LiteGraph.link_type_colors) {
                window.LiteGraph.link_type_colors = {};
            }
            window.LiteGraph.link_type_colors["USD"] = usdBlue;
            window.LiteGraph.link_type_colors["usd"] = usdBlue;
        }
        if (window.LGraphCanvas && window.LGraphCanvas.link_type_colors) {
            window.LGraphCanvas.link_type_colors["USD"] = usdBlue;
            window.LGraphCanvas.link_type_colors["usd"] = usdBlue;
        }
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
                
                const widget = this.addDOMWidget("usd_viewport", "HTML", div);
                widget.serializeValue = () => undefined;

                // Stop mouse/touch events from bubbling up to ComfyUI's main canvas
                const stopBubble = (e) => e.stopPropagation();
                ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu'].forEach(eventName => {
                    div.addEventListener(eventName, stopBubble, { passive: true });
                });

                let scene, camera, renderer, controls;
                try {
                    scene = new THREE.Scene();
                    camera = new THREE.PerspectiveCamera(45, NODE_W / NODE_H, 0.1, 1000);
                    camera.position.set(0, 0, 5);

                    renderer = new THREE.WebGLRenderer({ antialias: true });
                    renderer.setSize(NODE_W, NODE_H);
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                    renderer.domElement.style.pointerEvents = "auto";
                    div.appendChild(renderer.domElement);

                    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
                    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
                    dirLight.position.set(10, 10, 10);
                    scene.add(dirLight);

                    controls = new OrbitControls(camera, div);
                    controls.enableDamping = true;
                    // Enable 3-button mouse CAD scheme: Rotate (left), Pan (middle), Zoom (right)
                    controls.mouseButtons = {
                        LEFT: THREE.MOUSE.ROTATE,
                        MIDDLE: THREE.MOUSE.PAN,
                        RIGHT: THREE.MOUSE.DOLLY
                    };
                    this.threeControls = controls;
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
                this.applyShading = (mode) => {
                    if (!this.currentModel) return;
                    this.currentModel.traverse((child) => {
                        if (!child.isMesh) return;
                        
                        if (!child.userData.originalMaterial) {
                            child.userData.originalMaterial = child.material;
                        }
                        
                        if (mode === "wireframe") {
                            child.material = new THREE.MeshBasicMaterial({ 
                                color: 0x888888, 
                                wireframe: true, 
                                transparent: true, 
                                opacity: 0.35 
                            });
                        } else if (mode === "clay") {
                            child.material = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide });
                        } else {
                            // rendered
                            child.material = child.userData.originalMaterial;
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

                // Caches for Executed bindings
                this.controlOverlay = controlOverlay;
                this.slider = slider;
                this.frameLabel = frameLabel;
                this.playBtn = playBtn;
                this.shadingSelect = shadingSelect;

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
                    }
                    
                    controls.update();
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
                        console.error("[USD] Zero bounding box — model may have no geometry");
                        return;
                    }

                    const fov = this.threeCamera.fov * (Math.PI / 180);
                    const dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;

                    this.threeCamera.position.set(center.x, center.y, center.z + dist);
                    this.threeCamera.lookAt(center);
                    this.threeCamera.near = dist / 100;
                    this.threeCamera.far = dist * 100;
                    this.threeCamera.updateProjectionMatrix();

                    if (this.threeControls) {
                        this.threeControls.target.copy(center);
                        this.threeControls.update();
                    }

                } catch (error) {
                    console.error("[USD] Failed to load/parse USD:", error);
                    console.error("[USD] Stack:", error.stack);
                }
            };
        }
    }
});