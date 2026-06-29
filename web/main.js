import { app } from "../../../scripts/app.js";
import { USDViewport } from "./widgets/viewport.js";
import { USDTreeView } from "./widgets/tree.js";
import * as THREE from "https://esm.sh/three";

/* ---- Capture and upload beauty/depth/normal passes ---------------- */
async function captureAndUploadRender(node) {
    const viewport = node.viewport;
    if (!viewport || !viewport.renderer || !viewport.scene || !viewport.camera) return;
    if (!viewport.currentModel) {
        console.warn("[RenderUSD] No model loaded yet, skipping capture.");
        return;
    }

    const renderer = viewport.renderer;
    const scene    = viewport.scene;
    const camera   = viewport.camera;

    // Use logical (CSS) dimensions to avoid devicePixelRatio mismatch
    const W = viewport.container.clientWidth  || renderer.domElement.clientWidth  || 512;
    const H = viewport.container.clientHeight || renderer.domElement.clientHeight || 512;

    // Collect every mesh and its current material so we can restore them after capture
    const meshMaterials = [];
    scene.traverse(child => {
        if (child.isMesh) {
            meshMaterials.push({ mesh: child, mat: child.material });
        }
    });

    // Get the per-mesh "original" (pre-wireframe) material, falling back to a grey standard
    const getCaptureMaterial = (mesh) => {
        const orig = mesh.userData.originalMaterial;
        if (orig) return orig;
        return new THREE.MeshStandardMaterial({ color: 0x888888 });
    };

    // Helper: render into an offscreen target at W×H and return a PNG data URL
    const renderToDataUrl = (materialOverride) => {
        // Make every mesh visible with the correct material for this pass
        meshMaterials.forEach(({ mesh }) => {
            mesh.visible = true;
            mesh.material = materialOverride !== null ? materialOverride : getCaptureMaterial(mesh);
            if (mesh.material) mesh.material.visible = true;
        });

        // Hide wireframe helpers — they're per-mesh children, not in meshMaterials
        scene.traverse(child => {
            if (child.userData?.isWireframeHelper) child.visible = false;
        });

        const target = new THREE.WebGLRenderTarget(W, H, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        });

        scene.overrideMaterial = null; // let per-mesh materials drive the pass
        renderer.setRenderTarget(target);
        renderer.setSize(W, H);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        // Restore renderer to container size
        renderer.setSize(
            viewport.container.clientWidth  || W,
            viewport.container.clientHeight || H
        );

        const buf = new Uint8Array(W * H * 4);
        renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);
        target.dispose();

        // WebGL is bottom-to-top; flip vertically
        const flipped = new Uint8Array(W * H * 4);
        for (let row = 0; row < H; row++) {
            const src = (H - 1 - row) * W * 4;
            flipped.set(buf.subarray(src, src + W * 4), row * W * 4);
        }

        const canvas2d = document.createElement("canvas");
        canvas2d.width  = W;
        canvas2d.height = H;
        const ctx = canvas2d.getContext("2d");
        const imgData = ctx.createImageData(W, H);
        imgData.data.set(flipped);
        ctx.putImageData(imgData, 0, 0);
        return canvas2d.toDataURL("image/png");
    };

    // Helper to upload a data URL to ComfyUI
    const uploadImage = async (dataUrl, suffix) => {
        const res  = await fetch(dataUrl);
        const blob = await res.blob();
        const filename = `render_usd_${node.id}_${suffix}.png`;
        const formData = new FormData();
        formData.append("image", blob, filename);
        formData.append("overwrite", "true");
        const uploadRes  = await fetch("/upload/image", { method: "POST", body: formData });
        const uploadJson = await uploadRes.json();
        return uploadJson.name
            ? (uploadJson.subfolder ? `${uploadJson.subfolder}/${uploadJson.name}` : uploadJson.name)
            : filename;
    };

    try {
        // Beauty: each mesh rendered with its original material
        const beautyUrl = renderToDataUrl(null);
        // Normal: Three.js MeshNormalMaterial override
        const normalUrl = renderToDataUrl(new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }));
        // Depth: Three.js MeshDepthMaterial override
        const depthUrl  = renderToDataUrl(new THREE.MeshDepthMaterial({ near: camera.near, far: camera.far }));

        // Restore each mesh to whatever material applyShading had set
        meshMaterials.forEach(({ mesh, mat }) => {
            mesh.material = mat;
            if (mat) mat.visible = mesh.userData.originalMaterial !== undefined
                ? (mesh.userData.wireframeLines?.visible ? false : true)
                : true;
        });
        // Restore wireframe helper visibility
        scene.traverse(child => {
            if (child.userData?.isWireframeHelper) {
                child.visible = viewport.shadingMode === "wireframe";
            }
        });
        renderer.render(scene, camera);

        const beautyFile = await uploadImage(beautyUrl, "beauty");
        const depthFile  = await uploadImage(depthUrl,  "depth");
        const normalFile = await uploadImage(normalUrl, "normal");

        const wBeauty = node.widgets?.find(w => w.name === "beauty_file");
        if (wBeauty) wBeauty.value = beautyFile;
        const wDepth  = node.widgets?.find(w => w.name === "depth_file");
        if (wDepth)  wDepth.value  = depthFile;
        const wNormal = node.widgets?.find(w => w.name === "normal_file");
        if (wNormal) wNormal.value = normalFile;

        console.log("[RenderUSD] Captured:", { beautyFile, depthFile, normalFile });
        node.setDirtyCanvas(true, true);
    } catch (err) {
        console.error("[RenderUSD] Render capture failed:", err);
        // Always restore meshes even on failure
        meshMaterials.forEach(({ mesh, mat }) => { mesh.material = mat; });
    }
}

/* ---- Load stylesheet -------------------------------------------------- */
(function loadCSS() {
    const id = 'comfy-usd-styles';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = '/extensions/ComfyUI-USD/style.css';
    document.head.appendChild(link);
})();

const NODE_W = 400;
const NODE_H = 500;

/* ---- Global fetch interceptor for relative USD references ------------- */
const originalFetch = window.fetch;
let activeInterceptorBaseDir = '';

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
            if (url.origin === window.location.origin &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/extensions/') &&
                !url.pathname.startsWith('/usd/view') &&
                !url.pathname.startsWith('/usd/prims') &&
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
                return originalFetch(interceptedUrl, init);
            }
        } catch (e) {
            console.error("[USD Interceptor Error]", e);
        }
    }
    return originalFetch(resource, init);
};

app.registerExtension({
    name: "USD.Viewer",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        /* ============================================================
           PreviewUSD node
           ============================================================ */
        if (nodeData.name === "PreviewUSD") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                this.size = [NODE_W, NODE_H];

                /* ---- Root container -------------------------------- */
                const container = document.createElement("div");
                container.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: var(--usd-bg-deep, #0d0d10);
                    position: relative;
                    overflow: hidden;
                `;

                /* ---- 3-D viewport ---------------------------------- */
                const viewportContainer = document.createElement("div");
                viewportContainer.style.cssText = `
                    flex: 1;
                    position: relative;
                    min-height: 200px;
                `;

                /* ---- Tree panel ------------------------------------ */
                const treePanel = document.createElement("div");
                treePanel.style.cssText = `
                    height: 200px;
                    border-top: 1px solid var(--usd-border, #2e2e3a);
                    background: var(--usd-bg-base, #141418);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                `;

                /* Tree toolbar */
                const treeToolbar = document.createElement("div");
                treeToolbar.className = "usd-tree-toolbar";

                const toolbarTitle = document.createElement("span");
                toolbarTitle.className = "usd-tree-toolbar-title";
                toolbarTitle.textContent = "Scene Hierarchy";

                const expandBtn = document.createElement("button");
                expandBtn.className = "comfy-usd-btn";
                expandBtn.textContent = "Expand All";

                const collapseBtn = document.createElement("button");
                collapseBtn.className = "comfy-usd-btn";
                collapseBtn.textContent = "Collapse All";

                treeToolbar.appendChild(toolbarTitle);
                treeToolbar.appendChild(expandBtn);
                treeToolbar.appendChild(collapseBtn);

                /* Tree view container (flex child, fills remaining space) */
                const treeViewContainer = document.createElement("div");
                treeViewContainer.style.cssText = `
                    flex: 1;
                    min-height: 0;
                    overflow: hidden;
                `;

                treePanel.appendChild(treeToolbar);
                treePanel.appendChild(treeViewContainer);

                container.appendChild(viewportContainer);
                container.appendChild(treePanel);

                /* ---- DOM widget ------------------------------------ */
                const widget = this.addDOMWidget("usd_viewer", "HTML", container);
                widget.serializeValue = () => undefined;

                /* ---- Prevent event bubbling ----------------------- */
                const stopBubble = (e) => {
                    e.stopPropagation();
                    if (e.type === "wheel") e.preventDefault();
                };
                ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu'].forEach(ev => {
                    container.addEventListener(ev, stopBubble, { passive: ev !== "wheel" });
                });

                /* ---- Instantiate widgets -------------------------- */
                const viewport = new USDViewport(viewportContainer, {
                    width: NODE_W,
                    height: NODE_H - 200,
                });

                const treeView = new USDTreeView(treeViewContainer, {
                    onPrimSelected: (prim) => {
                        console.log("[USD] Selected prim:", prim.path);
                    },
                });

                expandBtn.addEventListener('click', () => treeView.expandAll());
                collapseBtn.addEventListener('click', () => treeView.collapseAll());

                this.viewport = viewport;
                this.treeView = treeView;
                this.viewportContainer = viewportContainer;
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = async function (message) {
                onExecuted?.apply(this, arguments);

                if (!this.viewport) {
                    console.warn("[USD] Viewport not initialized");
                    return;
                }

                const filePath = message?.usd_info?.[0];
                const usdaText = message?.usda_text?.[0];

                /* Update fetch interceptor base dir */
                const baseFile = filePath;
                if (baseFile) {
                    activeInterceptorBaseDir = baseFile.substring(0, baseFile.lastIndexOf('/')) + '/';
                }

                if (!filePath && !usdaText) return;

                try {
                    /* Load 3-D viewport */
                    await this.viewport.loadUSD(filePath, usdaText);

                    /* Load prim tree - prefers usda_text, falls back to filePath unless it is binary/usdz */
                    const isBinaryOrUsdz = filePath && (filePath.toLowerCase().endsWith('.usdz') || filePath.toLowerCase().endsWith('.usd'));
                    if (isBinaryOrUsdz) {
                        await this.treeView.load(null, filePath);
                    } else {
                        await this.treeView.load(usdaText || null, filePath || null);
                    }
                } catch (error) {
                    console.error("[USD] Failed to load:", error);
                }
            };
        }

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            // Apply custom node category colors for USD suite
            const categoryColors = {
                "3d/USD/IO": { color: "#1a3a3a", bgcolor: "#2d4d4d" },
                "3d/USD/View": { color: "#1e2b4d", bgcolor: "#2c3b5d" },
                "3d/USD/Conversion": { color: "#4d2e1e", bgcolor: "#5d3e2c" },
                "3d/USD/Composition": { color: "#3d1e4d", bgcolor: "#4c2c5d" },
                "3d/USD/Prim": { color: "#1e4d2b", bgcolor: "#2c5d3b" },
                "3d/USD/Attribute": { color: "#1e3d23", bgcolor: "#2c4d32" },
                "3d/USD/Data": { color: "#2d2d30", bgcolor: "#3d3d40" },
                "3d/USD/Scene": { color: "#2d3e4d", bgcolor: "#3d4c5d" }
            };
            const colors = categoryColors[nodeData.category];
            if (colors) {
                this.color = colors.color;
                this.bgcolor = colors.bgcolor;
            }

            // 1. General color picker mapping for widgets named display_color, ending in _color, or of type COLOR
            setTimeout(() => {
                this.widgets?.forEach(w => {
                    if (w.name === "display_color" || w.name.endsWith("_color") || w.type === "COLOR") {
                        w.draw = function(ctx, node, widget_width, y, widget_height) {
                            ctx.save();
                            ctx.fillStyle = "#1e1e1f";
                            ctx.fillRect(15, y, widget_width - 30, widget_height - 4);
                            ctx.fillStyle = this.value || "#ffffff";
                            ctx.fillRect(20, y + 4, 30, widget_height - 12);
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
                });
            }, 100);

            // 2. Mapping for color_r, color_g, color_b float sliders to a single Color Picker
            const hasRGB = this.widgets?.find(w => w.name === "color_r") && 
                           this.widgets?.find(w => w.name === "color_g") && 
                           this.widgets?.find(w => w.name === "color_b");
            
            if (hasRGB) {
                const wR = this.widgets.find(w => w.name === "color_r");
                const wG = this.widgets.find(w => w.name === "color_g");
                const wB = this.widgets.find(w => w.name === "color_b");
                
                wR.type = "converted";
                wG.type = "converted";
                wB.type = "converted";
                
                const rgbToHex = (r, g, b) => {
                    const toHex = (c) => {
                        const hex = Math.round(c * 255).toString(16);
                        return hex.length === 1 ? "0" + hex : hex;
                    };
                    return "#" + toHex(r) + toHex(g) + toHex(b);
                };

                const hexToRgb = (hex) => {
                    const r = parseInt(hex.slice(1, 3), 16) / 255;
                    const g = parseInt(hex.slice(3, 5), 16) / 255;
                    const b = parseInt(hex.slice(5, 7), 16) / 255;
                    return [r, g, b];
                };

                const initialHex = rgbToHex(wR.value ?? 1, wG.value ?? 1, wB.value ?? 1);
                const colorWidget = this.addWidget("button", "color", initialHex, () => {});
                
                colorWidget.draw = function(ctx, node, widget_width, y, widget_height) {
                    ctx.save();
                    ctx.fillStyle = "#1e1e1f";
                    ctx.fillRect(15, y, widget_width - 30, widget_height - 4);
                    ctx.fillStyle = this.value || "#ffffff";
                    ctx.fillRect(20, y + 4, 30, widget_height - 12);
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "10px monospace";
                    ctx.fillText("color: " + this.value, 60, y + 14);
                    ctx.restore();
                };

                colorWidget.mouse = function(event, pos, node) {
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
                            const [r, g, b] = hexToRgb(input.value);
                            wR.value = r;
                            wG.value = g;
                            wB.value = b;
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

        /* ============================================================
           RenderUSD node
           ============================================================ */
        if (nodeData.name === "RenderUSD") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                this.size = [NODE_W, NODE_H];

                /* ---- Root container -------------------------------- */
                const container = document.createElement("div");
                container.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: var(--usd-bg-deep, #0d0d10);
                    position: relative;
                    overflow: hidden;
                `;

                /* ---- 3-D viewport ---------------------------------- */
                const viewportContainer = document.createElement("div");
                viewportContainer.style.cssText = `
                    flex: 1;
                    position: relative;
                    min-height: 200px;
                `;

                /* ---- Render control bar ---------------------------- */
                const controlBar = document.createElement("div");
                controlBar.className = "usd-tree-toolbar";
                
                const barTitle = document.createElement("span");
                barTitle.className = "usd-tree-toolbar-title";
                barTitle.textContent = "Render Pass Viewport";

                const captureBtn = document.createElement("button");
                captureBtn.className = "comfy-usd-btn";
                captureBtn.textContent = "Capture Render";
                
                controlBar.appendChild(barTitle);
                controlBar.appendChild(captureBtn);

                container.appendChild(viewportContainer);
                container.appendChild(controlBar);

                /* ---- DOM widget ------------------------------------ */
                const widget = this.addDOMWidget("usd_renderer", "HTML", container);
                widget.serializeValue = () => undefined;

                /* ---- Prevent event bubbling ----------------------- */
                const stopBubble = (e) => {
                    e.stopPropagation();
                    if (e.type === "wheel") e.preventDefault();
                };
                ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu'].forEach(ev => {
                    container.addEventListener(ev, stopBubble, { passive: ev !== "wheel" });
                });

                /* ---- Instantiate Viewport ------------------------- */
                const viewport = new USDViewport(viewportContainer, {
                    width: NODE_W,
                    height: NODE_H - 40,
                });

                this.viewport = viewport;
                this.viewportContainer = viewportContainer;

                // Recursive helper to traverse upstream to find the USD info/path
                const findUpstreamUSDInfo = (node) => {
                    const usdSlot = node.inputs?.find(inp => inp.type === "USD");
                    if (!usdSlot || usdSlot.link === null) return null;
                    
                    const link = node.graph?.links[usdSlot.link];
                    if (!link) return null;
                    
                    const parentNode = node.graph?.getNodeById(link.origin_id);
                    if (!parentNode) return null;
                    
                    if (parentNode.viewport && parentNode.viewport.currentModelPath) {
                        return {
                            filePath: parentNode.viewport.currentModelPath,
                            usdaText: parentNode.viewport.currentUsdaText
                        };
                    }
                    
                    if (parentNode.last_execution_message) {
                        const path = parentNode.last_execution_message.usd_info?.[0];
                        const text = parentNode.last_execution_message.usda_text?.[0];
                        if (path) return { filePath: path, usdaText: text };
                    }
                    
                    return findUpstreamUSDInfo(parentNode);
                };

                // Sync loaded model from upstream USD nodes
                const syncModelFromUpstream = () => {
                    const upstream = findUpstreamUSDInfo(this);
                    if (upstream && upstream.filePath && upstream.filePath !== this.viewport.currentModelPath) {
                        this.viewport.loadUSD(upstream.filePath, upstream.usdaText).then(() => {
                            setTimeout(() => captureAndUploadRender(this), 300);
                        });
                    }
                };

                // Wire up manual capture button
                const self = this;
                captureBtn.addEventListener('click', () => {
                    syncModelFromUpstream();
                    captureAndUploadRender(self);
                });

                // Wire up dynamic change capture listeners on the canvas
                let debounceTimer = null;
                const triggerDebounce = () => {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        captureAndUploadRender(self);
                    }, 400);
                };

                viewport.renderer.domElement.addEventListener('pointerup', triggerDebounce);
                viewport.renderer.domElement.addEventListener('wheel', triggerDebounce);
                
                // Hook connections change to automatically load upstream model
                const originalConnectionsChange = this.onConnectionsChange;
                this.onConnectionsChange = function() {
                    originalConnectionsChange?.apply(this, arguments);
                    setTimeout(syncModelFromUpstream, 200);
                };

                // Periodically check if upstream model has changed
                const checkInterval = setInterval(syncModelFromUpstream, 2000);
                this.onDestroy = () => {
                    clearInterval(checkInterval);
                };

                // Hide file path inputs in the widget list to keep layout clean
                setTimeout(() => {
                    const hiddenWidgets = ["beauty_file", "depth_file", "normal_file"];
                    this.widgets?.forEach(w => {
                        if (hiddenWidgets.includes(w.name)) {
                            w.type = "converted";
                        }
                    });
                }, 100);
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = async function (message) {
                onExecuted?.apply(this, arguments);

                if (!this.viewport) return;

                this.last_execution_message = message;

                const filePath = message?.usd_info?.[0];
                const usdaText = message?.usda_text?.[0];

                if (filePath) {
                    activeInterceptorBaseDir = filePath.substring(0, filePath.lastIndexOf('/')) + '/';
                }

                if (!filePath && !usdaText) return;

                try {
                    await this.viewport.loadUSD(filePath, usdaText);
                    setTimeout(() => {
                        captureAndUploadRender(this);
                    }, 500);
                } catch (error) {
                    console.error("[USD] Failed to load model for render:", error);
                }
            };
        }

        /* ============================================================
           SetUSDAttribute & GetUSDAttribute - Dynamic Sockets
           ============================================================ */
        if (nodeData.name === "SetUSDAttribute" || nodeData.name === "GetUSDAttribute") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                onNodeCreated?.apply(this, arguments);

                const typeWidget = this.widgets?.find(w => w.name === "attribute_type");
                if (typeWidget) {
                    const self = this;
                    const originalCallback = typeWidget.callback;
                    typeWidget.callback = function(value) {
                        if (originalCallback) {
                            originalCallback.apply(this, arguments);
                        }
                        self.updateUSDType(value);
                    };

                    // Initial sync
                    setTimeout(() => {
                        self.updateUSDType(typeWidget.value);
                    }, 100);
                }
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                onConfigure?.apply(this, arguments);
                const typeWidget = this.widgets?.find(w => w.name === "attribute_type");
                if (typeWidget) {
                    this.updateUSDType(typeWidget.value);
                }
            };

            nodeType.prototype.updateUSDType = function(usdType) {
                if (usdType.endsWith("[]")) {
                    if (nodeData.name === "SetUSDAttribute") {
                        const inputIdx = this.findInputSlot("value");
                        if (inputIdx !== -1) {
                            this.inputs[inputIdx].type = "STRING";
                            this.inputs[inputIdx].label = `value (${usdType} JSON)`;
                        }
                    } else if (nodeData.name === "GetUSDAttribute") {
                        const outputIdx = this.findOutputSlot("value");
                        if (outputIdx !== -1) {
                            this.outputs[outputIdx].type = "STRING";
                            this.outputs[outputIdx].label = `value (${usdType} JSON)`;
                        }
                    }
                    this.setDirtyCanvas(true, true);
                    return;
                }

                const typeMap = {
                    "string": "STRING",
                    "token": "STRING",
                    "asset": "STRING",
                    "bool": "BOOLEAN",
                    "int": "INT",
                    "float": "FLOAT",
                    "double": "FLOAT",
                    "float2": "VEC2",
                    "double2": "VEC2",
                    "float3": "VEC3",
                    "double3": "VEC3",
                    "color3f": "COLOR",
                    "color4f": "COLOR",
                    "point3f": "VEC3",
                    "vector3f": "VEC3",
                    "normal3f": "VEC3",
                    "matrix4d": "MATRIX",
                    "quatf": "VEC4"
                };
                const targetType = typeMap[usdType] || "*";

                if (nodeData.name === "SetUSDAttribute") {
                    const inputIdx = this.findInputSlot("value");
                    if (inputIdx !== -1) {
                        this.inputs[inputIdx].type = targetType;
                        this.inputs[inputIdx].label = `value (${usdType})`;
                    }
                } else if (nodeData.name === "GetUSDAttribute") {
                    const outputIdx = this.findOutputSlot("value");
                    if (outputIdx !== -1) {
                        this.outputs[outputIdx].type = targetType;
                        this.outputs[outputIdx].label = `value (${usdType})`;
                    }
                }
                this.setDirtyCanvas(true, true);
            };
        }
    },
});