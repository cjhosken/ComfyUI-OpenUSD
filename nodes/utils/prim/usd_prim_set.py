import folder_paths

class SetUSDPrimInfo:
    CATEGORY = "3d/USD"
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
        
        usd_path = USD.get("usd_path", "")
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
            return ({"usd_path": usd_path, "usda_text": new_usda_text},)
            
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