from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver
import os


class Note(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")

    def __str__(self):
        return self.title

class Job(models.Model): 
    prompt = models.TextField()
    result = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Job {self.id} - {self.status}"
    
class ChatSession(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_sessions"
    )
    title = models.CharField(max_length=255)

    linked_models = models.ManyToManyField(
        "ModelTemplate",
        related_name="chat_sessions",
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Chat: {self.title} ({self.user.username})"

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "user": self.user.username,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "models": [m.to_dict() for m in self.linked_models.all()],
        }





class ChatMessage(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10, choices=[("user", "User"), ("bot", "Bot")])
    text = models.TextField()
    model_ref = models.ForeignKey("ModelTemplate", null=True, blank=True, on_delete=models.SET_NULL, related_name="messages")
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        short = (self.text[:50] + "...") if len(self.text) > 50 else self.text
        return f"[{self.sender}] {short}"

    def to_dict(self):
        return {
            "id": self.id,
            "sender": self.sender,
            "text": self.text,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "model_ref": self.model_ref.to_dict() if self.model_ref else None,
        }

class ModelTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('molecule', 'Molecule'),
        ('reaction', 'Reaction'),
        ('custom', 'Custom'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, null=True, blank=True, related_name='templates'
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    thumbnail = models.ImageField(upload_to='thumbnails/')
    model_file = models.FileField(upload_to='models/')
    created_at = models.DateTimeField(auto_now_add=True)
    atom_data = models.JSONField(default=list, blank=True)
    bond_data = models.JSONField(default=list, blank=True)

    def __str__(self):
        owner = self.user.username if self.user else "Public"
        return f"{self.name} ({self.category}) - {owner}"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "thumbnail": self.thumbnail.url if self.thumbnail else None,
            "modelUrl": self.model_file.url if self.model_file else None,
            "user": self.user.username if self.user else None,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "atom_data": self.atom_data,
            "bond_data": self.bond_data,
        }

@receiver(post_delete, sender=ModelTemplate)
def auto_delete_model_files(sender, instance, **kwargs):
    # Delete model file
    if instance.model_file and os.path.isfile(instance.model_file.path):
        try:
            os.remove(instance.model_file.path)
            print(f"🗑️ Deleted model file: {instance.model_file.path}")
        except Exception as e:
            print(f"⚠️ Could not delete model file: {e}")

    # Delete thumbnail
    if instance.thumbnail and os.path.isfile(instance.thumbnail.path):
        try:
            os.remove(instance.thumbnail.path)
            print(f"🗑️ Deleted thumbnail: {instance.thumbnail.path}")
        except Exception as e:
            print(f"⚠️ Could not delete thumbnail: {e}")