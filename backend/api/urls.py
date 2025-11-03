from django.urls import path
from . import views
from .views import GenerateModelView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("notes/", views.NoteListCreate.as_view(), name="note-list"),
    path("notes/delete/<int:pk>/", views.NoteDelete.as_view(), name="delete-note"),
    path("generate-model/", GenerateModelView.as_view(), name="generate-model")
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)