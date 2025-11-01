from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Job
from .serializers import JobSerializer
from . import tasks
from django.conf import settings
from django.utils import timezone
from pathlib import Path


@api_view(["POST"])
def generate_model(request):
    prompt = request.data.get("prompt", "")
    if not prompt:
        return Response({"error": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)

    job = Job.objects.create(prompt=prompt, status="queued")

    try:
        tasks.process_prompt_job(job.id)
        job.refresh_from_db()

        # Build output URL if file exists
        output_url = None
        if job.output_path:
            rel_path = Path(job.output_path).relative_to(settings.MEDIA_ROOT)
            output_url = f"{settings.MEDIA_URL}{rel_path}"

        return Response(
            {
                "job_id": job.id,
                "status": job.status,
                "output_url": output_url,
            },
            status=status.HTTP_200_OK,
        )
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

    output_url = None
    if job.output_path:
        from django.conf import settings
        from pathlib import Path
        rel_path = Path(job.output_path).relative_to(settings.MEDIA_ROOT)
        output_url = f"{settings.MEDIA_URL}{rel_path}"

    return Response(
        {
            "id": job.id,
            "status": job.status,
            "prompt": job.prompt,
            "output_url": output_url,
            "log": job.log,
        }
    )
