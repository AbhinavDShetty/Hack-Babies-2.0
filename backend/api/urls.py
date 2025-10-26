from django.urls import path
from . import views

urlpatterns = [
    path("generate/", views.generate_model, name="generate_model"),
]