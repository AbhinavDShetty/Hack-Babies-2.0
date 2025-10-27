from django.urls import path
from . import views

urlpatterns = [
    path("generate/", views.generate_model, name="generate_model"),
    path("job/<int:job_id>/", views.job_detail, name="job_detail"),
]
