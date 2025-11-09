from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import JSONField 


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

class Conversation(models.Model):
    """
    Stores conversation-level context that agents can read/write.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.JSONField(default=dict, blank=True)  # custom fields like last_reaction, last_smiles

class Message(models.Model):
    """
    Messages are created by user or agents, stored in order.
    role: 'user', 'agent1', 'agent2', 'agent3', 'agent4'
    content: text or JSON string
    payload: optional JSON with structured results (e.g., smiles, glb urls, atom_map)
    """
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=32)
    content = models.TextField(blank=True)
    payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
