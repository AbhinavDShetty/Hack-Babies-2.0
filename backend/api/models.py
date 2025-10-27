from django.db import models

class Job(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("done", "Done"),
        ("error", "Error"),
    ]

    prompt = models.TextField()
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="queued")
    output_path = models.CharField(max_length=1024, blank=True, null=True)
    log = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Job {self.id} - {self.status}"
