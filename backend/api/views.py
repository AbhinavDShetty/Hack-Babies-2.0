from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Job
from .serializers import JobSerializer
from . import tasks

@api_view(["POST"])
def generate_model(request):
    """
    Accepts JSON: {"prompt": "<text>"}
    Creates a Job, runs generation synchronously (for now) and returns job id & status.
    """
    prompt = request.data.get("prompt", "")
    if not prompt:
        return Response({"error": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)

    job = Job.objects.create(prompt=prompt, status="queued")
    # Process synchronously for now; replace with Celery .delay(...) if you add Celery.
    try:
        tasks.process_prompt_job(job.id)
        serializer = JobSerializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        job.status = "error"
        job.log = str(e)
        job.save()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
def job_detail(request, job_id):
    try:
        job = Job.objects.get(id=job_id)
    except Job.DoesNotExist:
        return Response({"error": "job not found"}, status=status.HTTP_404_NOT_FOUND)
    serializer = JobSerializer(job)
    return Response(serializer.data)
