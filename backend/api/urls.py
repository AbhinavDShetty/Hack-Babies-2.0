from django.urls import path
from . import views
from .views import GenerateModelView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("notes/", views.NoteListCreate.as_view(), name="note-list"),
    path("notes/delete/<int:pk>/", views.NoteDelete.as_view(), name="delete-note"),
    path("generate-model/", GenerateModelView.as_view(), name="generate-model"),
    path('templates/', views.get_templates, name='get_templates'),
    path("user/<int:user_id>/models/", views.get_user_models),
    path("user/<int:user_id>/models/upload/", views.upload_user_model),
    path("sessions/<int:user_id>/", views.get_user_sessions),
    path("chat/<int:chat_id>/delete/", views.delete_chat_session),
    path("model/<int:model_id>/delete/", views.delete_model),
    path("chat/<int:chat_id>/", views.get_chat),
    path("model-chat/", views.get_model_chat),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)