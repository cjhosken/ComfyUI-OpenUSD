# ComfyUI-USD

<p align="center">
  <img src="./banner.jpg" alt="ComfyUI-USD Banner" width="100%">
</p>

<p align="center">
  <img src="./icon.png" alt="USD Logo" width="80" height="80">
  <br>
  <strong>An OpenUSD integration for ComfyUI</strong>
</p>

<p align="center">
  <a href="#features--nodes">Features</a> •
  <a href="#node-reference">Node Reference</a> •
  <a href="#installation--dependencies">Installation</a> •
  <a href="#workflows">Workflows</a>
</p>

---

Bring the power of Pixar's **Universal Scene Description (OpenUSD)** directly into your ComfyUI node canvas. This extension allows you to seamlessly convert, edit, and visualize 3D assets entirely in pure Python, bypassing the need for heavy external DCC (Digital Content Creation) software.

### 🚀 Key Capabilities
* **Pure Python Architecture:** Convert standard `.gltf`/`.glb` files to `.usd`, `.usda`, `.usdc`, or `.usdz` formats cleanly.
* **Live USDA Text Editing:** Inspect and manipulate ASCII USD code directly within a native ComfyUI web interface widget.
* **Interactive 3D Viewport:** Preview your USD assets on your canvas using a fast, hardware-accelerated local 3D viewer.

---

## Installation & Dependencies

This plugin requires a Python environment bundled with Pixar's `usd-core`, `usd2gltf`, and `trimesh`.

### 1. Clone the Node
Navigate to your ComfyUI installation and clone this repository into your `custom_nodes` directory:
```bash
cd /path/to/ComfyUI/custom_nodes
git clone [https://github.com/your-username/ComfyUI-USD](https://github.com/your-username/ComfyUI-USD)