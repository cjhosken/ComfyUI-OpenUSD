import folder_paths

class SetUSDPrimInfo:
    CATEGORY = "3d/USD/Prim"
    FUNCTION = "set_info"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_info_json": ("STRING", {"multiline": True}),
                "action": (["overwrite", "merge", "update"], {"default": "merge"}),
            }
        }

    def set_info(self, USD, prim_info_json, action="merge"):
        from pxr import Usd, UsdGeom, Sdf, Tf, Gf
        import json
        import os
        import uuid
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        
        if usd_path and os.path.exists(usd_path):
            # Work directly on the original file
            stage = Usd.Stage.Open(usd_path)
        else:
            # If no valid file path, create a temp file from the usda_text
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            stage = Usd.Stage.Open(temp_in)
            # We'll need to save back to this temp file
            usd_path = temp_in

        try:
            prim_data = json.loads(prim_info_json)
            
            for prim_path, prim_info in prim_data.items():
                # Get or create prim
                prim = stage.GetPrimAtPath(prim_path)
                if not prim.IsValid():
                    prim_type = prim_info.get("type", "Xform")
                    prim = stage.DefinePrim(prim_path, prim_type)
                
                # Set prim info based on action
                self.apply_prim_info(prim, prim_info, action)
            
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_info": usd_path, "usda_text": new_usda_text},)
            
        except Exception as e:
            print(f"Error in SetPrimInfo: {e}")
            # Return original USD on error
            return (USD,)

        finally:
            # Clean up temp file if we created one
            if usd_path and usd_path.startswith(temp_dir) and os.path.exists(usd_path):
                try:
                    os.remove(usd_path)
                except:
                    pass

    def apply_prim_info(self, prim, prim_info, action):
        """Apply information to a USD prim"""
        from pxr import Usd, UsdGeom, Sdf, Tf, Gf
        
        # Set properties
        if "properties" in prim_info and isinstance(prim_info["properties"], dict):
            for prop_name, prop_info in prim_info["properties"].items():
                self.apply_property(prim, prop_name, prop_info, action)
        
        # Set primvars
        if "primvars" in prim_info and isinstance(prim_info["primvars"], dict):
            self.apply_primvars(prim, prim_info["primvars"], action)
        
        # Set relationships
        if "relationships" in prim_info and isinstance(prim_info["relationships"], dict):
            for rel_name, rel_info in prim_info["relationships"].items():
                self.apply_relationship(prim, rel_name, rel_info, action)
        
        # Set metadata - fixed to use correct methods
        if "metadata" in prim_info and isinstance(prim_info["metadata"], dict):
            for field, value in prim_info["metadata"].items():
                if action in ["overwrite", "update"]:
                    try:
                        self.set_prim_metadata(prim, field, value)
                    except Exception as e:
                        print(f"Error setting metadata {field}: {e}")

    def set_prim_metadata(self, prim, field, value):
        """Set metadata on a USD prim using the correct API"""
        from pxr import Usd, Sdf
        
        try:
            # Get the prim spec
            prim_spec = prim.GetPrimSpec()
            if prim_spec:
                # Deserialize the value
                deserialized = self.deserialize_value(value)
                prim_spec.SetField(field, deserialized)
                return
        except:
            pass
        
        # Alternative method using Sdf API
        try:
            layer = prim.GetStage().GetRootLayer()
            prim_path = prim.GetPath()
            prim_spec = layer.GetPrimSpec(prim_path)
            if prim_spec:
                deserialized = self.deserialize_value(value)
                prim_spec.SetField(field, deserialized)
                return
        except:
            pass
        
        # Fallback: try to set using prim methods for common fields
        try:
            if field == 'active':
                if hasattr(prim, 'SetActive'):
                    prim.SetActive(value)
                    return
            elif field == 'kind':
                if hasattr(prim, 'SetKind'):
                    prim.SetKind(str(value))
                    return
            elif field == 'customData':
                if hasattr(prim, 'SetCustomData'):
                    prim.SetCustomData(self.deserialize_value(value))
                    return
        except:
            pass
        
        # If we get here, log the failure
        print(f"Could not set metadata field '{field}' on prim {prim.GetPath()}")

    def apply_property(self, prim, prop_name, prop_info, action):
        """Apply property to prim"""
        from pxr import Sdf
        
        if not isinstance(prop_info, dict):
            return
        
        # Get or create attribute
        attr = prim.GetAttribute(prop_name)
        if not attr.IsValid():
            # Try to create with type from prop_info
            type_name = prop_info.get("type", "string")
            try:
                sdf_type = self.get_sdf_type(type_name)
                attr = prim.CreateAttribute(prop_name, sdf_type)
            except:
                attr = prim.CreateAttribute(prop_name, Sdf.ValueTypeNames.String)
        
        if action in ["overwrite", "update"]:
            # Set value
            if "value" in prop_info and prop_info["value"] is not None:
                try:
                    value = self.deserialize_value(prop_info["value"])
                    attr.Set(value)
                except Exception as e:
                    print(f"Error setting attribute {prop_name}: {e}")
            
            # Set time samples
            if "time_samples" in prop_info and isinstance(prop_info["time_samples"], list):
                for sample in prop_info["time_samples"]:
                    if isinstance(sample, dict) and "time" in sample and "value" in sample:
                        try:
                            time = sample["time"]
                            value = self.deserialize_value(sample["value"])
                            attr.Set(value, time)
                        except Exception as e:
                            print(f"Error setting time sample for {prop_name}: {e}")

    def apply_primvars(self, prim, primvars_info, action):
        """Apply primvars to prim"""
        from pxr import UsdGeom, Sdf
        
        try:
            geom = UsdGeom.Gprim(prim)
        except:
            return
        
        for primvar_name, primvar_info in primvars_info.items():
            if not isinstance(primvar_info, dict):
                continue
            
            if action in ["overwrite", "update"]:
                # Get or create primvar
                primvar = geom.GetPrimvar(primvar_name)
                
                if not primvar:
                    # Create primvar
                    type_name = primvar_info.get("type", "float3")
                    sdf_type = self.get_sdf_type(type_name)
                    interpolation = primvar_info.get("interpolation", "vertex")
                    primvar = geom.CreatePrimvar(primvar_name, sdf_type, interpolation)
                
                # Set value
                if "value" in primvar_info and primvar_info["value"] is not None:
                    try:
                        value = self.deserialize_value(primvar_info["value"])
                        primvar.Set(value)
                    except Exception as e:
                        print(f"Error setting primvar {primvar_name}: {e}")
                
                # Set interpolation
                if "interpolation" in primvar_info:
                    try:
                        primvar.SetInterpolation(primvar_info["interpolation"])
                    except Exception as e:
                        print(f"Error setting interpolation for {primvar_name}: {e}")

    def apply_relationship(self, prim, rel_name, rel_info, action):
        """Apply relationship to prim"""
        from pxr import Sdf
        
        if action in ["overwrite", "update"]:
            rel = prim.GetRelationship(rel_name)
            if not rel:
                rel = prim.CreateRelationship(rel_name)
            
            if "targets" in rel_info and isinstance(rel_info["targets"], list):
                try:
                    targets = [Sdf.Path(t) if not isinstance(t, Sdf.Path) else t for t in rel_info["targets"]]
                    rel.SetTargets(targets)
                except Exception as e:
                    print(f"Error setting relationship targets: {e}")

    def get_sdf_type(self, type_name):
        """Convert type name string to SDF type"""
        from pxr import Sdf
        
        type_map = {
            "string": Sdf.ValueTypeNames.String,
            "float": Sdf.ValueTypeNames.Float,
            "double": Sdf.ValueTypeNames.Double,
            "int": Sdf.ValueTypeNames.Int,
            "bool": Sdf.ValueTypeNames.Bool,
            "token": Sdf.ValueTypeNames.Token,
            "float3": Sdf.ValueTypeNames.Float3,
            "float2": Sdf.ValueTypeNames.Float2,
            "float4": Sdf.ValueTypeNames.Float4,
            "double3": Sdf.ValueTypeNames.Double3,
            "double2": Sdf.ValueTypeNames.Double2,
            "double4": Sdf.ValueTypeNames.Double4,
            "color3f": Sdf.ValueTypeNames.Color3f,
            "color3d": Sdf.ValueTypeNames.Color3d,
            "color4f": Sdf.ValueTypeNames.Color4f,
            "color4d": Sdf.ValueTypeNames.Color4d,
            "point3f": Sdf.ValueTypeNames.Point3f,
            "point3d": Sdf.ValueTypeNames.Point3d,
            "normal3f": Sdf.ValueTypeNames.Normal3f,
            "normal3d": Sdf.ValueTypeNames.Normal3d,
            "matrix4d": Sdf.ValueTypeNames.Matrix4d,
            "matrix4f": Sdf.ValueTypeNames.Matrix4f,
            "quatf": Sdf.ValueTypeNames.Quatf,
            "quatd": Sdf.ValueTypeNames.Quatd,
        }
        return type_map.get(type_name, Sdf.ValueTypeNames.String)

    def deserialize_value(self, value):
        """Convert JSON value back to USD type"""
        from pxr import Gf, Sdf, Tf
        
        if value is None:
            return None
        
        if isinstance(value, (list, tuple)):
            # Try to determine if this is a vector or matrix
            if len(value) == 3:
                try:
                    return Gf.Vec3f(float(value[0]), float(value[1]), float(value[2]))
                except:
                    return Gf.Vec3d(float(value[0]), float(value[1]), float(value[2]))
            elif len(value) == 2:
                try:
                    return Gf.Vec2f(float(value[0]), float(value[1]))
                except:
                    return Gf.Vec2d(float(value[0]), float(value[1]))
            elif len(value) == 4:
                try:
                    return Gf.Vec4f(float(value[0]), float(value[1]), float(value[2]), float(value[3]))
                except:
                    return Gf.Vec4d(float(value[0]), float(value[1]), float(value[2]), float(value[3]))
            else:
                # Generic list
                return [self.deserialize_value(v) for v in value]
        elif isinstance(value, dict):
            return {k: self.deserialize_value(v) for k, v in value.items()}
        elif isinstance(value, str):
            # Check if it looks like a path
            if value.startswith("/"):
                return Sdf.Path(value)
        return value

class SetUSDAttribute:
    CATEGORY = "3d/USD/Attribute"
    FUNCTION = "set_attribute"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        usd_types = [
            "string", "token", "asset", "bool", "int", "float", "double",
            "float2", "float3", "float4", "double2", "double3", "double4",
            "color3f", "color4f", "point3f", "vector3f", "normal3f", "matrix4d", "quatf",
            "string[]", "token[]", "int[]", "float[]", "double[]", "float3[]", "color3f[]", "matrix4d[]"
        ]
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "attribute_name": ("STRING", {"default": "myAttribute"}),
                "attribute_type": (usd_types,),
                "value": ("*",),
            }
        }

    def cast_value_to_usd_type(self, value, type_name):
        from pxr import Gf, Sdf, Tf
        import json
        
        if value is None:
            return None

        # Parse stringified lists/dicts
        if isinstance(value, str):
            val_stripped = value.strip()
            if (val_stripped.startswith("[") and val_stripped.endswith("]")) or (val_stripped.startswith("{") and val_stripped.endswith("}")):
                try:
                    value = json.loads(val_stripped)
                except Exception:
                    pass

        # Handle arrays recursively
        if type_name.isArray:
            element_type = type_name.scalarType
            if not isinstance(value, (list, tuple)):
                value = [value]
            return [self.cast_value_to_usd_type(v, element_type) for v in value]

        # Get C++ or alias type name for classification
        tname = type_name.aliases[0] if type_name.aliases else type_name.cppName

        # 3D Vector types
        if any(x in tname for x in ["Vec3", "Color3", "Point3", "Normal3"]):
            if isinstance(value, (list, tuple)):
                parts = [float(x) for x in value[:3]]
            elif isinstance(value, (int, float)):
                parts = [float(value)] * 3
            elif isinstance(value, str):
                cleaned = value.replace("(", "").replace(")", "")
                parts = [float(x.strip()) for x in cleaned.split(",")]
            else:
                parts = [0.0, 0.0, 0.0]
            while len(parts) < 3:
                parts.append(0.0)
            if "Vec3f" in tname or "Color3f" in tname or "Point3f" in tname or "Normal3f" in tname:
                return Gf.Vec3f(parts[0], parts[1], parts[2])
            else:
                return Gf.Vec3d(parts[0], parts[1], parts[2])

        # 2D Vector types
        if "Vec2" in tname:
            if isinstance(value, (list, tuple)):
                parts = [float(x) for x in value[:2]]
            elif isinstance(value, (int, float)):
                parts = [float(value)] * 2
            elif isinstance(value, str):
                cleaned = value.replace("(", "").replace(")", "")
                parts = [float(x.strip()) for x in cleaned.split(",")]
            else:
                parts = [0.0, 0.0]
            while len(parts) < 2:
                parts.append(0.0)
            if "Vec2f" in tname:
                return Gf.Vec2f(parts[0], parts[1])
            else:
                return Gf.Vec2d(parts[0], parts[1])

        # 4D Vector/Quat types
        if any(x in tname for x in ["Vec4", "Color4", "Quat"]):
            if isinstance(value, (list, tuple)):
                parts = [float(x) for x in value[:4]]
            elif isinstance(value, (int, float)):
                parts = [float(value)] * 4
            elif isinstance(value, str):
                cleaned = value.replace("(", "").replace(")", "")
                parts = [float(x.strip()) for x in cleaned.split(",")]
            else:
                parts = [0.0, 0.0, 0.0, 1.0]
            while len(parts) < 4:
                parts.append(0.0)
            if "Vec4f" in tname or "Color4f" in tname or "Quatf" in tname:
                return Gf.Vec4f(parts[0], parts[1], parts[2], parts[3])
            else:
                return Gf.Vec4d(parts[0], parts[1], parts[2], parts[3])

        # Matrix types
        if "Matrix4" in tname:
            if isinstance(value, (list, tuple)):
                flat = [float(x) for x in value[:16]]
            else:
                flat = [0.0] * 16
            while len(flat) < 16:
                flat.append(0.0)
            if "Matrix4f" in tname:
                return Gf.Matrix4f(*flat)
            else:
                return Gf.Matrix4d(*flat)

        # Basic types
        if type_name == Sdf.ValueTypeNames.Bool:
            if isinstance(value, str):
                return value.lower() in ("true", "1", "yes", "on")
            return bool(value)
        elif type_name in (Sdf.ValueTypeNames.Int, Sdf.ValueTypeNames.Int64, Sdf.ValueTypeNames.UInt, Sdf.ValueTypeNames.UInt64):
            return int(value)
        elif type_name in (Sdf.ValueTypeNames.Float, Sdf.ValueTypeNames.Double, Sdf.ValueTypeNames.Half):
            return float(value)
        elif type_name == Sdf.ValueTypeNames.Token:
            return Tf.Token(str(value).strip())
        elif type_name == Sdf.ValueTypeNames.Asset:
            return Sdf.AssetPath(str(value).strip())

        return str(value)

    def set_attribute(self, USD, prim_path, attribute_name, attribute_type, value):
        from pxr import Usd, Sdf, Gf
        import os
        import uuid
        import fnmatch
        import folder_paths

        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"set_attr_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path

            stage = Usd.Stage.Open(usd_path)

            # Resolve target prims with wildcard matching
            matched_prims = []
            if "*" in prim_path or "?" in prim_path:
                for p in stage.Traverse():
                    if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                        matched_prims.append(p)
            else:
                prim = stage.GetPrimAtPath(prim_path)
                if prim.IsValid():
                    matched_prims.append(prim)
                else:
                    prim = stage.DefinePrim(prim_path, "Xform")
                    matched_prims.append(prim)

            # Map alias type string to Sdf type
            alias_map = {
                "Vec3f": "float3",
                "Vec3d": "double3",
            }
            resolved_type_str = alias_map.get(attribute_type, attribute_type)
            type_name = Sdf.GetValueTypeByName(resolved_type_str)
            if not type_name:
                type_name = Sdf.ValueTypeNames.String

            # Type cast the value
            try:
                typed_val = self.cast_value_to_usd_type(value, type_name)
            except Exception as e:
                print(f"[SetUSDAttribute] Value conversion failed for type {attribute_type}: {e}")
                raise ValueError(f"Failed to convert value to type {attribute_type}: {e}")

            for prim in matched_prims:
                if attribute_name.strip():
                    attr = prim.GetAttribute(attribute_name)
                    if not attr.IsValid():
                        attr = prim.CreateAttribute(attribute_name, type_name)
                    attr.Set(typed_val)

            stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass