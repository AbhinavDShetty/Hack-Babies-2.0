# backend/api/agents.py
import json
import time
import os
import re
import requests
from typing import Dict, Any, Optional, List
from django.conf import settings
from .prompts import PROMPT_REGISTRY
from .models import Conversation, Message
from .generator import parse_prompt_to_plan, generate_from_plan, clean_glb_path
from .reaction_animator import generate_reaction_animation
from colorama import Fore, Style

# -------------------------
# Ollama LLM Configuration
# -------------------------
OLLAMA_GENERATE = "http://localhost:11434/api/generate"
MODEL_NAME = "gpt-oss:20b"

SYSTEM_INSTR = """
You are an expert chemistry assistant with domain knowledge in molecular structures and reactions.
You will receive specialized prompts from one of four agents:
1. Orchestrator — decides which agents to run
2. Chat Agent — responds conversationally
3. Model Generator — produces SMILES strings
4. Reaction Generator — predicts or formats reactions

Always follow the agent’s instructions exactly. If asked for JSON, output **only valid JSON**, no extra text.
"""


# -------------------------
# Ollama LLM Call (Robust)
# -------------------------
def call_llm(
    prompt: str,
    system: Optional[str] = None,
    temperature: float = 0.2,
    stream: bool = False,
    timeout: int = 300,
    json_mode: bool = False
) -> str | dict:
    system_instr = SYSTEM_INSTR
    if system:
        system_instr += f"\n\n### Additional System Context ###\n{system}"

    full_prompt = f"{system_instr}\n\n### User Prompt ###\n{prompt}"

    payload = {
        "model": MODEL_NAME,
        "prompt": full_prompt,
        "stream": stream,
        "options": {"temperature": temperature},
    }

    if json_mode:
        payload["format"] = "json"

    try:
        # Make request to Ollama API
        resp = requests.post(OLLAMA_GENERATE, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        # ---------------------------------------
        # ✅ Handle JSON mode output robustly
        # ---------------------------------------
        if json_mode:
            if isinstance(data, dict):
                raw = data.get("response", data)
            else:
                raw = data

            if not isinstance(raw, str):
                raw = json.dumps(raw)

            # Extract JSON using regex to handle stray text
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                parsed_json = json.loads(match.group(0))

                print(f"{Fore.GREEN}🧠 [LLM JSON Parsed Successfully]{Style.RESET_ALL}")
                print(json.dumps(parsed_json, indent=2))
                print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
                return parsed_json
            else:
                print(f"{Fore.YELLOW}⚠️ [LLM returned no valid JSON block]:{Style.RESET_ALL}")
                print(raw)
                print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
                return {}

        # ---------------------------------------
        # ✅ Handle text output (non-JSON)
        # ---------------------------------------
        if isinstance(data, dict):
            response_text = data.get("response") or data.get("output") or ""
        else:
            response_text = str(data)

        print(f"{Fore.BLUE}🗣️ [LLM TEXT RESPONSE]{Style.RESET_ALL}\n{response_text[:500]}\n")
        print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
        return response_text.strip()

    except requests.exceptions.RequestException as e:
        print(f"{Fore.RED}❌ [Network Error calling Ollama]:{Style.RESET_ALL} {e}")
        return {"error": f"Network Error: {e}"} if json_mode else f"Error calling Ollama: {e}"
    except json.JSONDecodeError as e:
        print(f"{Fore.RED}❌ [JSON Decode Error]:{Style.RESET_ALL} {e}")
        return {"error": f"JSON decode error: {e}"} if json_mode else f"Error decoding JSON: {e}"
    except Exception as e:
        print(f"{Fore.RED}❌ [Unhandled Exception]:{Style.RESET_ALL} {e}")
        return {"error": str(e)} if json_mode else f"Error calling Ollama: {e}"

# -------------------------
# Utility helpers
# -------------------------
def save_message(conversation: Conversation, role: str, content: str, payload: Optional[Dict]=None):
    Message.objects.create(conversation=conversation, role=role, content=content, payload=payload or {})

def read_history_text(conversation: Conversation, max_messages: int = 20) -> str:
    # Fetch the latest N messages safely
    msgs = conversation.messages.order_by("-created_at")[:max_messages]
    msgs = list(msgs)[::-1]  # reverse to chronological order
    out = []
    for m in msgs:
        out.append(f"[{m.role}] {m.content}")
        if m.payload:
            out.append(f"[{m.role}-payload] {json.dumps(m.payload)}")
    return "\n".join(out)



# -------------------------
# Agent base class
# -------------------------
class BaseAgent:
    def __init__(self, conversation: Conversation):
        self.conversation = conversation

    def llm(self, prompt: str, system: Optional[str] = None, temperature: float = 0.2) -> str:
        return call_llm(prompt, system=system, temperature=temperature)


# -------------------------
# Agent 1: Orchestrator
# -------------------------
class OrchestratorAgent(BaseAgent):
    def route(self, user_text: str) -> Dict[str, Any]:
        system = PROMPT_REGISTRY["orchestrator"]
        context = read_history_text(self.conversation)
        prompt = f"Conversation so far:\n{context}\n\nUser: {user_text}\n\nDecide which agent to call next."

        out = call_llm(prompt=prompt, system=system, temperature=0.0)

        print("🧭 [DEBUG] Raw orchestrator output:\n", out)

        try:
            # Try to extract JSON block even if extra text appears
            json_block = re.search(r"\{[\s\S]*\}", out).group(0)
            parsed = json.loads(json_block)
        except Exception as e:
            print("⚠️ [DEBUG] JSON parsing failed:", e)
            parsed = {"run_chat": False, "run_model": False, "run_reaction": True, "reason": "fallback"}

        save_message(self.conversation, "agent1", json.dumps(parsed), parsed)
        return parsed



# -------------------------
# Agent 2: Chat Agent
# -------------------------
class ChatAgent(BaseAgent):
    def respond(self, user_text: str, context: Optional[str] = None) -> Dict[str, Any]:
        system = PROMPT_REGISTRY["chat"]
        context_text = read_history_text(self.conversation)
        
        # Include conversation history and enforce markdown output
        prompt = f"""
Conversation history:
{context_text}

User: {user_text}

Respond naturally as a friendly chemistry tutor.
Use **Markdown** formatting (e.g. code blocks, LaTeX for equations, lists, bold, italic).
"""
        out = call_llm(prompt=prompt, system=system, temperature=0.6)
        save_message(self.conversation, "agent2", out)
        return {"text": out, "format": "markdown"}



# -------------------------
# Agent 3: Model Generator Agent
# -------------------------
class ModelGeneratorAgent(BaseAgent):
    def generate_smiles_and_glb(self, user_text: str, instructions: Optional[str] = None) -> Dict[str, Any]:
        if "format" in user_text.lower() and "glb" not in user_text.lower():
            user_text += " (use GLB format)"
        try:
            plan = parse_prompt_to_plan(user_text)
            smiles = plan["params"].get("smiles")
            reasoning = plan.get("reasoning", "")
            glb_path = generate_from_plan(plan)

            rel_path = glb_path.replace(str(settings.MEDIA_ROOT), "").replace("\\", "/")
            result = {
                "smiles": smiles,
                "glb_url": f"/media{rel_path}",
                "reasoning": reasoning,
            }

            save_message(self.conversation, "agent3", f"Generated {smiles}", payload=result)
            return result
        except Exception as e:
            print("⚠️ Molecule generation failed:", e)
            save_message(self.conversation, "agent3", f"Error: {e}")
            return {"error": str(e)}


# -------------------------
# Agent 4: Reaction Generator Agent
# -------------------------
class ReactionGeneratorAgent(BaseAgent):
    def generate_reaction(
        self,
        user_text: str,
        instructions: Optional[str] = None,
        provided_reaction: Optional[str] = None
    ) -> Dict[str, Any]:
        import re
        print("\n==============================")
        print("⚗️  [ReactionGeneratorAgent] Starting Reaction Generation")
        print("==============================")

        def safe_parse_json(text: str) -> dict:
            """Try to extract and load a JSON block even if the LLM adds noise."""
            if not text:
                return {}
            try:
                return json.loads(text)
            except Exception:
                # Find JSON-like content between braces
                match = re.search(r"\{[\s\S]*\}", text)
                if match:
                    try:
                        return json.loads(match.group(0))
                    except Exception:
                        pass
            return {}

        try:
            system = PROMPT_REGISTRY["reaction"]

            # --- Step 1: Build robust prompt ---
            llm_prompt = f"""
You are a chemistry reaction prediction agent.
User query: "{user_text}"

Respond ONLY with valid JSON following this schema:
{{
  "reaction": "A + B → C + D",
  "reactants": ["A", "B"],
  "products": ["C", "D"],
  "reasoning": "Short explanation"
}}
Start your response with '{{' and end with '}}'. No extra text or Markdown.
"""

            # --- Step 2: Call Ollama ---
            raw_out = call_llm(prompt=llm_prompt, system=system, json_mode=False)
            print(f"🧠 [Raw LLM Output Preview]:\n{str(raw_out)[:200]}...\n")

            out = safe_parse_json(str(raw_out))

            # --- Step 3: Retry once if invalid ---
            if not out or not out.get("reaction"):
                print("⚠️ [ReactionAgent] First attempt invalid or empty — retrying...")
                retry_raw = call_llm(prompt=llm_prompt, system=system, json_mode=False)
                out = safe_parse_json(str(retry_raw))

            # --- Step 4: Fallback if still empty ---
            if not out or not out.get("reaction"):
                print("⚠️ [ReactionAgent] Using fallback neutralization reaction.")
                out = {
                    "reaction": "NaOH + HCl → NaCl + H2O",
                    "reactants": ["NaOH", "HCl"],
                    "products": ["NaCl", "H2O"],
                    "reasoning": "Fallback: acid-base neutralization forms salt and water."
                }

            # --- Step 5: Print debug summary ---
            print(f"🧪 Reaction: {out['reaction']}")
            print(f"🔹 Reactants: {out['reactants']}")
            print(f"🔸 Products: {out['products']}")

            # --- Step 6: Generate GLBs (with caching + auto-fix) ---
            reactant_glbs, product_glbs = [], []

            for label, mols in [("Reactants", out["reactants"]), ("Products", out["products"])]:
                for m in mols:
                    try:
                        plan = parse_prompt_to_plan(m)
                        glb_path = generate_from_plan(plan)
                        clean_path = clean_glb_path(glb_path)
                        if label == "Reactants":
                            reactant_glbs.append(clean_path)
                        else:
                            product_glbs.append(clean_path)
                        
                        print(f"✅ [ModelGenerator] GLB ready for {m}: {clean_path}")
                    except Exception as e:
                        print(f"❌ [ModelGenerator] Failed for {m}: {e}")

            # --- Step 7: Animate reaction ---
            print("🌀 Generating reaction animation frames...")
            animation = generate_reaction_animation(reactant_glbs, product_glbs)
            print(f"🧬 Generated {len(animation.get('frames', []))} frames.")

            # --- Step 8: Final structured result ---
            result = {
                "reaction": out["reaction"].replace("->", "→"),
                "reactants": out["reactants"],
                "products": out["products"],
                "reasoning": out.get("reasoning", ""),
                **animation,
            }

            save_message(self.conversation, "agent4", json.dumps(result), payload=result)
            print(f"✅ [ReactionAgent] Final reaction: {result['reaction']}")
            print("==============================\n")
            return result

        except Exception as e:
            print("⚠️ Reaction generation failed:", e)
            save_message(self.conversation, "agent4", f"Error: {e}")
            return {"error": str(e)}




# -------------------------
# Unified Workflow Runner (with backend logging)
# -------------------------
from colorama import Fore, Style

def run_workflow(conversation: Conversation, user_text: str) -> Dict[str, Any]:
    """
    Unified 4-agent workflow pipeline with clear colored logging.
    """
    print(f"{Fore.MAGENTA}{'='*30}\n🚀 User Query: {user_text}\n{'='*30}{Style.RESET_ALL}\n")

    save_message(conversation, "user", user_text)

    # Agent 1 — Orchestrator
    orchestrator = OrchestratorAgent(conversation)
    routing = orchestrator.route(user_text)

    print(f"{Fore.CYAN}{'='*30}\n🧭 ROUTING DECISION\n{'='*30}{Style.RESET_ALL}")
    print(json.dumps(routing, indent=2))
    print(f"{Fore.CYAN}{'='*30}{Style.RESET_ALL}\n")

    outputs = {}
    outputs["route"] = routing

    # -----------------------------
    # Agent 2 — Chat
    # -----------------------------
    if routing.get("run_chat", True):
        print(f"{Fore.BLUE}💬 MODE: ChatAgent activated.{Style.RESET_ALL}")
        chat_agent = ChatAgent(conversation)
        chat_out = chat_agent.respond(user_text, context=read_history_text(conversation))
        outputs["chat"] = chat_out
    else:
        print(f"{Fore.LIGHTBLACK_EX}💬 MODE: ChatAgent skipped.{Style.RESET_ALL}")

    # -----------------------------
    # Agent 3 — Molecule Generation
    # -----------------------------
    if routing.get("run_model", False):
        print(f"{Fore.GREEN}🧬 MODE: ModelGeneratorAgent activated.{Style.RESET_ALL}")
        model_agent = ModelGeneratorAgent(conversation)
        model_out = model_agent.generate_smiles_and_glb(user_text, routing.get("instructions"))
        outputs["model"] = model_out
        conversation.metadata.update({
            "last_smiles": model_out.get("smiles"),
            "last_glb": model_out.get("glb_url")
        })
        conversation.save()
    else:
        print(f"{Fore.LIGHTBLACK_EX}🧬 MODE: ModelGeneratorAgent skipped.{Style.RESET_ALL}")

    # -----------------------------
    # Agent 4 — Reaction Generation
    # -----------------------------
    if routing.get("run_reaction", False):
        print(f"{Fore.YELLOW}⚗️ MODE: ReactionGeneratorAgent activated.{Style.RESET_ALL}")
        reaction_agent = ReactionGeneratorAgent(conversation)
        reaction_out = reaction_agent.generate_reaction(
            user_text,
            instructions=routing.get("instructions"),
            provided_reaction=routing.get("provided_reaction")
        )
        outputs["reaction"] = reaction_out
        conversation.metadata.update({
            "last_reaction": reaction_out.get("reaction")
        })
        conversation.save()
    else:
        print(f"{Fore.LIGHTBLACK_EX}⚗️ MODE: ReactionGeneratorAgent skipped.{Style.RESET_ALL}")

    # -----------------------------
    # Wrap up
    # -----------------------------
    print(f"\n{Fore.GREEN}✅ Finished workflow for conversation: {conversation.id}{Style.RESET_ALL}")
    print(f"{Fore.MAGENTA}Active modes summary:{Style.RESET_ALL}")
    print(
        f"{Fore.BLUE}💬 Chat: {routing.get('run_chat', False)}{Style.RESET_ALL} | "
        f"{Fore.GREEN}🧬 Model: {routing.get('run_model', False)}{Style.RESET_ALL} | "
        f"{Fore.YELLOW}⚗️ Reaction: {routing.get('run_reaction', False)}{Style.RESET_ALL}"
    )
    print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")

    return {
        "conversation_id": conversation.id,
        "outputs": outputs
    }


# -------------------------
# ✅ Path Normalization Helper (Final Version)
# -------------------------
def clean_glb_path(path: str) -> str:
    """
    Normalizes GLB file paths for consistent /media/models/... URLs.
    Fixes:
    - Windows backslashes
    - Missing 'm' in 'models' ('odels' bug)
    - Ensures proper /media/ prefix
    """
    if not path:
        return ""

    # Normalize Windows vs Linux slashes
    normalized = os.path.normpath(path)

    # Strip MEDIA_ROOT prefix if present
    relative = normalized.replace(str(settings.MEDIA_ROOT), "")
    relative = relative.lstrip("\\/").replace("\\", "/")

    # Fix missing 'm' typo
    if "/odels/" in relative:
        relative = relative.replace("/odels/", "/models/")

    # Always ensure /media prefix
    if not relative.startswith("media/") and not relative.startswith("/media/"):
        relative = f"media/{relative.lstrip('/')}"

    # Final clean output
    clean_url = f"/{relative.strip('/')}"
    return clean_url





# -------------------------
# Unified Workflow Runner
# -------------------------
# def run_workflow(conversation: Conversation, user_text: str) -> Dict[str, Any]:
#     """
#     Unified 4-agent workflow pipeline.
#     """
#     save_message(conversation, "user", user_text)

#     orchestrator = OrchestratorAgent(conversation)
#     routing = orchestrator.route(user_text)

#     outputs = {}
#     outputs["route"] = routing

#     # Agent 2 — Chat
#     if routing.get("run_chat", True):
#         chat_agent = ChatAgent(conversation)
#         outputs["chat"] = chat_agent.respond(user_text, context=read_history_text(conversation))

#     # Agent 3 — Molecule generation
#     if routing.get("run_model", False):
#         model_agent = ModelGeneratorAgent(conversation)
#         model_out = model_agent.generate_smiles_and_glb(user_text, routing.get("instructions"))
#         outputs["model"] = model_out
#         conversation.metadata.update({
#             "last_smiles": model_out.get("smiles"),
#             "last_glb": model_out.get("glb_url")
#         })
#         conversation.save()

#     # Agent 4 — Reaction generation
#     if routing.get("run_reaction", False):
#         reaction_agent = ReactionGeneratorAgent(conversation)
#         reaction_out = reaction_agent.generate_reaction(
#             user_text,
#             instructions=routing.get("instructions"),
#             provided_reaction=routing.get("provided_reaction")
#         )
#         outputs["reaction"] = reaction_out
#         conversation.metadata.update({
#             "last_reaction": reaction_out.get("reaction")
#         })
#         conversation.save()

#     return {
#         "conversation_id": conversation.id,
#         "outputs": outputs
#     }
