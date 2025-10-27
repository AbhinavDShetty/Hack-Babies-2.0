from django.contrib import admin
from .models import Job

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "prompt", "status", "output_path", "created_at")
    list_filter = ("status", "created_at")
    readonly_fields = ("created_at", "updated_at")
