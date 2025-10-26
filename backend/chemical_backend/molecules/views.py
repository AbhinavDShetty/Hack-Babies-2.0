import subprocess, os
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import requests
from .models import Molecule

def blender_command(request):
    command_type = request.GET.get("type", "get_scene_info")
    params = request.GET.get("params", "{}")

    # Send request to the MCP server
    try:
        response = requests.post(
            "http://localhost:9876/execute",  # Assuming MCP listens here
            json={"type": command_type, "params": params}
        )
        return JsonResponse(response.json())
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def generate_molecule(request):
    reaction = request.GET.get("reaction")  # e.g. "H2 + O2 -> H2O"

    # Paths
    blender_exe = "C:/Program Files/Blender Foundation/Blender 4.2/blender.exe"
    blender_script = os.path.join(settings.BASE_DIR, "blender-mcp", "src", "blender_mcp", "server.py")
    output_path = os.path.join(settings.MEDIA_ROOT, "molecule.glb")

    # Run Blender script
    cmd = [
        blender_exe, "-b", "-P", blender_script, "--",
        "--reaction", reaction,
        "--output", output_path
    ]

    try:
        subprocess.run(cmd, check=True)
        return JsonResponse({"status": "success", "file_url": f"/media/molecule.glb"})
    except subprocess.CalledProcessError as e:
        return JsonResponse({"status": "error", "message": str(e)})
