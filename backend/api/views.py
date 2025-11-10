from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import generics
from .serializers import UserSerializer, NoteSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Note, Job, ModelTemplate, ChatSession, ChatMessage
from .generator import parse_prompt_to_plan, generate_from_plan
from .vector_search import classify_prompt_mode, retrieve_contextual_answer, check_existing_model_with_llm
import shutil, os, traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

import trimesh
import pyrender
from PIL import Image, ImageDraw
import numpy as np

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import ChatSession, ChatMessage, ModelTemplate


def get_chat(request, chat_id):
    """
    Return a specific chat session with all its messages and linked models.
    """
    try:
        chat = ChatSession.objects.get(id=chat_id)
        messages = chat.messages.order_by("timestamp")
        linked_models = chat.linked_models.all()

        return JsonResponse({
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "models": [m.to_dict() for m in linked_models],
            "messages": [m.to_dict() for m in messages],
        })
    except ChatSession.DoesNotExist:
        return JsonResponse({"error": "Chat not found"}, status=404)


def get_model_chat(request):
    """
    Return the most recent chat containing a specific model (by name).
    """
    model_name = request.GET.get("model_name")
    if not model_name:
        return JsonResponse({"error": "model_name required"}, status=400)

    chat = (
        ChatSession.objects.filter(linked_models__name__iexact=model_name)
        .order_by("-created_at")
        .first()
    )

    if not chat:
        return JsonResponse({"chat_id": None})

    return JsonResponse({
        "chat_id": chat.id,
        "title": chat.title,
        "models": [m.to_dict() for m in chat.linked_models.all()],
        "messages": [m.to_dict() for m in chat.messages.order_by("timestamp")],
    })


def get_user_sessions(request, user_id):
    """
    Return all chats for a user, sorted by most recent,
    showing basic info + first model preview if available.
    """
    sessions = ChatSession.objects.filter(user_id=user_id).order_by("-created_at")

    data = []
    for s in sessions:
        linked = s.linked_models.all()
        first_model = linked.first() if linked.exists() else None

        data.append({
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "model_name": first_model.name if first_model else None,
            "model_url": first_model.model_file.url if first_model else None,
            "thumbnail": (
                first_model.thumbnail.url if first_model and first_model.thumbnail else None
            ),
        })

    return JsonResponse(data, safe=False)


@csrf_exempt
def delete_chat_session(request, chat_id):
    """
    Delete a chat session and clear any model associations.
    """
    if request.method == "DELETE":
        try:
            chat = ChatSession.objects.filter(id=chat_id).first()
            if not chat:
                return JsonResponse({"error": "Chat not found"}, status=404)

            chat.linked_models.clear()  # remove associations but not models
            chat.delete()
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid method"}, status=405)


def generate_thumbnail_from_glb(glb_path, output_path, size=(512, 512)):
    """
    Render a GLB file offscreen and save a PNG thumbnail with Meku-themed background.
    Ensures white/light-colored molecules are visible on dark backgrounds.
    """

    try:
        loaded = trimesh.load(glb_path)

        # --- Handle Scene or single Mesh ---
        if isinstance(loaded, trimesh.Scene):
            if not loaded.geometry:
                raise ValueError("No geometry found in GLB scene.")
            mesh = trimesh.util.concatenate(tuple(loaded.geometry.values()))
        else:
            mesh = loaded

        # --- Normalize position and scale ---
        bounds = mesh.bounds
        center = (bounds[0] + bounds[1]) / 2
        mesh.apply_translation(-center)

        max_dim = (bounds[1] - bounds[0]).max()
        if max_dim > 0:
            mesh.apply_scale(2.5 / max_dim)

        # Ensure materials visible
        if hasattr(mesh.visual, "material"):
            mesh.visual.material.alphaMode = "OPAQUE"

        # --- Pyrender Scene ---
        scene = pyrender.Scene(bg_color=[0.1, 0.13, 0.2, 1.0], ambient_light=[0.9, 0.9, 1.0, 1.0])

        render_mesh = pyrender.Mesh.from_trimesh(mesh, smooth=True)
        scene.add(render_mesh)

        # --- Lighting setup ---
        light_positions = [
            (5, 5, 5),
            (-5, 5, 5),
            (5, 5, -5),
            (-5, 5, -5),
            (0, -3, 5),
        ]
        for pos in light_positions:
            light = pyrender.DirectionalLight(color=np.ones(3), intensity=7.0)
            light_pose = np.eye(4)
            light_pose[:3, 3] = pos
            scene.add(light, pose=light_pose)

        # Add slightly stronger ambient for white bonds
        ambient = pyrender.DirectionalLight(color=np.ones(3), intensity=2.0)
        light_pose = np.eye(4)
        light_pose[:3, 3] = (0, 3, 0)
        scene.add(ambient, pose=light_pose)

        # --- Camera ---
        camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0)
        cam_pose = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 6.0],
            [0, 0, 0, 1],
        ])
        scene.add(camera, pose=cam_pose)

        # --- Renderer ---
        renderer = pyrender.OffscreenRenderer(size[0], size[1])

        # Render with opaque background (no alpha)
        color, _ = renderer.render(scene)
        renderer.delete()

        img = Image.fromarray(color, mode="RGB")

        # --- Meku gradient background ---
        bg = Image.new("RGB", size, "#0f172a")
        draw = ImageDraw.Draw(bg)
        for y in range(size[1]):
            ratio = y / size[1]
            r1, g1, b1 = (15, 23, 42)
            r2, g2, b2 = (0, 0, 0)
            r = int(r1 + (r2 - r1) * ratio)
            g = int(g1 + (g2 - g1) * ratio)
            b = int(b1 + (b2 - b1) * ratio)
            draw.line([(0, y), (size[0], y)], fill=(r, g, b))

        # --- Composite them (dark blend to match theme) ---
        blended = Image.blend(bg, img, alpha=0.85)
        blended.save(output_path, "PNG", quality=95)

        print(f"✅ Meku-themed thumbnail (bright model visible) → {output_path}")

    except Exception as e:
        print(f"⚠️ Failed to generate thumbnail for {glb_path}: {e}")
        Image.new("RGB", size, color=(15, 23, 42)).save(output_path)


def get_templates(request):
    templates = ModelTemplate.objects.all().order_by('category', 'name')
    data = {}
    for template in templates:
        cat = template.category
        if cat not in data:
            data[cat] = []
        data[cat].append(template.to_dict())
    return JsonResponse(data)

@csrf_exempt
def upload_user_model(request, user_id):
    if request.method == "POST":
        user = User.objects.get(id=user_id)
        name = request.POST.get("name")
        description = request.POST.get("description", "")
        thumbnail = request.FILES.get("thumbnail")
        model_file = request.FILES.get("model_file")

        if not all([name, thumbnail, model_file]):
            return JsonResponse({"error": "Missing fields"}, status=400)

        model = ModelTemplate.objects.create(
            user=user,
            name=name,
            description=description,
            category="custom",
            thumbnail=thumbnail,
            model_file=model_file,
        )

        return JsonResponse(model.to_dict(), status=201)
        
    
@csrf_exempt
def delete_model(request, model_id):
    if request.method == "DELETE":
        try:
            model = ModelTemplate.objects.get(id=model_id)
            ChatSession.objects.filter(related_model=model).delete()
            model.delete()
            return JsonResponse({"success": True})
        except ModelTemplate.DoesNotExist:
            return JsonResponse({"error": "Model not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid method"}, status=405)

def get_user_models(request, user_id):
    models = ModelTemplate.objects.filter(user_id=user_id, category="custom").order_by("-created_at")
    return JsonResponse([m.to_dict() for m in models], safe=False)


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



class GenerateModelView(APIView):
    def post(self, request):
        prompt = request.data.get("prompt", "").strip()
        user_id = request.data.get("user_id", None)
        chat_id = request.data.get("chat_id", None)
        user = User.objects.filter(id=user_id).first() if user_id else None
        print(f"User ID: {user_id}, Chat ID: {chat_id}")

        if not prompt:
            return Response({"error": "Prompt required"}, status=status.HTTP_400_BAD_REQUEST)

        job = Job.objects.create(prompt=prompt, status="processing")
        chat_history = ""
        reasoning = ""
        model_url = None
        existing_chat = None

        # --- Step 0: Retrieve existing chat if provided ---
        if chat_id:
            try:
                existing_chat = ChatSession.objects.get(id=chat_id, user=user)
                chat_msgs = existing_chat.messages.order_by("timestamp")
                chat_history = "\n".join([f"{m.sender}: {m.text}" for m in chat_msgs])
            except ChatSession.DoesNotExist:
                existing_chat = None

        try:
            print("\n==============================")
            print(f"🚀 Received prompt: {prompt}")
            print("==============================")
            print("Classifying prompt mode... (with chat history):\n", chat_history)

            # --- Step 1: Determine mode (chat/model/invalid) ---
            mode = classify_prompt_mode(prompt, chat_history)
            print(f"🔍 Classified mode: {mode}")
            print("==============================")

            # ------------------------------------------------------------------
            # 🧩 CASE 1: INVALID → reply with simple response, no new chat
            # ------------------------------------------------------------------
            if mode == "invalid":
                response_data = retrieve_contextual_answer(prompt, chat_history)
                answer = (
                    response_data["answer"]
                    if isinstance(response_data, dict)
                    else response_data
                )

                # Append to existing chat if one exists
                if existing_chat:
                    ChatMessage.objects.create(
                        session=existing_chat, sender="bot", text=answer
                    )

                return Response(
                    {"mode": "chat", "response": answer, "chat_id": chat_id},
                    status=status.HTTP_200_OK,
                )

            # ------------------------------------------------------------------
            # 🧠 CASE 2: CHAT MODE
            # ------------------------------------------------------------------
            if mode == "chat":
                response_data = retrieve_contextual_answer(prompt, chat_history)
                answer = response_data.get("answer", "Sorry, I couldn't find an answer.")
                title = response_data.get("title", prompt[:30])

                # Continue same chat session if it exists
                if existing_chat:
                    ChatMessage.objects.bulk_create([
                        ChatMessage(session=existing_chat, sender="user", text=prompt),
                        ChatMessage(session=existing_chat, sender="bot", text=answer),
                    ])
                    chat_session = existing_chat
                else:
                    # Create a new chat only if from home (no existing_chat)
                    chat_session = ChatSession.objects.create(
                        user=user,
                        title=title,
                    )
                    ChatMessage.objects.bulk_create([
                        ChatMessage(session=chat_session, sender="user", text=prompt),
                        ChatMessage(session=chat_session, sender="bot", text=answer),
                    ])

                return Response(
                    {
                        "mode": "chat",
                        "response": answer,
                        "chat_id": chat_session.id,
                        "title": title,
                    },
                    status=status.HTTP_200_OK,
                )

            # ------------------------------------------------------------------
            # 🧬 CASE 3: MODEL MODE
            # ------------------------------------------------------------------
            existing_models = ModelTemplate.objects.all()
            check_result = check_existing_model_with_llm(prompt, existing_models)

            # ✅ Found an existing model
            if check_result.get("exists"):
                existing_match = ModelTemplate.objects.filter(
                    name__iexact=check_result["name"]
                ).first()
                if existing_match:
                    print(f"♻️ Found existing model match: {existing_match.name}")

                    # Reuse existing chat or create a new one
                    chat_session = existing_chat or ChatSession.objects.create(
                        user=user,
                        title=existing_match.name,
                    )

                    # ✅ Link this model to the session (many-to-many)
                    chat_session.linked_models.add(existing_match)

                    # Save messages referencing this model
                    ChatMessage.objects.bulk_create([
                        ChatMessage(session=chat_session, sender="user", text=prompt),
                        ChatMessage(
                            session=chat_session,
                            sender="bot",
                            text=check_result["response"],
                            model_ref=existing_match,
                        ),
                    ])

                    job.status = "completed"
                    job.result = existing_match.model_file.url
                    job.save()

                    return Response(
                        {
                            "mode": "model",
                            "response": check_result["response"]
                            + "\n"
                            + existing_match.description,
                            "reasoning": f"Matched existing model '{existing_match.name}'",
                            "model_url": existing_match.model_file.url,
                            "thumbnail": existing_match.thumbnail.url
                            if existing_match.thumbnail
                            else None,
                            "chat_id": chat_session.id,
                            "reused": True,
                            "atoms": existing_match.atom_data,
                            "bonds": existing_match.bond_data
                        },
                        status=status.HTTP_200_OK,
                    )

            # 🧪 Otherwise, generate a NEW model
            print("🧠 Generating new model...")
            plan = parse_prompt_to_plan(prompt, chat_history)
            reasoning = plan.get("reasoning", "")

            model_data = generate_from_plan(plan)
            atom_data = model_data.get("atoms", [])
            bond_data = model_data.get("bonds", [])
            file_path = model_data["glb_path"]
            media_root = str(settings.MEDIA_ROOT)
            rel_path = os.path.relpath(file_path, media_root)
            model_url = f"{settings.MEDIA_URL}{rel_path.replace(os.sep, '/')}"

            # --- Generate thumbnail ---
            thumb_name = os.path.splitext(os.path.basename(file_path))[0] + ".png"
            thumb_dir = os.path.join(settings.MEDIA_ROOT, "thumbnails")
            os.makedirs(thumb_dir, exist_ok=True)
            thumb_path = os.path.join(thumb_dir, thumb_name)
            generate_thumbnail_from_glb(file_path, thumb_path)
            rel_thumb_path = f"thumbnails/{thumb_name}"

            # --- Save model to DB ---
            model_instance = ModelTemplate.objects.create(
                user=user,
                name=plan.get("title", "") or "Untitled Model",
                description=plan.get("response", "") or "Auto-generated model",
                category="custom",
                thumbnail=rel_thumb_path,
                model_file=rel_path,
                atom_data=atom_data,
                bond_data=bond_data,
            )

            # --- Chat session linking ---
            chat_session = existing_chat or ChatSession.objects.create(
                user=user,
                title=model_instance.name,
            )

            # ✅ Add this new model to linked_models
            chat_session.linked_models.add(model_instance)

            # Save messages (associate bot reply to this model)
            ChatMessage.objects.bulk_create([
                ChatMessage(session=chat_session, sender="user", text=prompt),
                ChatMessage(
                    session=chat_session,
                    sender="bot",
                    text=plan.get("response", ""),
                    model_ref=model_instance,
                ),
            ])

            job.status = "completed"
            job.result = model_url
            job.save()

            print(f"✅ Model generated successfully: {model_url}")

            return Response(
                {
                    "mode": "model",
                    "model_url": model_url,
                    "thumbnail": f"{settings.MEDIA_URL}{rel_thumb_path}",
                    "reasoning": reasoning,
                    "response": plan.get("response", ""),
                    "chat_id": chat_session.id,
                    "reused": False,
                    "atoms": atom_data,
                    "bonds": bond_data
                },
                status=status.HTTP_200_OK,
            )

        # ------------------------------------------------------------------
        # ❌ Error Handling
        # ------------------------------------------------------------------
        except Exception as e:
            print("❌ Error while generating model:", e)
            traceback.print_exc()
            job.status = "failed"
            job.result = None
            reasoning = str(e)
            job.save()
            return Response(
                {"error": str(e), "trace": traceback.format_exc()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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