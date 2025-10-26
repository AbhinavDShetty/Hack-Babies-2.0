import json
import re
import os

def normalize_text(text):
    """Fix random capitalization and remove repeated letters/punctuation."""
    # Remove excessive repeating chars like AAAAAA
    text = re.sub(r'(.)\1{2,}', r'\1', text)
    # Normalize weird capitalization like "ElEmeNT" → "Element"
    text = ' '.join([w.capitalize() if w.isalpha() else w for w in text.split()])
    # Remove extra punctuation/symbols
    text = re.sub(r'[\[\]\{\}\(\);,]+', '', text)
    return text.strip()

def clean_code(code):
    """Format code to make it readable and consistent."""
    # Remove trailing spaces
    code = "\n".join(line.rstrip() for line in code.splitlines())
    # Normalize indentation (spaces instead of tabs)
    code = code.replace("\t", "    ")
    return code.strip()

def clean_json_data(input_file, output_file):
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    cleaned_data = []
    for item in data:
        func_name = item.get("function_name", "")
        desc = item.get("description", "")
        code = item.get("code", "")
        src = item.get("source_file", "")

        # Clean fields
        desc = normalize_text(desc)
        code = clean_code(code)
        src = src.replace("..\\", "").replace("../", "").replace("\\", "/")

        # If description is placeholder → generate something short
        if desc.lower().startswith("no description"):
            desc = f"This function named `{func_name}` performs operations related to Blender chemistry utilities."

        cleaned_data.append({
            "function_name": func_name,
            "description": desc,
            "code": code,
            "source_file": src
        })

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, indent=4)

    print(f"Cleaned and saved {len(cleaned_data)} functions to {output_file}")

# Example usage
clean_json_data("extracted_chemblender_functions.json", "cleaned_chemblender_functions.json")
