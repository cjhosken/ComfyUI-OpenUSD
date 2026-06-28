import { app } from "../../../scripts/app.js";
import { USDViewport } from "./components/viewport.js";
import { USDTreeView } from "./components/tree.js";

const NODE_W = 400;
const NODE_H = 480; // Increased height to accommodate tree view

// Global fetch interceptor
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

app.registerExtension({
    name: "USD.Viewer",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // PreviewOpenUSD node
        if (nodeData.name === "PreviewUSD") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                this.size = [NODE_W, NODE_H];
                
                // Create container for split view
                const container = document.createElement("div");
                container.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: #111;
                    position: relative;
                    overflow: hidden;
                `;
                
                // Create viewport container (3D view)
                const viewportContainer = document.createElement("div");
                viewportContainer.style.cssText = `
                    flex: 1;
                    position: relative;
                    min-height: 200px;
                `;
                
                // Create tree container
                const treeContainer = document.createElement("div");
                treeContainer.style.cssText = `
                    height: 150px;
                    border-top: 1px solid #2a2a2e;
                    background: #1a1a1e;
                    display: flex;
                    flex-direction: column;
                `;
                
                // Tree toolbar
                const treeToolbar = document.createElement("div");
                treeToolbar.style.cssText = `
                    display: flex;
                    gap: 4px;
                    padding: 4px 8px;
                    background: #121215;
                    border-bottom: 1px solid #2a2a2e;
                `;
                
                const expandBtn = document.createElement("button");
                expandBtn.className = "comfy-usd-btn";
                expandBtn.textContent = "Expand All";
                expandBtn.style.fontSize = "9px";
                expandBtn.style.padding = "2px 8px";
                
                const collapseBtn = document.createElement("button");
                collapseBtn.className = "comfy-usd-btn";
                collapseBtn.textContent = "Collapse All";
                collapseBtn.style.fontSize = "9px";
                collapseBtn.style.padding = "2px 8px";
                
                treeToolbar.appendChild(expandBtn);
                treeToolbar.appendChild(collapseBtn);
                
                const treeViewContainer = document.createElement("div");
                treeViewContainer.style.cssText = "flex: 1; overflow: hidden;";
                
                treeContainer.appendChild(treeToolbar);
                treeContainer.appendChild(treeViewContainer);
                
                container.appendChild(viewportContainer);
                container.appendChild(treeContainer);
                
                // Create widget
                const widget = this.addDOMWidget("usd_viewer", "HTML", container);
                widget.serializeValue = () => undefined;
                
                // Stop events from bubbling
                const stopBubble = (e) => {
                    e.stopPropagation();
                    if (e.type === "wheel") {
                        e.preventDefault();
                    }
                };
                ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu'].forEach(eventName => {
                    container.addEventListener(eventName, stopBubble, { passive: eventName !== "wheel" });
                });
                
                // Initialize USD Viewport
                const viewport = new USDViewport(viewportContainer, {
                    width: NODE_W,
                    height: NODE_H - 150
                });
                
                // Initialize USD Tree View
                const treeView = new USDTreeView(treeViewContainer, {
                    onPrimSelected: (prim) => {
                        console.log("[USD] Selected prim:", prim);
                        // TODO: Highlight prim in 3D viewport
                    }
                });
                
                // Connect tree toolbar buttons
                expandBtn.addEventListener('click', () => treeView.expandAll());
                collapseBtn.addEventListener('click', () => treeView.collapseAll());
                
                // Store references
                this.viewport = viewport;
                this.treeView = treeView;
                this.viewportContainer = viewportContainer;
                
                // Handle resize
                const ro = new ResizeObserver(() => {
                    viewport.resize();
                });
                ro.observe(viewportContainer);
                
                // Store for cleanup
                this._resizeObserver = ro;
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
                
                // Set interceptor base dir
                const pathWidget = this.widgets?.find(w => w.name === "usd_path");
                const widgetPath = pathWidget?.value || "";
                const baseFile = filePath || widgetPath;
                if (baseFile) {
                    activeInterceptorBaseDir = baseFile.substring(0, baseFile.lastIndexOf('/')) + '/';
                }
                
                if (!filePath && !usdaText) {
                    return;
                }
                
                try {
                    const model = await this.viewport.loadUSD(filePath, usdaText);
                    
                    // Update tree view with model data
                    if (model && model.data) {
                        this.treeView.setData(model.data);
                    }
                } catch (error) {
                    console.error("[USD] Failed to load:", error);
                }
            };
        }
        
        // ApplyUSDMaterial node (unchanged)
        if (nodeData.name === "ApplyUSDMaterial") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                
                const convertToColorPicker = (widgetName) => {
                    const w = this.widgets?.find(x => x.name === widgetName);
                    if (w) {
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
                };

                setTimeout(() => {
                    convertToColorPicker("diffuse_color");
                    convertToColorPicker("emissive_color");
                }, 100);
            };
        }
    }
});