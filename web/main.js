import { app } from "../../../scripts/app.js";
import { USDViewport } from "./widgets/viewport.js";
import { USDTreeView } from "./widgets/tree.js";
import * as THREE from "https://esm.sh/three";

async function captureAndUploadRange(node, startFrame, endFrame) {
    const viewport = node.viewport;
    if (!viewport || !viewport.renderer || !viewport.scene || !viewport.camera) return;
    if (!viewport.currentModel) {
        console.warn("[RenderUSD] No model loaded yet, skipping range capture.");
        return;
    }

    // Freeze screen renders while rendering frame range in background
    viewport.isRenderingOffscreen = true;

    const renderer = viewport.renderer;
    const scene    = viewport.scene;
    const camera   = viewport.camera;

    const wWidth  = node.widgets?.find(w => w.name === "width");
    const wHeight = node.widgets?.find(w => w.name === "height");
    const W = wWidth  ? parseInt(wWidth.value)  || 512 : (viewport.container.clientWidth  || renderer.domElement.clientWidth  || 512);
    const H = wHeight ? parseInt(wHeight.value) || 512 : (viewport.container.clientHeight || renderer.domElement.clientHeight || 512);

    const meshMaterials = [];
    scene.traverse(child => {
        if (child.isMesh) {
            meshMaterials.push({ mesh: child, mat: child.material });
        }
    });

    const getCaptureMaterial = (mesh) => {
        const orig = mesh.userData.originalMaterial;
        if (orig) return orig;
        return new THREE.MeshStandardMaterial({ color: 0x888888 });
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

    const originalFrame = viewport.currentFrame;
    if (node.progressOverlay) {
        node.progressOverlay.style.display = "flex";
        node.progressText.textContent = `Preparing sequence...`;
        node.progressBarFill.style.width = "0%";
    }
    try {
        const beautyFiles = [];
        const depthFiles = [];
        const normalFiles = [];

        const totalFrames = endFrame - startFrame + 1;
        for (let f = startFrame; f <= endFrame; f++) {
            const currentIdx = f - startFrame;
            const pct = Math.round((currentIdx / totalFrames) * 100);
            if (node.progressOverlay) {
                node.progressText.textContent = `Rendering Frame ${f} (${currentIdx + 1} of ${totalFrames})...`;
                node.progressBarFill.style.width = `${pct}%`;
            }

            if (viewport.mixer) {
                viewport.mixer.setTime(f / viewport.fps);
            }
            // Small pause for state update
            await new Promise(r => setTimeout(r, 40));

            // 1. Beauty Pass
            meshMaterials.forEach(({ mesh }) => {
                mesh.visible = true;
                mesh.material = getCaptureMaterial(mesh);
                if (mesh.material) mesh.material.visible = true;
            });
            scene.traverse(child => {
                if (child.userData?.isWireframeHelper) child.visible = false;
            });
            const originalAspect = camera.aspect;
            camera.aspect = W / H;
            camera.updateProjectionMatrix();

            const beautyTarget = new THREE.WebGLRenderTarget(W, H);
            renderer.setRenderTarget(beautyTarget);
            renderer.render(scene, camera);
            const beautyPixels = new Uint8Array(W * H * 4);
            renderer.readRenderTargetPixels(beautyTarget, 0, 0, W, H, beautyPixels);
            renderer.setRenderTarget(null);
            beautyTarget.dispose();

            // Flip Y for texture mapping
            const beautyCanvas = document.createElement('canvas');
            beautyCanvas.width = W;
            beautyCanvas.height = H;
            const beautyCtx = beautyCanvas.getContext('2d');
            const beautyImgData = beautyCtx.createImageData(W, H);
            for (let y = 0; y < H; y++) {
                const srcOffset = (H - 1 - y) * W * 4;
                const destOffset = y * W * 4;
                beautyImgData.data.set(beautyPixels.subarray(srcOffset, srcOffset + W * 4), destOffset);
            }
            beautyCtx.putImageData(beautyImgData, 0, 0);
            const beautyUrl = beautyCanvas.toDataURL ? beautyCanvas.toDataURL('image/png') : beautyCanvas.toDataUrl('image/png');

            // 2. Normal Pass
            const normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
            meshMaterials.forEach(({ mesh }) => {
                mesh.visible = true;
                mesh.material = normalMaterial;
                if (mesh.material) mesh.material.visible = true;
            });
            const normalTarget = new THREE.WebGLRenderTarget(W, H);
            renderer.setRenderTarget(normalTarget);
            renderer.render(scene, camera);
            const normalPixels = new Uint8Array(W * H * 4);
            renderer.readRenderTargetPixels(normalTarget, 0, 0, W, H, normalPixels);
            renderer.setRenderTarget(null);
            normalTarget.dispose();

            const normalCanvas = document.createElement('canvas');
            normalCanvas.width = W;
            normalCanvas.height = H;
            const normalCtx = normalCanvas.getContext('2d');
            const normalImgData = normalCtx.createImageData(W, H);
            for (let y = 0; y < H; y++) {
                const srcOffset = (H - 1 - y) * W * 4;
                const destOffset = y * W * 4;
                normalImgData.data.set(normalPixels.subarray(srcOffset, srcOffset + W * 4), destOffset);
            }
            normalCtx.putImageData(normalImgData, 0, 0);
            const normalUrl = normalCanvas.toDataURL ? normalCanvas.toDataURL('image/png') : normalCanvas.toDataUrl('image/png');

            // 3. Depth Pass
            const originalNear = camera.near;
            const originalFar = camera.far;
            if (viewport.currentModel) {
                const box = new THREE.Box3().setFromObject(viewport.currentModel);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const camDist = camera.position.distanceTo(center);
                const radius = size.length() / 2;
                camera.near = Math.max(0.01, camDist - radius);
                camera.far = camDist + radius;
                camera.updateProjectionMatrix();
            }

            const depthMaterial = new THREE.MeshDepthMaterial();
            meshMaterials.forEach(({ mesh }) => {
                mesh.visible = true;
                mesh.material = depthMaterial;
                if (mesh.material) mesh.material.visible = true;
            });
            const depthTarget = new THREE.WebGLRenderTarget(W, H);
            renderer.setRenderTarget(depthTarget);
            renderer.render(scene, camera);
            const depthPixels = new Uint8Array(W * H * 4);
            renderer.readRenderTargetPixels(depthTarget, 0, 0, W, H, depthPixels);
            renderer.setRenderTarget(null);
            depthTarget.dispose();

            camera.near = originalNear;
            camera.far = originalFar;
            camera.updateProjectionMatrix();

            const depthCanvas = document.createElement('canvas');
            depthCanvas.width = W;
            depthCanvas.height = H;
            const depthCtx = depthCanvas.getContext('2d');
            const depthImgData = depthCtx.createImageData(W, H);
            for (let y = 0; y < H; y++) {
                const srcOffset = (H - 1 - y) * W * 4;
                const destOffset = y * W * 4;
                depthImgData.data.set(depthPixels.subarray(srcOffset, srcOffset + W * 4), destOffset);
            }
            depthCtx.putImageData(depthImgData, 0, 0);
            const depthUrl = depthCanvas.toDataURL ? depthCanvas.toDataURL('image/png') : depthCanvas.toDataUrl('image/png');

            camera.aspect = originalAspect;
            camera.updateProjectionMatrix();

            const beautyFile = await uploadImage(beautyUrl, `beauty_${f}`);
            const depthFile  = await uploadImage(depthUrl,  `depth_${f}`);
            const normalFile = await uploadImage(normalUrl, `normal_${f}`);

            beautyFiles.push(beautyFile);
            depthFiles.push(depthFile);
            normalFiles.push(normalFile);
        }

        const wBeauty = node.widgets?.find(w => w.name === "beauty_file");
        if (wBeauty) wBeauty.value = beautyFiles.join(",");
        const wDepth  = node.widgets?.find(w => w.name === "depth_file");
        if (wDepth)  wDepth.value  = depthFiles.join(",");
        const wNormal = node.widgets?.find(w => w.name === "normal_file");
        if (wNormal) wNormal.value = normalFiles.join(",");

        if (viewport.mixer) {
            viewport.mixer.setTime(originalFrame / viewport.fps);
        }
        viewport.isRenderingOffscreen = false;
        renderer.render(scene, camera);

        console.log("[RenderUSD] Captured range:", { beautyFiles, depthFiles, normalFiles });
        node.setDirtyCanvas(true, true);
    } catch (err) {
        console.error("[RenderUSD] Range render capture failed:", err);
    } finally {
        if (viewport.mixer) {
            viewport.mixer.setTime(originalFrame / viewport.fps);
        }
        meshMaterials.forEach(({ mesh, mat }) => { mesh.material = mat; });
        viewport.isRenderingOffscreen = false;
        renderer.render(scene, camera);
        if (node.progressOverlay) {
            node.progressOverlay.style.display = "none";
        }
    }
}

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

    // Read exact target dimensions from node widgets if present (RenderUSD), falling back to container size (PreviewUSD)
    const wWidth  = node.widgets?.find(w => w.name === "width");
    const wHeight = node.widgets?.find(w => w.name === "height");
    const W = wWidth  ? parseInt(wWidth.value)  || 512 : (viewport.container.clientWidth  || renderer.domElement.clientWidth  || 512);
    const H = wHeight ? parseInt(wHeight.value) || 512 : (viewport.container.clientHeight || renderer.domElement.clientHeight || 512);

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

        // Temporary aspect ratio and tight clipping planes update for camera to auto-normalize depth
        const originalAspect = camera.aspect;
        const originalNear = camera.near;
        const originalFar = camera.far;
        camera.aspect = W / H;
        if (materialOverride instanceof THREE.MeshDepthMaterial && viewport.currentModel) {
            const box = new THREE.Box3().setFromObject(viewport.currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const camDist = camera.position.distanceTo(center);
            const radius = size.length() / 2;
            camera.near = Math.max(0.01, camDist - radius);
            camera.far = camDist + radius;
        }
        camera.updateProjectionMatrix();

        const target = new THREE.WebGLRenderTarget(W, H, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        });

        scene.overrideMaterial = null; // let per-mesh materials drive the pass
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);

        const buf = new Uint8Array(W * H * 4);
        renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);
        renderer.setRenderTarget(null);
        target.dispose();

        // Restore original camera aspect ratio and clipping planes
        camera.aspect = originalAspect;
        camera.near = originalNear;
        camera.far = originalFar;
        camera.updateProjectionMatrix();

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
        const depthUrl  = renderToDataUrl(new THREE.MeshDepthMaterial());

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
                (!init || !init.method || init.method.toUpperCase() === 'GET') &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/extensions/') &&
                !url.pathname.startsWith('/upload/') &&
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
                const usdHash = message?.usd_hash?.[0];
                const frame = message?.frame?.[0] !== undefined ? message.frame[0] : 0;

                /* Update fetch interceptor base dir */
                const baseFile = filePath;
                if (baseFile) {
                    activeInterceptorBaseDir = baseFile.substring(0, baseFile.lastIndexOf('/')) + '/';
                }

                if (!filePath && !usdaText) return;

                const isSameModel = (filePath && this.viewport.currentModelPath === filePath && this.viewport.currentUsdHash === usdHash) ||
                                    (!filePath && usdaText && this.viewport.currentUsdaText === usdaText && this.viewport.currentUsdHash === usdHash);

                try {
                    if (isSameModel) {
                        this.viewport.setFrame(frame);
                    } else {
                        /* Load 3-D viewport */
                        await this.viewport.loadUSD(filePath, usdaText, frame, usdHash);
                    }

                    /* Load prim tree - prefers usdaText if available, falls back to filePath */
                    if (usdaText) {
                        await this.treeView.load(usdaText, filePath || null);
                    } else if (filePath) {
                        await this.treeView.load(null, filePath);
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
                viewportContainer.style.cssText = "flex-grow: 1; position: relative;";

                const progressOverlay = document.createElement("div");
                progressOverlay.className = "usd-progress-overlay";
                progressOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(13, 13, 16, 0.95);
                    backdrop-filter: blur(8px);
                    display: none;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    color: #d1d1db;
                    font-family: sans-serif;
                `;
                
                const progressTitle = document.createElement("div");
                progressTitle.style.cssText = "font-size: 14px; font-weight: 600; margin-bottom: 12px; letter-spacing: 0.5px;";
                progressTitle.textContent = "Rendering Sequence...";
                
                const progressBarBg = document.createElement("div");
                progressBarBg.style.cssText = "width: 70%; height: 6px; background: #22222a; border-radius: 3px; overflow: hidden; margin-bottom: 8px;";
                
                const progressBarFill = document.createElement("div");
                progressBarFill.style.cssText = "width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.1s ease-out; border-radius: 3px;";
                
                const progressText = document.createElement("div");
                progressText.style.cssText = "font-size: 11px; color: #88889c;";
                progressText.textContent = "Initializing...";
                
                progressBarBg.appendChild(progressBarFill);
                progressOverlay.appendChild(progressTitle);
                progressOverlay.appendChild(progressBarBg);
                progressOverlay.appendChild(progressText);
                
                viewportContainer.appendChild(progressOverlay);
                
                this.progressOverlay = progressOverlay;
                this.progressBarFill = progressBarFill;
                this.progressText = progressText;

                container.appendChild(viewportContainer);

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
                    height: NODE_H,
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
                            usdaText: parentNode.viewport.currentUsdaText,
                            usdHash: parentNode.viewport.currentUsdHash
                        };
                    }
                    
                    if (parentNode.last_execution_message) {
                        const path = parentNode.last_execution_message.usd_info?.[0];
                        const text = parentNode.last_execution_message.usda_text?.[0];
                        const hash = parentNode.last_execution_message.usd_hash?.[0];
                        if (path) return { filePath: path, usdaText: text, usdHash: hash };
                    }
                    
                    return findUpstreamUSDInfo(parentNode);
                };

                // Sync loaded model from upstream USD nodes
                const syncModelFromUpstream = () => {
                    const upstream = findUpstreamUSDInfo(this);
                    if (upstream && upstream.filePath) {
                        const hasHashChanged = upstream.usdHash !== this.viewport.currentUsdHash;
                        const hasPathChanged = upstream.filePath !== this.viewport.currentModelPath;
                        if (hasPathChanged || hasHashChanged) {
                            this.viewport.loadUSD(upstream.filePath, upstream.usdaText, null, upstream.usdHash).then(() => {
                                // Capture/upload on connection sync
                                setTimeout(() => captureAndUploadRender(this), 300);
                            });
                        }
                    }
                };

                const self = this;

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

                // Hide file path inputs in the widget list to keep layout clean, and setup render_mode visibility toggles
                setTimeout(() => {
                    const hiddenWidgets = ["beauty_file", "depth_file", "normal_file"];
                    self.widgets?.forEach(w => {
                        if (hiddenWidgets.includes(w.name)) {
                            w.type = "converted";
                        }
                    });

                    // Explicitly remove them from the node's inputs list to avoid showing input sockets
                    hiddenWidgets.forEach(name => {
                        const idx = self.inputs?.findIndex(inp => inp.name === name);
                        if (idx !== undefined && idx !== -1) {
                            self.removeInput(idx);
                        }
                    });

                    const toggleWidgets = () => {
                        const renderModeWidget = self.widgets?.find(w => w.name === "render_mode");
                        if (!renderModeWidget) return;

                        const renderMode = renderModeWidget.value;
                        const frameWidget = self.widgets?.find(w => w.name === "frame");
                        const startFrameWidget = self.widgets?.find(w => w.name === "start_frame");
                        const endFrameWidget = self.widgets?.find(w => w.name === "end_frame");

                        if (frameWidget && startFrameWidget && endFrameWidget) {
                            if (frameWidget.origType === undefined) frameWidget.origType = frameWidget.type;
                            if (startFrameWidget.origType === undefined) startFrameWidget.origType = startFrameWidget.type;
                            if (endFrameWidget.origType === undefined) endFrameWidget.origType = endFrameWidget.type;

                            if (renderMode === "single_frame") {
                                // Show frame
                                frameWidget.type = frameWidget.origType;
                                // Hide start_frame and end_frame
                                startFrameWidget.type = "converted";
                                endFrameWidget.type = "converted";
                            } else if (renderMode === "frame_range") {
                                // Hide frame
                                frameWidget.type = "converted";
                                // Show start_frame and end_frame
                                startFrameWidget.type = startFrameWidget.origType;
                                endFrameWidget.type = endFrameWidget.origType;
                            }
                            
                            self.setSize(self.computeSize());
                            app.canvas.draw(true, true);
                        }
                    };

                    const renderModeWidget = self.widgets?.find(w => w.name === "render_mode");
                    if (renderModeWidget) {
                        const originalCallback = renderModeWidget.callback;
                        renderModeWidget.callback = function(value) {
                            const res = originalCallback ? originalCallback.apply(this, arguments) : value;
                            setTimeout(() => toggleWidgets(), 0);
                            return res;
                        };
                    }

                    const originalOnWidgetChanged = this.onWidgetChanged;
                    this.onWidgetChanged = function(name, value, old_value, widget) {
                        originalOnWidgetChanged?.apply(this, arguments);
                        if (name === "render_mode") {
                            setTimeout(() => toggleWidgets(), 0);
                        }
                    };

                    toggleWidgets();
                }, 100);
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = async function (message) {
                onExecuted?.apply(this, arguments);

                if (!this.viewport) return;

                this.last_execution_message = message;

                const filePath = message?.usd_info?.[0];
                const usdaText = message?.usda_text?.[0];
                const usdHash = message?.usd_hash?.[0];
                const renderMode = message?.render_mode?.[0] || "single_frame";
                const frame = message?.frame?.[0] !== undefined ? message.frame[0] : 0;
                const startFrame = message?.start_frame?.[0] !== undefined ? message.start_frame[0] : 0;
                const endFrame = message?.end_frame?.[0] !== undefined ? message.end_frame[0] : 0;

                if (filePath) {
                    activeInterceptorBaseDir = filePath.substring(0, filePath.lastIndexOf('/')) + '/';
                }

                if (!filePath && !usdaText) return;

                const isSameModel = (filePath && this.viewport.currentModelPath === filePath && this.viewport.currentUsdHash === usdHash) ||
                                    (!filePath && usdaText && this.viewport.currentUsdaText === usdaText && this.viewport.currentUsdHash === usdHash);

                try {
                    if (isSameModel) {
                        if (renderMode === "frame_range") {
                            await captureAndUploadRange(this, startFrame, endFrame);
                        } else {
                            this.viewport.setFrame(frame);
                            setTimeout(() => {
                                captureAndUploadRender(this);
                            }, 100);
                        }
                    } else {
                        await this.viewport.loadUSD(filePath, usdaText, renderMode === "frame_range" ? startFrame : frame, usdHash);
                        if (renderMode === "frame_range") {
                            await captureAndUploadRange(this, startFrame, endFrame);
                        } else {
                            setTimeout(() => {
                                captureAndUploadRender(this);
                            }, 500);
                        }
                    }
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