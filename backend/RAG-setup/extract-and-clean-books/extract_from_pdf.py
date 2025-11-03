# import pdfplumber

# pdf_texts = []

# pdf_files = ["./chem-books/XI_chem_p1/kech1a1.pdf", 
#              "./chem-books/XI_chem_p1/kech101.pdf", 
#              "./chem-books/XI_chem_p1/kech102.pdf", 
#              "./chem-books/XI_chem_p1/kech103.pdf", 
#              "./chem-books/XI_chem_p1/kech104.pdf", 
#              "./chem-books/XI_chem_p1/kech105.pdf", 
#              "./chem-books/XI_chem_p1/kech106.pdf"]  # list of your PDF paths

# for pdf_file in pdf_files:
#     with pdfplumber.open(pdf_file) as pdf:
#         text = ""
#         for page in pdf.pages:
#             text += page.extract_text() + "\n"
#         pdf_texts.append(text)
# # Now pdf_texts contains the extracted text from the PDFs

# #Save as json:
# import json
# with open("extracted_XI_chem_p1.json", "w", encoding="utf-8") as f:
#     json.dump(pdf_texts, f, ensure_ascii=False, indent=2)



import os
import pdfplumber
import json

# Root directory containing all chemistry book folders
root_dir = "./chem-books"
output_file = "extracted_all_chem.json"

pdf_texts = []

# Walk through all subdirectories
for folder, _, files in os.walk(root_dir):
    for file in files:
        if file.lower().endswith(".pdf"):
            pdf_path = os.path.join(folder, file)
            print(f"Extracting: {pdf_path}")
            
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    text = ""
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"

                    pdf_texts.append({
                        "folder": os.path.relpath(folder, root_dir),
                        "filename": file,
                        "text": text.strip()
                    })
            except Exception as e:
                print(f"❌ Error reading {pdf_path}: {e}")

# Save everything into one JSON file
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(pdf_texts, f, ensure_ascii=False, indent=2)

print(f"\n✅ Extraction complete! Saved {len(pdf_texts)} entries to {output_file}")
