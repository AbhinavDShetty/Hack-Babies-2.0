from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["POST"])
def generate_model(request):
    prompt = request.data.get("prompt")
    # TODO: call llm_agent + blender worker logic
    return Response({"message": f"Received prompt: {prompt}"})