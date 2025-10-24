code = input()
n = len(code)
for char in code:
    while(char != '\n'):
        print(char, end='')    
    else:
        print()

# \nimport bpy\n\n# Delete all objects in scene\nfor obj in bpy.context.scene.objects:\n    bpy.data.objects.remove(obj, do_unlink=True)\n\n# Create a cube for the base of the laptop\nbpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, align=\'WORLD\', location=(0, 0, 0))\nlaptop_base = bpy.context.active_object\nlaptop_base.name = "Laptop_Base"\nlaptop_base.scale = (1.2, 0.8, 0.1)  # Scale to make it thin and rectangular\n\n# Create a cube for the screen of the laptop\nbpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, align=\'WORLD\', location=(0, 0, 0.1))\nlaptop_screen = bpy.context.active_object\nlaptop_screen.name = "Laptop_Screen"\nlaptop_screen.scale = (1.2, 0.05, 0.7)  # Scale to make it a thin screen\nlaptop_screen.location = (0, 0.85, 0.5)\nlaptop_screen.rotation_euler = (1.5708, 0, 0) # Rotate 90 degrees around X axis\n\n# Create a cube for the keyboard of the laptop\nbpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, align=\'WORLD\', location=(0, 0, 0))\nlaptop_keyboard = bpy.context.active_object\nlaptop_keyboard.name = "Laptop_Keyboard"\nlaptop_keyboard.scale = (1.1, 0.6, 0.05)  # Scale to make it a thin keyboard\nlaptop_keyboard.location = (0, -0.1, 0.1)\n