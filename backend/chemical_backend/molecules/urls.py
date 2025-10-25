from django.urls import path
from .views import generate_molecule, blender_command

urlpatterns = [
    path("blender-command/", blender_command, name="blender_command"),
    path("generate/", generate_molecule),
]

