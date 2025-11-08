from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import generics
from .serializers import UserSerializer, NoteSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Note, Job
# from .llm_agent import parse_prompt_to_plan
from .generator import parse_prompt_to_plan, generate_from_plan
import shutil, os, traceback


class NoteListCreate(generics.ListCreateAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(author=user)

    def perform_create(self, serializer):
        if serializer.is_valid():
            serializer.save(author=self.request.user)
        else:
            print(serializer.errors)


class NoteDelete(generics.DestroyAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(author=user)



class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


class GenerateModelView(APIView):
    def post(self, request):
        prompt = request.data.get("prompt", "").strip()
        if not prompt:
            return Response({"error": "Prompt required"}, status=status.HTTP_400_BAD_REQUEST)

        job = Job.objects.create(prompt=prompt, status="processing")
        reasoning = ""
        model_url = None

        try:
            print("\n==============================")
            print("🚀 Received prompt:", prompt)
            print("==============================")

            # Step 1 — Interpret prompt with LLM/RAG
            plan = parse_prompt_to_plan(prompt)
            reasoning = plan.get("reasoning", "")

            print("\n🧠 LLM Reasoning Output:")
            print(reasoning or "No reasoning provided.")
            print("==============================")

            # Step 2 — Generate molecule and get GLB file path
            file_path = generate_from_plan(plan)  # e.g., C:\project\media\models\O.glb

            # Step 3 — Convert absolute file path to media URL
            media_root = str(settings.MEDIA_ROOT)
            if file_path.startswith(media_root):
                # Path relative to MEDIA_ROOT → e.g. "models/O.glb"
                rel_path = os.path.relpath(file_path, media_root)
                model_url = f"{settings.MEDIA_URL}{rel_path.replace(os.sep, '/')}"
                print(f"\n📁 File correctly stored under MEDIA_ROOT.")
            else:
                # Fallback (not inside media root)
                model_url = f"{settings.MEDIA_URL}{os.path.basename(file_path)}"
                print(f"\n⚠️ Warning: File stored outside MEDIA_ROOT: {file_path}")

            print(f"\n✅ Job completed. Model available at: {model_url}")
            print("==============================")

            # Update job record
            job.status = "completed"
            job.result = model_url

        except Exception as e:
            print("❌ Error while generating model:", e)
            traceback.print_exc()
            job.status = "failed"
            job.result = None
            reasoning = str(e)
            return Response(
                {"error": str(e), "trace": traceback.format_exc()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        finally:
            job.save()

        return Response(
            {
                "id": job.id,
                "status": job.status,
                "model_url": job.result,
                "reasoning": reasoning,
                "response": plan.get("response", ""),
                "mode": "model",
            },
            status=status.HTTP_200_OK,
        )

          

# class GenerateModelView(APIView):
#     def post(self, request):
#         prompt = request.data.get("prompt", "").strip()
#         if not prompt:
#             return Response({"error": "Prompt required"}, status=status.HTTP_400_BAD_REQUEST)

#         job = Job.objects.create(prompt=prompt, status="processing")
#         reasoning = ""
#         model_url = None

#         try:
#             # Step 1 — Parse prompt using RAG + LLM
#             plan = parse_prompt_to_plan(prompt)
#             reasoning = plan.get("reasoning", "")

#             # Step 2 — Generate the molecule model (GLB)
#             file_path = generate_from_plan(plan)

#             # Step 3 — Move file to /static/generated_models/
#             static_dir = os.path.join(settings.BASE_DIR, "backend", "static", "generated_models")
#             os.makedirs(static_dir, exist_ok=True)

#             final_name = f"model_{job.id}.glb"
#             final_path = os.path.join(static_dir, final_name)
#             shutil.copy(file_path, final_path)

#             # Step 4 — Build static-accessible URL
#             model_url = f"/static/generated_models/{final_name}"

#             # Step 5 — Update job record
#             job.status = "completed"
#             job.result = model_url

#         except Exception as e:
#             job.status = "failed"
#             reasoning = str(e)
#             model_url = None

#         job.save()

#         return Response({
#             "id": job.id,
#             "status": job.status,
#             "model_url": model_url,   # ✅ what your frontend expects
#             "reasoning": reasoning
#         }, status=status.HTTP_200_OK)