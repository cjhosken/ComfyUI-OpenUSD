import folder_paths

class TransformUSDPrim:
    CATEGORY = "3d/USD"
    FUNCTION = "transform_prim"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "transform_type": (["translate", "rotate", "scale"], {"default": "translate"}),
                "operation": (["set", "add", "multiply"], {"default": "set"}),
                "space": (["local", "world"], {"default": "local"}),
                "translation": ("VEC3", {"default": (0.0, 0.0, 0.0), "step": 0.01}),
                "rotation": ("VEC3", {"default": (0.0, 0.0, 0.0), "step": 0.1}),
                "scale": ("VEC3", {"default": (1.0, 1.0, 1.0), "step": 0.01}),
                "pivot_point": ("VEC3", {"default": (0.0, 0.0, 0.0), "step": 0.01}),
                "reset_first": ("BOOLEAN", {"default": False}),
            },
            "optional": {
                "op_suffix": ("STRING", {"default": "", "placeholder": "Optional suffix (e.g., local, world)"}),
                "xform_op_order": ("STRING", {"default": "", "placeholder": "Custom xformOpOrder (comma separated)"}),
            }
        }

    def transform_prim(self, USD, prim_path, transform_type="translate", operation="set", 
                       space="local", op_suffix="", reset_first=False,
                       translation=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), 
                       scale=(1.0, 1.0, 1.0), pivot_point=(0.0, 0.0, 0.0),
                       xform_op_order=""):
        from pxr import Usd, UsdGeom, Gf
        import os
        import uuid
        import math

        usd_path = USD.get("usd_path", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)

        # Use the original USD path if it exists
        if usd_path and os.path.exists(usd_path):
            stage = Usd.Stage.Open(usd_path)
            is_temp = False
        else:
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            stage = Usd.Stage.Open(temp_in)
            usd_path = temp_in
            is_temp = True

        try:
            # Ensure leading slash for prim path
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path

            # Get or create prim
            prim = stage.GetPrimAtPath(prim_path)
            if not prim.IsValid():
                prim = stage.DefinePrim(prim_path, "Xform")
                print(f"[TransformUSDPrim] Created new prim at {prim_path}")

            # Get xformable
            if not prim.IsA(UsdGeom.Xformable):
                try:
                    xformable = UsdGeom.Xformable(prim)
                except:
                    print(f"[TransformUSDPrim] Prim is not xformable")
                    return (USD,)
            else:
                xformable = UsdGeom.Xformable(prim)

            # Convert Vec3 inputs to Gf.Vec3f
            translation_vec = Gf.Vec3f(float(translation[0]), float(translation[1]), float(translation[2]))
            rotation_vec = Gf.Vec3f(
                math.radians(float(rotation[0])),
                math.radians(float(rotation[1])),
                math.radians(float(rotation[2]))
            )
            scale_vec = Gf.Vec3f(float(scale[0]), float(scale[1]), float(scale[2]))
            pivot_vec = Gf.Vec3f(float(pivot_point[0]), float(pivot_point[1]), float(pivot_point[2]))

            # Reset transforms if requested
            if reset_first:
                self.reset_transforms(xformable)

            # Apply pivot point if not at origin
            if pivot_vec != Gf.Vec3f(0, 0, 0):
                self.apply_pivot_transform(xformable, pivot_vec, operation, op_suffix)

            # Apply translation
            if translation_vec != Gf.Vec3f(0, 0, 0):
                self.apply_transform(xformable, "translate", translation_vec, operation, space, op_suffix)
            
            # Apply rotation
            if rotation_vec != Gf.Vec3f(0, 0, 0):
                self.apply_transform(xformable, "rotate", rotation_vec, operation, space, op_suffix)
            
            # Apply scale
            if scale_vec != Gf.Vec3f(1, 1, 1):
                self.apply_transform(xformable, "scale", scale_vec, operation, space, op_suffix)

            # Set xform op order if provided
            if xform_op_order and xform_op_order.strip():
                self.set_xform_op_order(xformable, xform_op_order)

            # Save changes
            stage.GetRootLayer().Save()

            # Get the updated usda text
            new_usda_text = stage.GetRootLayer().ExportToString()

            return ({
                "usd_path": usd_path,
                "usda_text": new_usda_text
            },)

        except Exception as e:
            print(f"[TransformUSDPrim] Error: {e}")
            import traceback
            traceback.print_exc()
            return (USD,)

        finally:
            if is_temp and usd_path and os.path.exists(usd_path):
                try:
                    os.remove(usd_path)
                except:
                    pass

    def reset_transforms(self, xformable):
        """Reset all transforms on the xformable"""
        from pxr import Gf
        
        try:
            xformable.ClearXformOpOrder()
            xformable.AddTransformOp()
            attr = xformable.GetXformOp("transform")
            if attr:
                attr.Set(Gf.Matrix4d(1.0))
        except Exception as e:
            print(f"[TransformUSDPrim] Error resetting transforms: {e}")

    def apply_transform(self, xformable, transform_type, value, operation, space, op_suffix=""):
        """Apply a transform to the xformable"""
        from pxr import UsdGeom, Gf
        
        try:
            # Determine op name
            op_name = transform_type
            if transform_type == "translate":
                op_name = "translate"
            elif transform_type == "rotate":
                op_name = "rotateXYZ"
            elif transform_type == "scale":
                op_name = "scale"
            
            # Add suffix if provided
            suffix = op_suffix if op_suffix else None
            
            # Get existing op or create new one
            attr = xformable.GetXformOp(op_name, suffix)
            if not attr:
                if transform_type == "translate":
                    attr = xformable.AddTranslateOp(UsdGeom.XformOp.PrecisionDouble, suffix)
                elif transform_type == "rotate":
                    attr = xformable.AddRotateXYZOp(UsdGeom.XformOp.PrecisionDouble, suffix)
                elif transform_type == "scale":
                    attr = xformable.AddScaleOp(UsdGeom.XformOp.PrecisionDouble, suffix)
            
            if attr:
                # Get current value
                current_value = attr.Get() or Gf.Vec3f(0, 0, 0)
                
                # Apply operation
                if operation == "set":
                    new_value = value
                elif operation == "add":
                    if transform_type == "scale":
                        new_value = Gf.Vec3f(
                            current_value[0] + value[0] - 1.0,
                            current_value[1] + value[1] - 1.0,
                            current_value[2] + value[2] - 1.0
                        )
                    else:
                        new_value = current_value + value
                elif operation == "multiply":
                    if transform_type == "scale":
                        new_value = Gf.Vec3f(
                            current_value[0] * value[0],
                            current_value[1] * value[1],
                            current_value[2] * value[2]
                        )
                    else:
                        new_value = current_value + value
                else:
                    new_value = value
                
                attr.Set(new_value)
                
        except Exception as e:
            print(f"[TransformUSDPrim] Error applying {transform_type}: {e}")

    def apply_pivot_transform(self, xformable, pivot, operation, op_suffix=""):
        """Apply pivot point transformation"""
        from pxr import UsdGeom, Gf
        
        try:
            # This creates a transform that moves the pivot point
            # For simplicity, we'll add a translate operation for the pivot
            suffix = f"pivot_{op_suffix}" if op_suffix else "pivot"
            attr = xformable.GetXformOp("translate", suffix)
            if not attr:
                attr = xformable.AddTranslateOp(UsdGeom.XformOp.PrecisionDouble, suffix)
            
            if attr:
                if operation == "set":
                    attr.Set(pivot)
                elif operation == "add":
                    current = attr.Get() or Gf.Vec3f(0, 0, 0)
                    attr.Set(current + pivot)
        except Exception as e:
            print(f"[TransformUSDPrim] Error applying pivot: {e}")

    def set_xform_op_order(self, xformable, xform_op_order):
        """Set custom xform op order"""
        from pxr import UsdGeom
        
        try:
            ops = [op.strip() for op in xform_op_order.split(",") if op.strip()]
            if not ops:
                return
            
            xformable.ClearXformOpOrder()
            
            for op_name in ops:
                parts = op_name.split(":", 1)
                op_type = parts[0]
                suffix = parts[1] if len(parts) > 1 else None
                
                if op_type == "translate":
                    xformable.AddTranslateOp(UsdGeom.XformOp.PrecisionDouble, suffix)
                elif op_type == "rotateXYZ":
                    xformable.AddRotateXYZOp(UsdGeom.XformOp.PrecisionDouble, suffix)
                elif op_type == "scale":
                    xformable.AddScaleOp(UsdGeom.XformOp.PrecisionDouble, suffix)
                elif op_type == "transform":
                    xformable.AddTransformOp(UsdGeom.XformOp.PrecisionDouble, suffix)
                    
        except Exception as e:
            print(f"[TransformUSDPrim] Error setting xform op order: {e}")