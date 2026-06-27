# ComfyUI-USD

An OpenUSD integration for ComfyUI. This extension adds nodes to convert 3D models (glTF/GLB) to USD/USDA/USDC/USDZ formats in pure Python, visualize USD models or USDA text interactively on the node canvas, and edit USDA text representation directly in the ComfyUI web interface.

---

## Features & Nodes

### 1. **GLTF to USD Converter** (`GLTF to USD Converter`)
- **Category**: `USD`
- **Inputs**:
  - `gltf_path` (Required): String path to the `.gltf` or `.glb` model.
  - `format` (Required): Choose `usdz`, `usda`, `usdc`, or `usd`.
  - `usd_path` (Optional): Target save path. If left empty, it will save in the same directory as the input file.
- **Outputs**:
  - `usd_path`: The file path to the generated USD asset.
- **Under the hood**: Uses `trimesh` and the Pixar `usd-core` Python library to translate geometry (mesh points, indices, normals, texture coordinates), transform hierarchy, and base PBR materials (mapping diffuse, metallic/roughness, and normal textures to standard `UsdPreviewSurface` networks).

### 2. **USD Loader** (`USD Loader`)
- **Category**: `USD`
- **Inputs**:
  - `usd_path` (Required): String path to the USD file.
- **Outputs**:
  - `usda_text`: String containing the ASCII/USDA representation of the USD stage.

### 3. **USD Editor** (`USD Editor`)
- **Category**: `USD`
- **Inputs**:
  - `usda_text` (Required): Text area for manual USDA editing.
  - `usda_text_input` (Optional, Link Input): Connect a USDA text output (e.g. from `USD Loader`) to feed text directly into the editor.
- **Outputs**:
  - `usda_text`: The edited USDA source code string.
- **Under the hood**: Automatically syncs the incoming text link value to populate the text area widget upon execution. To edit, run once to load the text, disconnect the input link, make your manual edits, and run again.

### 4. **USD Writer** (`USD Writer`)
- **Category**: `USD`
- **Inputs**:
  - `usda_text` (Required): String containing the ASCII/USDA source code (uses multiline text input).
  - `usd_path` (Required): Save path for the USD model.
- **Outputs**:
  - `usd_path`: The saved USD file path.
- **Under the hood**: Writes the USDA source text and compiles/packages it to `.usd`, `.usdc`, or `.usdz` packages depending on the output extension.

### 5. **USD 3D Viewer** (`USD 3D Viewer`)
- **Category**: `USD`
- **Inputs**:
  - `auto_rotate` (Required): Boolean flag to toggle automatic turntable camera rotation.
  - `shadows` (Required): Boolean flag to toggle shadow mapping in the viewport.
  - `usd_path` (Optional): Path to a USD file to render.
  - `usda_text` (Optional, Link Input): USDA text string to render. Takes precedence if provided.
- **Outputs**:
  - `usd_path`: Passes the input file path down the graph.
- **Under the hood**: If USDA text is provided, it temporarily compiles it. Converts the USD model to a GLB file (using the fast `usd2gltf` package) and feeds it to an embedded Google `<model-viewer>` component inside a custom DOM widget. Supports offline loading by caching the model-viewer source code locally.

---

## Installation & Dependencies

This plugin requires a Python environment with `usd-core`, `usd2gltf`, and `trimesh` installed.

1. Clone this repository into your ComfyUI `custom_nodes` directory:
   ```bash
   cd /path/to/ComfyUI/custom_nodes
   git clone https://github.com/your-username/ComfyUI-USD
   ```
   *(Or symlink it from `/home/cjhosken/dev/ComfyUI-USD`)*

2. Install the Python dependencies into your ComfyUI virtual environment:
   ```bash
   /path/to/ComfyUI/.venv/bin/pip install usd-core usd2gltf trimesh numpy Pillow
   ```

3. Restart ComfyUI. The model-viewer library will automatically download to `js/model-viewer.min.js` on startup for offline compatibility.
