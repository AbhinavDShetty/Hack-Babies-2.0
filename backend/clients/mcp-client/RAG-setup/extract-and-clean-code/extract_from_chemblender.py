import os
import ast
import json

repo_path = "../ChemBlender-main"  # path to your local ChemBlender repo
output_file = "extracted_chemblender_functions.json"

data = []
total_files = 0
total_functions = 0

# Walk through all python files in the repo
for root, _, files in os.walk(repo_path):
    for file in files:
        if file.endswith(".py"):
            total_files += 1
            file_path = os.path.join(root, file)
            print(f"Reading file: {file_path}")

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    source = f.read()
                    tree = ast.parse(source)
            except Exception as e:
                print(f"Skipping {file_path} due to error: {e}")
                continue

            func_count_in_file = 0
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    func_count_in_file += 1
                    total_functions += 1

                    # Extract docstring
                    doc = ast.get_docstring(node)
                    desc = doc if doc else "No description available."

                    # Extract code snippet
                    start_line = node.lineno - 1
                    end_line = getattr(node, "end_lineno", start_line + 1)
                    src_lines = source.splitlines()[start_line:end_line]
                    code = "\n".join(src_lines)

                    data.append({
                        "function_name": node.name,
                        "description": desc.strip(),
                        "code": code.strip(),
                        "source_file": file_path
                    })

            print(f"Found {func_count_in_file} functions in this file.\n")

print(f"Scanned {total_files} Python files.")
print(f"Total functions extracted: {total_functions}")

# Save results
if total_functions > 0:
    with open(output_file, "w", encoding="utf-8") as out:
        json.dump(data, out, ensure_ascii=False, indent=4)
    print(f"\nData saved to: {output_file}")
else:
    print("\nNo functions were extracted! Check if your repo path is correct or files contain valid Python functions.")
