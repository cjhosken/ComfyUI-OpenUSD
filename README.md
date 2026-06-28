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

## Node Reference

### 🛠️ GLTF to USD Converter
Translates standard 3D meshes, transform hierarchies, and basic PBR materials into standard `UsdPreviewSurface` networks.
* **Category:** `USD`
* **Inputs:**
  * `gltf_path` *(Required)*: String path to the `.gltf` or `.glb` model.
  * `format` *(Required)*: Toggle between `usdz`, `usda`, `usdc`, or `usd`.
  * `usd_path` *(Optional)*: Target save path. Defaults to the input file's directory if left blank.
* **Outputs:**
  * `usd_path`: File path to the newly generated USD asset.

### 📖 USD Loader
Reads a USD stage and exposes its underlying layout for downstream modifications.
* **Category:** `USD`
* **Inputs:**
  * `usd_path` *(Required)*: String path to the target USD file.
* **Outputs:**
  * `usda_text`: String containing the ASCII/USDA representation of the scene.

### ✏️ USD Editor
A dynamic text interface designed for modifying scene data or injecting custom USD logic.
* **Category:** `USD`
* **Inputs:**
  * `usda_text` *(Required)*: Dedicated multi-line text field for raw ASCII overrides.
  * `usda_text_input` *(Optional, Link Input)*: Pass a USDA string directly from another node (like the *USD Loader*).
* **Outputs:**
  * `usda_text`: The finalized, edited USDA source code string.
> 💡 **Tip:** To edit existing nodes, run the graph once to fetch the text, disconnect the `usda_text_input` link, apply your manual adjustments, and execute again.

### 💾 USD Writer
Compiles text layers back into fully optimized binary or packaged USD containers.
* **Category:** `USD`
* **Inputs:**
  * `usda_text` *(Required)*: Raw USDA text string to compile.
  * `usd_path` *(Required)*: Target destination file path.
* **Outputs:**
  * `usd_path`: Path to the compiled `.usd`, `.usdc`, or `.usdz` asset.

### 👁️ USD 3D Viewer
An embedded web viewport that renders your 3D compositions directly inside the ComfyUI UI. 
* **Category:** `USD`
* **Inputs:**
  * `auto_rotate` *(Required)*: Boolean switch for turntable camera rotation.
  * `shadows` *(Required)*: Boolean switch to toggle shadow mapping.
  * `usd_path` *(Optional)*: Renders a USD file from a disk path.
  * `usda_text` *(Optional, Link Input)*: Instantly compiles and visualizes live ASCII code. (Takes priority over `usd_path`).
* **Outputs:**
  * `usd_path`: Relays the input file path down the graph pipeline.
* **Under the Hood:** Behind the scenes, it leverages `usd2gltf` to feed an offline-cached Google `<model-viewer>` component.

---

## Installation & Dependencies

This plugin requires a Python environment bundled with Pixar's `usd-core`, `usd2gltf`, and `trimesh`.

### 1. Clone the Node
Navigate to your ComfyUI installation and clone this repository into your `custom_nodes` directory:
```bash
cd /path/to/ComfyUI/custom_nodes
git clone [https://github.com/your-username/ComfyUI-USD](https://github.com/your-username/ComfyUI-USD)