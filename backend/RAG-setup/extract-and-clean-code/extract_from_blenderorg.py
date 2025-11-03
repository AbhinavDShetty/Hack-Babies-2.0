# import requests
# from bs4 import BeautifulSoup
# import json

# urls = [
#     "https://docs.blender.org/api/current/bpy.ops.mesh.html",
#     "https://docs.blender.org/api/current/bpy.types.Object.html",
#     "https://docs.blender.org/api/current/bpy.context.html",
#     "https://docs.blender.org/api/current/bpy.data.html",
#     "https://docs.blender.org/api/current/bpy.types.Mesh.html"
# ]

# all_samples = []

# for url in urls:
#     print(f"Fetching {url} ...")
#     r = requests.get(url)
#     if r.status_code != 200:
#         print(f"Failed to fetch {url}")
#         continue

#     soup = BeautifulSoup(r.text, "html.parser")

#     # Grab all <div class="highlight"><pre> blocks
#     code_blocks = soup.select("div.highlight pre")
#     print(f"Found {len(code_blocks)} code blocks")

#     for block in code_blocks:
#         code = block.get_text()  # this removes all <span> syntax highlighting tags
#         code = code.strip()
#         if len(code) < 10:  # skip tiny blocks
#             continue

#         all_samples.append({
#             "source": url,
#             "description": "Code example from Blender API docs",
#             "code": code
#         })

# # Save as JSON
# with open("blender_code_samples.json", "w", encoding="utf-8") as f:
#     json.dump(all_samples, f, indent=4, ensure_ascii=False)

# print(f"\nSaved {len(all_samples)} code samples")


#-----------------------------------------------------------------------------------
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import json

BASE_URL = "https://docs.blender.org/api/current/"
INDEX_URL = urljoin(BASE_URL, "index.html")

# Step 1: Get all page links
r = requests.get(INDEX_URL)
soup = BeautifulSoup(r.text, "html.parser")

links = set()
for a in soup.find_all("a", href=True):
    href = a['href']
    if href.endswith(".html"):
        full_url = urljoin(BASE_URL, href)
        links.add(full_url)

print(f"Found {len(links)} pages to scrape")

# Step 2: Visit each page and extract code
all_samples = []

for url in links:
    print(f"Fetching {url} ...")
    r = requests.get(url)
    if r.status_code != 200:
        print(f"Failed to fetch {url}")
        continue

    page_soup = BeautifulSoup(r.text, "html.parser")
    code_blocks = page_soup.select("div.highlight pre")

    print(f"Found {len(code_blocks)} code blocks")

    for block in code_blocks:
        code = block.get_text().strip()
        if len(code) < 10:
            continue
        page_name = url.split("/")[-1]
        all_samples.append({
            "source": url,
            "description": f"Code example from Blender API page: {page_name}",
            "code": code
        })

# Step 3: Save all code to JSON
with open("extracted_from_docs_blenderorg.json", "w", encoding="utf-8") as f:
    json.dump(all_samples, f, indent=4, ensure_ascii=False)

print(f"\nSaved {len(all_samples)} code samples")
#-----------------------------------------------------------------------------------