import folder_paths

class GetUSDPrimInfo:
    CATEGORY = "3d/USD"
    FUNCTION = "get_info"
    RETURN_TYPES = ("USD", "STRING",)
    RETURN_NAMES = ("USD", "prim_info_json",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "include_children": ("BOOLEAN", {"default": False}),
                "include_properties": ("BOOLEAN", {"default": True}),
                "include_primvars": ("BOOLEAN", {"default": True}),
                "include_relationships": ("BOOLEAN", {"default": False}),
                "include_metadata": ("BOOLEAN", {"default": False}),
            }
        }

    def get_info(self, USD, prim_path, include_children=False, include_properties=True, 
                 include_primvars=True, include_relationships=False, include_metadata=False):
        from pxr import Usd, UsdGeom, Sdf, Tf
        import json
        import os
        import fnmatch
        import uuid
        
        usd_path = USD.get("usd_path", "")
        usda_text = USD.get("usda_text", "")
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            stage = Usd.Stage.Open(usd_path)
            
            # Ensure leading slash for prim path
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path
            
            # Handle wildcards
            prims_to_process = []
            if "*" in prim_path or "?" in prim_path:
                for p in stage.Traverse():
                    if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                        prims_to_process.append(p)
            else:
                prim = stage.GetPrimAtPath(prim_path)
                if prim.IsValid():
                    prims_to_process.append(prim)
                else:
                    raise ValueError(f"Prim '{prim_path}' not found in USD stage")
            
            result = {}
            
            for prim in prims_to_process:
                prim_info = self.extract_prim_info(
                    prim, 
                    include_children=include_children,
                    include_properties=include_properties,
                    include_primvars=include_primvars,
                    include_relationships=include_relationships,
                    include_metadata=include_metadata
                )
                result[str(prim.GetPath())] = prim_info
            
            # Convert to JSON
            json_str = json.dumps(result, indent=2, default=self.json_serializer)
            
            return (USD, json_str,)
            
        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

    def extract_prim_info(self, prim, include_children=False, include_properties=True,
                         include_primvars=True, include_relationships=False, include_metadata=False):
        """Extract all information from a USD prim"""
        from pxr import Usd, UsdGeom, Sdf, Tf
        
        info = {
            "path": str(prim.GetPath()),
            "name": prim.GetName(),
            "type": prim.GetTypeName(),
            "specifier": str(prim.GetSpecifier()),
        }
        
        # Get properties (attributes)
        if include_properties:
            properties = {}
            for attr in prim.GetAttributes():
                try:
                    attr_info = self.extract_attr_info(attr)
                    if attr_info:
                        properties[attr.GetName()] = attr_info
                except Exception as e:
                    print(f"Error extracting attribute {attr.GetName()}: {e}")
            
            info["properties"] = properties
        
        # Get primvars
        if include_primvars:
            primvars = {}
            try:
                if hasattr(prim, 'IsA') and (prim.IsA(UsdGeom.Gprim) or prim.IsA(UsdGeom.Mesh)):
                    geom = UsdGeom.Gprim(prim)
                    if hasattr(geom, 'GetPrimvars'):
                        for primvar in geom.GetPrimvars():
                            try:
                                primvar_name = primvar.GetName()
                                primvars[primvar_name] = self.extract_primvar_info(primvar)
                            except Exception as e:
                                print(f"Error extracting primvar: {e}")
                    else:
                        # Alternative method
                        for attr in prim.GetAttributes():
                            attr_name = attr.GetName()
                            if attr_name.startswith('primvars:'):
                                try:
                                    primvars[attr_name] = self.extract_attr_info(attr)
                                except Exception as e:
                                    print(f"Error extracting primvar attr {attr_name}: {e}")
            except Exception as e:
                print(f"Error getting primvars: {e}")
            
            if primvars:
                info["primvars"] = primvars
        
        # Get relationships - fixed to use only available methods
        if include_relationships:
            relationships = {}
            for rel in prim.GetRelationships():
                try:
                    rel_info = {
                        "name": rel.GetName(),
                        "targets": [str(t) for t in rel.GetTargets()],
                        "has_authored_targets": rel.HasAuthoredTargets(),
                    }
                    
                    # Only add if method exists
                    if hasattr(rel, 'GetForwardTargets'):
                        try:
                            rel_info["forward_targets"] = [str(t) for t in rel.GetForwardTargets()]
                        except:
                            pass
                    
                    if hasattr(rel, 'GetResolvedTargets'):
                        try:
                            rel_info["resolved_targets"] = [str(t) for t in rel.GetResolvedTargets()]
                        except:
                            pass
                    
                    relationships[rel.GetName()] = rel_info
                except Exception as e:
                    print(f"Error extracting relationship {rel.GetName()}: {e}")
            
            if relationships:
                info["relationships"] = relationships
        
        # Get metadata
        if include_metadata:
            metadata = self.extract_prim_metadata(prim)
            if metadata:
                info["metadata"] = metadata
        
        # Get children
        if include_children:
            children = []
            for child in prim.GetChildren():
                child_info = self.extract_prim_info(
                    child,
                    include_children=True,
                    include_properties=include_properties,
                    include_primvars=include_primvars,
                    include_relationships=include_relationships,
                    include_metadata=include_metadata
                )
                children.append(child_info)
            info["children"] = children
        
        return info

    def extract_prim_metadata(self, prim):
        """Extract metadata from a USD prim"""
        from pxr import Sdf, Tf
        
        metadata = {}
        
        try:
            # Get the prim's spec
            prim_spec = prim.GetPrimSpec()
            if prim_spec:
                for field_name in prim_spec.GetFields():
                    try:
                        field_value = prim_spec.GetField(field_name)
                        if field_value is not None:
                            metadata[field_name] = self.serialize_value(field_value)
                    except:
                        pass
        except:
            pass
        
        # Get common metadata directly
        try:
            metadata['active'] = prim.IsActive()
        except:
            pass
        
        try:
            kind = prim.GetKind()
            if kind:
                metadata['kind'] = str(kind)
        except:
            pass
        
        try:
            if hasattr(prim, 'GetCustomData'):
                custom_data = prim.GetCustomData()
                if custom_data:
                    metadata['customData'] = self.serialize_value(custom_data)
        except:
            pass
        
        return metadata

    def extract_attr_info(self, attr):
        """Extract information from a USD attribute"""
        from pxr import Sdf, Tf
        
        try:
            info = {
                "name": attr.GetName(),
                "type": attr.GetTypeName(),
                "value": None,
                "authored": attr.HasAuthoredValue(),
                "time_samples": []
            }
            
            # Get value
            try:
                if attr.IsValid():
                    info["value"] = self.serialize_value(attr.Get())
            except:
                info["value"] = None
            
            # Get default value
            try:
                if hasattr(attr, 'GetDefault'):
                    info["default"] = self.serialize_value(attr.GetDefault())
                else:
                    info["default"] = None
            except:
                info["default"] = None
            
            # Get time samples
            try:
                if hasattr(attr, 'GetTimeSamples'):
                    time_samples = attr.GetTimeSamples()
                    if time_samples:
                        info["time_samples"] = []
                        for time in time_samples:
                            try:
                                info["time_samples"].append({
                                    "time": time,
                                    "value": self.serialize_value(attr.Get(time))
                                })
                            except:
                                pass
            except:
                pass
            
            return info
        except Exception as e:
            print(f"Error extracting attr info: {e}")
            return None

    def extract_primvar_info(self, primvar):
        """Extract information from a USD primvar"""
        from pxr import UsdGeom, Sdf
        
        try:
            info = {
                "name": primvar.GetName(),
                "type": primvar.GetTypeName(),
                "value": None,
                "authored": primvar.HasAuthoredValue(),
            }
            
            # Get value
            try:
                if primvar.IsValid():
                    info["value"] = self.serialize_value(primvar.Get())
            except:
                info["value"] = None
            
            # Get interpolation
            try:
                if hasattr(primvar, 'GetInterpolation'):
                    info["interpolation"] = str(primvar.GetInterpolation())
            except:
                info["interpolation"] = None
            
            # Get element size
            try:
                if hasattr(primvar, 'GetElementSize'):
                    info["element_size"] = primvar.GetElementSize()
            except:
                pass
            
            # Get time samples
            try:
                if hasattr(primvar, 'GetTimeSamples'):
                    time_samples = primvar.GetTimeSamples()
                    if time_samples:
                        info["time_samples"] = []
                        for time in time_samples:
                            try:
                                info["time_samples"].append({
                                    "time": time,
                                    "value": self.serialize_value(primvar.Get(time))
                                })
                            except:
                                pass
            except:
                pass
            
            return info
        except Exception as e:
            print(f"Error extracting primvar info: {e}")
            return None

    def serialize_value(self, value):
        """Convert USD values to JSON-serializable format"""
        from pxr import Gf, Sdf, Tf
        import numpy as np
        
        if value is None:
            return None
        
        # Handle numpy arrays
        if hasattr(value, 'tolist'):
            try:
                return value.tolist()
            except:
                return str(value)
        
        # Try various type conversions with error handling
        try:
            if isinstance(value, (Gf.Vec3f, Gf.Vec3d, Gf.Vec3i)):
                return [float(value[0]), float(value[1]), float(value[2])]
        except:
            pass
        
        try:
            if isinstance(value, (Gf.Vec2f, Gf.Vec2d, Gf.Vec2i)):
                return [float(value[0]), float(value[1])]
        except:
            pass
        
        try:
            if isinstance(value, (Gf.Vec4f, Gf.Vec4d, Gf.Vec4i)):
                return [float(value[0]), float(value[1]), float(value[2]), float(value[3])]
        except:
            pass
        
        try:
            if isinstance(value, (Gf.Matrix4d, Gf.Matrix4f)):
                return [float(v) for v in value.data()]
        except:
            pass
        
        try:
            if isinstance(value, (Gf.Quatf, Gf.Quatd)):
                return [float(value[0]), float(value[1]), float(value[2]), float(value[3])]
        except:
            pass
        
        try:
            if isinstance(value, (Sdf.Path, Sdf.AssetPath)):
                return str(value)
        except:
            pass
        
        try:
            if isinstance(value, Tf.Token):
                return str(value)
        except:
            pass
        
        # Handle lists and tuples
        if isinstance(value, (list, tuple)):
            return [self.serialize_value(v) for v in value]
        
        # Handle dicts
        if isinstance(value, dict):
            return {k: self.serialize_value(v) for k, v in value.items()}
        
        # Fallback to string
        try:
            return str(value)
        except:
            return value

    def json_serializer(self, obj):
        """Custom JSON serializer for non-serializable objects"""
        try:
            if hasattr(obj, '__dict__'):
                return obj.__dict__
            return str(obj)
        except:
            return str(obj)