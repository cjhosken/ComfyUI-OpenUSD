/**
 * USDTreeView – fetches the full prim hierarchy from /usd/prims
 * and renders it as a collapsible, styled tree.
 */
export class USDTreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.onPrimSelected = options.onPrimSelected || null;

        this.selectedPath = null;
        this.expandedPaths = new Set();
        this.primRoot = null;          // raw JSON from /usd/prims
        this.currentFilePath = null;

        this._buildShell();
    }

    /* ------------------------------------------------------------------ */
    /* DOM shell                                                            */
    /* ------------------------------------------------------------------ */

    _buildShell() {
        this.container.style.cssText = `
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: var(--usd-bg-base, #141418);
        `;

        // Tree scroll area
        this.treeScroll = document.createElement('div');
        this.treeScroll.className = 'usd-tree-container';
        this.treeScroll.style.cssText = `
            flex: 1;
            overflow: auto;
            min-height: 0;
        `;
        this._showEmpty('No USD data loaded');

        // Attributes panel (shown on selection)
        this.attrPanel = document.createElement('div');
        this.attrPanel.className = 'usd-info-panel';
        this.attrPanel.style.maxHeight = '130px';

        this.container.appendChild(this.treeScroll);
        this.container.appendChild(this.attrPanel);
    }

    /* ------------------------------------------------------------------ */
    /* Public API                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Load the prim tree.
     * Prefers usdaText (POST) over filePath (GET).
     * @param {string|null} usdaText  - raw USDA content, or null
     * @param {string|null} filePath  - absolute server-side path, or null
     */
    async load(usdaText, filePath) {
        this.selectedPath = null;
        this.expandedPaths.clear();
        this.attrPanel.style.display = 'none';
        this.attrPanel.innerHTML = '';
        this._showEmpty('Loading stage\u2026');

        try {
            let res;
            if (usdaText) {
                res = await fetch('/usd/prims', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: usdaText,
                });
            } else if (filePath) {
                res = await fetch(`/usd/prims?filename=${encodeURIComponent(filePath)}`);
            } else {
                this._showEmpty('No USD data available');
                return;
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            this.primRoot = await res.json();
            this._autoExpand(this.primRoot, 0, 2);
            this._renderTree();
        } catch (err) {
            console.warn('[USDTreeView] /usd/prims failed:', err);
            this._showEmpty(`Could not load prim data: ${err.message}`);
        }
    }

    /** Legacy compat – if the caller only has model.data from Three loader */
    setData(modelData) {
        // If a file path was already set via loadFromPath, prefer that
        if (this.currentFilePath) return;

        // Fallback: try to extract something useful from model.data
        console.warn('[USDTreeView] setData() called without a file path – prim data may be limited');
        this._showEmpty('Set a USD file path to see full prim data');
    }

    expandAll() {
        if (!this.primRoot) return;
        const collect = (node) => {
            this.expandedPaths.add(node.path);
            (node.children || []).forEach(collect);
        };
        collect(this.primRoot);
        this._renderTree();
    }

    collapseAll() {
        this.expandedPaths.clear();
        this._renderTree();
    }

    /* ------------------------------------------------------------------ */
    /* Internal rendering                                                   */
    /* ------------------------------------------------------------------ */

    _autoExpand(node, depth, maxDepth) {
        if (depth >= maxDepth) return;
        this.expandedPaths.add(node.path);
        (node.children || []).forEach(c => this._autoExpand(c, depth + 1, maxDepth));
    }

    _showEmpty(msg) {
        this.treeScroll.innerHTML = `<div class="usd-empty-msg">${msg}</div>`;
    }

    _renderTree() {
        this.treeScroll.innerHTML = '';
        if (!this.primRoot) {
            this._showEmpty('No USD data loaded');
            return;
        }
        const frag = document.createDocumentFragment();
        this._appendNode(frag, this.primRoot, 0);
        this.treeScroll.appendChild(frag);
    }

    _appendNode(parent, node, depth) {
        const hasChildren = (node.children || []).length > 0;
        const isExpanded = this.expandedPaths.has(node.path);

        /* Row */
        const row = document.createElement('div');
        row.className = 'usd-tree-row' + (this.selectedPath === node.path ? ' selected' : '');
        row.style.paddingLeft = `${depth * 14 + 4}px`;
        row.dataset.path = node.path;

        /* Toggle arrow */
        const toggle = document.createElement('span');
        toggle.className = 'usd-tree-toggle';
        if (hasChildren) {
            toggle.textContent = isExpanded ? '▾' : '▸';
            toggle.style.cursor = 'pointer';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggle(node.path);
            });
        } else {
            toggle.textContent = '·';
            toggle.style.opacity = '0.3';
        }

        /* Icon */
        const icon = document.createElement('span');
        icon.className = 'usd-tree-icon';
        icon.textContent = _primIcon(node.type);

        /* Name */
        const label = document.createElement('span');
        label.className = 'usd-tree-label';
        label.textContent = node.name;

        /* Type badge */
        const typeBadge = document.createElement('span');
        typeBadge.className = 'usd-tree-type';
        typeBadge.textContent = node.type || '';

        /* Inactive dimming */
        if (node.active === false) {
            row.style.opacity = '0.45';
        }

        row.appendChild(toggle);
        row.appendChild(icon);
        row.appendChild(label);
        row.appendChild(typeBadge);

        row.addEventListener('click', () => this._select(node));
        parent.appendChild(row);

        /* Children */
        if (hasChildren && isExpanded) {
            const childWrap = document.createElement('div');
            childWrap.className = 'usd-tree-children';
            node.children.forEach(child => this._appendNode(childWrap, child, depth + 1));
            parent.appendChild(childWrap);
        }
    }

    _toggle(path) {
        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
        }
        this._renderTree();
    }

    _select(node) {
        this.selectedPath = node.path;
        this._renderTree();
        this._showAttrs(node);
        if (this.onPrimSelected) this.onPrimSelected(node);
    }

    /* ------------------------------------------------------------------ */
    /* Attributes panel                                                     */
    /* ------------------------------------------------------------------ */

    _showAttrs(node) {
        this.attrPanel.style.display = 'block';
        this.attrPanel.innerHTML = '';

        // Path / Type header
        this._section(this.attrPanel, 'Prim');
        this._attrRow(this.attrPanel, 'path', 'string', node.path);
        this._attrRow(this.attrPanel, 'type', 'string', node.type || 'Prim');
        this._attrRow(this.attrPanel, 'active', 'bool', String(node.active !== false));

        // Attributes
        const attrs = node.attributes || {};
        const attrKeys = Object.keys(attrs);
        if (attrKeys.length > 0) {
            this._section(this.attrPanel, 'Attributes');
            attrKeys.forEach(key => {
                const a = attrs[key];
                this._attrRow(
                    this.attrPanel,
                    key,
                    a.type || '',
                    _fmtVal(a.value)
                );
            });
        }

        // Children count
        const childCount = (node.children || []).length;
        if (childCount > 0) {
            this._section(this.attrPanel, 'Hierarchy');
            this._attrRow(this.attrPanel, 'children', 'int', String(childCount));
        }
    }

    _section(parent, title) {
        const s = document.createElement('div');
        s.className = 'usd-attr-section-title';
        s.textContent = title;
        parent.appendChild(s);
    }

    _attrRow(parent, name, type, value) {
        const row = document.createElement('div');
        row.className = 'usd-attr-row';

        const n = document.createElement('span');
        n.className = 'usd-attr-name';
        n.textContent = name;
        n.title = name;

        const t = document.createElement('span');
        t.className = 'usd-attr-type';
        t.textContent = type;

        const v = document.createElement('span');
        v.className = 'usd-attr-value';
        v.textContent = value;
        v.title = value;

        row.appendChild(n);
        row.appendChild(t);
        row.appendChild(v);
        parent.appendChild(row);
    }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function _primIcon(type) {
    const map = {
        Stage:        '🗂',
        Xform:        '⬡',
        Mesh:         '⬟',
        Camera:       '📷',
        SphereLight:  '💡',
        RectLight:    '💡',
        DiskLight:    '💡',
        DistantLight: '☀',
        DomeLight:    '🌐',
        Light:        '💡',
        Material:     '🎨',
        Shader:       '🖌',
        Scope:        '📂',
        GeomSubset:   '▦',
        SkelRoot:     '🦴',
        Skeleton:     '🦴',
        SkelAnimation:'▶',
        PointInstancer:'⬡',
        Capsule:      '⬯',
        Sphere:       '●',
        Cube:         '⬛',
        Cylinder:     '⬬',
        Cone:         '△',
        Plane:        '▭',
    };
    return map[type] || '◆';
}

function _fmtVal(val) {
    if (val === null || val === undefined) return '—';
    if (Array.isArray(val)) {
        // Truncate long arrays
        if (val.length > 6) {
            return `[${val.slice(0, 6).join(', ')}, … (${val.length})]`;
        }
        return `[${val.join(', ')}]`;
    }
    return String(val);
}