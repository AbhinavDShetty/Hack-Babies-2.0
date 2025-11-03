from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate

model = OllamaLLM(model="gpt-oss:20b")

template = """
You are an expert in organic chemistry and Blender Python scripting.

Use the following knowledge to generate Python code for Blender:

{context_for_prompt}

User query: {query}

Instructions:
- Generate valid Python code for Blender to create the molecule
- Follow chemical rules (valence, bonds, rings)
- Output Python Code if applicable, otherwise respond "No code needed."
- Do not include any explanations, only output the code block
"""

prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model
result = chain.invoke({"context_for_prompt": [], "query": "Give me simple code to made a sphere in Blender."})
print(result)