from django.contrib import admin
from .models import ModelTemplate

@admin.register(ModelTemplate)
class ModelTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'created_at')
    list_filter = ('category',)
    search_fields = ('name', 'description')
