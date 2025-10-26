import json
with open("cleaned_chemblender_functions.json", "r", encoding="utf-8") as f:
    functions = json.load(f)

for func in functions:
    if "code" in func:
        print(func["code"])