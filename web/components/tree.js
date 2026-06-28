export class USDTreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.onPrimSelected = options.onPrimSelected || null;
        this.selectedPrim = null;
        this.currentData = null;
        this.expandedNodes = new Set();
        
        // Create tree container
        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'usd-tree-container';
        this.treeContainer.style.cssText = `
            width: 100%;
            height: 100%;
            overflow: auto;
            background: #1a1a1e;
            color: #d4d4d8;
            font-family: monospace;
            font-size: 12px;
            padding: 8px;
            user-select: none;
        `;
        this.container.appendChild(this.treeContainer);
        
        // Create info panel
        this.infoPanel = document.createElement('div');
        this.infoPanel.className = 'usd-info-panel';
        this.infoPanel.style.cssText = `
            width: 100%;
            max-height: 200px;
            overflow: auto;
            background: #121215;
            border-top: 1px solid #2a2a2e;
            padding: 8px;
            font-family: monospace;
            font-size: 11px;
            color: #a1a1aa;
            display: none;
        `;
        this.container.appendChild(this.infoPanel);
        
        // Apply styles
        this.injectStyles();
    }
    
    injectStyles() {
        const styleId = 'usd-tree-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .usd-tree-node {
                cursor: pointer;
                padding: 2px 0;
                border-radius: 2px;
                transition: background 0.1s;
            }
            .usd-tree-node:hover {
                background: #2a2a2e;
            }
            .usd-tree-node.selected {
                background: #3b82f6;
                color: #ffffff;
            }
            .usd-tree-node .toggle {
                display: inline-block;
                width: 16px;
                text-align: center;
                color: #71717a;
                font-size: 10px;
            }
            .usd-tree-node .toggle.expanded {
                color: #a1a1aa;
            }
            .usd-tree-node .icon {
                display: inline-block;
                width: 16px;
                text-align: center;
                margin-right: 4px;
            }
            .usd-tree-node .prim-name {
                color: #60a5fa;
            }
            .usd-tree-node .prim-type {
                color: #a78bfa;
                font-size: 10px;
                margin-left: 6px;
            }
            .usd-tree-node .attribute-name {
                color: #34d399;
            }
            .usd-tree-node .attribute-value {
                color: #fbbf24;
            }
            .usd-tree-children {
                padding-left: 20px;
            }
            .usd-info-panel .info-row {
                padding: 2px 0;
                border-bottom: 1px solid #1a1a1e;
            }
            .usd-info-panel .info-label {
                color: #71717a;
                display: inline-block;
                min-width: 80px;
            }
            .usd-info-panel .info-value {
                color: #e4e4e7;
            }
            .usd-info-panel .info-section {
                margin: 4px 0;
                color: #a1a1aa;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
    
    setData(modelData) {
        this.currentData = modelData;
        this.expandedNodes.clear();
        this.selectedPrim = null;
        this.renderTree();
    }
    
    renderTree() {
        this.treeContainer.innerHTML = '';
        this.infoPanel.style.display = 'none';
        this.infoPanel.innerHTML = '';
        
        if (!this.currentData) {
            this.treeContainer.innerHTML = '<div style="color: #71717a; text-align: center; padding: 20px;">No USD data loaded</div>';
            return;
        }
        
        // Get prim hierarchy
        const rootPrim = this.currentData.prim || this.currentData.stage?.prim;
        if (!rootPrim) {
            this.treeContainer.innerHTML = '<div style="color: #71717a; text-align: center; padding: 20px;">No primitives found</div>';
            return;
        }
        
        const tree = this.buildPrimTree(rootPrim);
        const rootNode = this.createTreeNode(tree, 0);
        this.treeContainer.appendChild(rootNode);
    }
    
    buildPrimTree(prim) {
        const children = prim.children || prim.getChildren?.() || [];
        return {
            name: prim.name || prim.path || '/',
            path: prim.path || prim.name || '/',
            type: prim.type || 'Prim',
            children: children.map(child => this.buildPrimTree(child)),
            attributes: prim.attributes || prim.getAttributes?.() || {}
        };
    }
    
    createTreeNode(node, depth) {
        const div = document.createElement('div');
        div.className = 'usd-tree-node';
        div.style.paddingLeft = `${depth * 4}px`;
        
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = this.expandedNodes.has(node.path);
        
        // Toggle button
        const toggle = document.createElement('span');
        toggle.className = `toggle ${isExpanded ? 'expanded' : ''}`;
        toggle.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '•';
        toggle.style.opacity = hasChildren ? '1' : '0.3';
        
        // Icon
        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = this.getPrimIcon(node.type);
        
        // Name
        const name = document.createElement('span');
        name.className = 'prim-name';
        name.textContent = node.name;
        
        // Type
        const type = document.createElement('span');
        type.className = 'prim-type';
        type.textContent = node.type;
        
        // Container for prim info
        const primInfo = document.createElement('span');
        primInfo.appendChild(name);
        primInfo.appendChild(type);
        
        // Build node
        div.appendChild(toggle);
        div.appendChild(icon);
        div.appendChild(primInfo);
        
        // Click handler
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectPrim(node, div);
            
            if (hasChildren) {
                this.toggleNode(node, div);
            }
        });
        
        // Children container
        if (hasChildren) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'usd-tree-children';
            childrenDiv.style.display = isExpanded ? 'block' : 'none';
            
            node.children.forEach(child => {
                childrenDiv.appendChild(this.createTreeNode(child, depth + 1));
            });
            
            div.appendChild(childrenDiv);
        }
        
        return div;
    }
    
    getPrimIcon(type) {
        const icons = {
            'Xform': '📐',
            'Mesh': '🔺',
            'Camera': '📷',
            'Light': '💡',
            'Material': '🎨',
            'Shader': '🖌️',
            'Scope': '📁',
            'GeomSubset': '📐',
            'SkelRoot': '🦴',
            'Skeleton': '🦴',
            'SkinnedMesh': '🔺',
            'default': '📄'
        };
        return icons[type] || icons.default;
    }
    
    toggleNode(node, element) {
        const path = node.path;
        if (this.expandedNodes.has(path)) {
            this.expandedNodes.delete(path);
        } else {
            this.expandedNodes.add(path);
        }
        
        // Update toggle icon
        const toggle = element.querySelector('.toggle');
        const children = element.querySelector('.usd-tree-children');
        if (children) {
            const isExpanded = this.expandedNodes.has(path);
            toggle.textContent = isExpanded ? '▼' : '▶';
            children.style.display = isExpanded ? 'block' : 'none';
        }
    }
    
    selectPrim(node, element) {
        // Clear previous selection
        if (this.selectedPrim) {
            const prevSelected = this.treeContainer.querySelector('.selected');
            if (prevSelected) {
                prevSelected.classList.remove('selected');
            }
        }
        
        this.selectedPrim = node;
        element.classList.add('selected');
        
        // Show info panel
        this.showPrimInfo(node);
        
        // Trigger callback
        if (this.onPrimSelected) {
            this.onPrimSelected(node);
        }
    }
    
    showPrimInfo(node) {
        this.infoPanel.style.display = 'block';
        this.infoPanel.innerHTML = '';
        
        // Prim info section
        const primSection = document.createElement('div');
        primSection.className = 'info-section';
        primSection.textContent = 'Prim Properties';
        this.infoPanel.appendChild(primSection);
        
        const pathRow = this.createInfoRow('Path', node.path);
        this.infoPanel.appendChild(pathRow);
        
        const typeRow = this.createInfoRow('Type', node.type);
        this.infoPanel.appendChild(typeRow);
        
        // Attributes section
        if (node.attributes && Object.keys(node.attributes).length > 0) {
            const attrSection = document.createElement('div');
            attrSection.className = 'info-section';
            attrSection.textContent = 'Attributes';
            this.infoPanel.appendChild(attrSection);
            
            Object.entries(node.attributes).forEach(([key, value]) => {
                const row = this.createInfoRow(key, JSON.stringify(value));
                this.infoPanel.appendChild(row);
            });
        }
        
        // Children count
        if (node.children && node.children.length > 0) {
            const childrenRow = this.createInfoRow('Children', `${node.children.length} prims`);
            this.infoPanel.appendChild(childrenRow);
        }
    }
    
    createInfoRow(label, value) {
        const row = document.createElement('div');
        row.className = 'info-row';
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'info-label';
        labelSpan.textContent = label + ':';
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'info-value';
        valueSpan.textContent = value;
        
        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        
        return row;
    }
    
    getSelectedPrim() {
        return this.selectedPrim;
    }
    
    expandAll() {
        // Collect all paths
        const collectPaths = (node) => {
            this.expandedNodes.add(node.path);
            if (node.children) {
                node.children.forEach(child => collectPaths(child));
            }
        };
        
        if (this.currentData) {
            const rootPrim = this.currentData.prim || this.currentData.stage?.prim;
            if (rootPrim) {
                const tree = this.buildPrimTree(rootPrim);
                collectPaths(tree);
                this.renderTree();
            }
        }
    }
    
    collapseAll() {
        this.expandedNodes.clear();
        this.renderTree();
    }
}