"""
Simple synchronous task runner.
In production you can replace process_prompt_job with a Celery task.
"""

from .models import Job
from .llm_agent import LlmAgent

def process_prompt_job(job_id: int):
    job = Job.objects.get(id=job_id)
    job.status = "running"
    job.save()

    agent = LlmAgent()
    try:
        output_path, log = agent.run_prompt_and_generate(job.prompt, job_id=str(job.id))
        # save results
        job.output_path = output_path
        job.log = log or ""
        job.status = "done"
    except Exception as e:
        job.status = "error"
        job.log = str(e)
    job.save()
