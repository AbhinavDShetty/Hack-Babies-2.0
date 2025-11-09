from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver


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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_sessions")
    title = models.CharField(max_length=255)
    mode = models.CharField(max_length=20, choices=[("chat", "Chat"), ("model", "Model")])
    related_model = models.ForeignKey("ModelTemplate", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.mode})"


class ChatMessage(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10, choices=[("user", "User"), ("bot", "Bot")])
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender}: {self.text[:40]}..."

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