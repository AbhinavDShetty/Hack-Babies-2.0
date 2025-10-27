from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Job

class ApiIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_generate_model_missing_prompt(self):
        url = reverse('generate_model')
        res = self.client.post(url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generate_model_ok(self):
        url = reverse('generate_model')
        res = self.client.post(url, {"prompt": "Generate water H2O"}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("id", res.data)
        job_id = res.data["id"]
        job = Job.objects.get(id=job_id)
        self.assertEqual(job.status, "done")
        self.assertIsNotNone(job.output_path)
