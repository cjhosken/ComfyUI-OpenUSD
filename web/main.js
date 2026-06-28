import { app } from "../../../scripts/app.js";
import { USDViewport } from "./widgets/viewport.js";
import { USDTreeView } from "./widgets/tree.js";

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

                const filePath = message?.usd_path?.[0];
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

        /* ============================================================
           ApplyUSDMaterial  -  color-picker overlay for hex fields
           ============================================================ */
        if (nodeData.name === "ApplyUSDMaterial") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                const convertToColorPicker = (widgetName) => {
                    const w = this.widgets?.find(x => x.name === widgetName);
                    if (!w) return;

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
                };

                setTimeout(() => {
                    convertToColorPicker("diffuse_color");
                    convertToColorPicker("emissive_color");
                }, 100);
            };
        }
    },
});