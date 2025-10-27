from rest_framework import serializers
from .models import Job

class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ["id", "prompt", "status", "output_path", "log", "created_at", "updated_at"]
