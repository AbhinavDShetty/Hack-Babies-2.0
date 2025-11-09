from django.urls import path
from . import views
# from .views import GenerateModelView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
#     path("generate-model/", GenerateModelView.as_view(), name="generate-model"),
    path('agent/', views.agent_workflow, name='agent_workflow'),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)