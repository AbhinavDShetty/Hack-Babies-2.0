from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate

model = OllamaLLM(model="llama3:8b")

template = """
You are an expert in organic chemistry and Blender Python scripting.

Use the following knowledge to generate Python code for Blender:

{context_for_prompt}

User query: {query}

Instructions:
- Generate valid Python code for Blender to create the molecule
- Follow chemical rules (valence, bonds, rings)
- Output only Python code
"""

prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model
result = chain.invoke({"context_for_prompt": [], "query": "Create a 3D model of benzene in Blender using Python."})
print(result)