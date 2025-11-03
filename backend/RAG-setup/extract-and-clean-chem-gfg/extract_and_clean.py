# import requests
# from bs4 import BeautifulSoup
# from urllib.parse import urljoin
# import json
# import time
# import re

# # Base URLs for Class 11 and Class 12 Chemistry Notes
# BASE_URLS = [
#     "https://www.geeksforgeeks.org/chemistry/cbse-notes-class-11-chemistry/",
#     "https://www.geeksforgeeks.org/chemistry/cbse-class-12-chemistry-notes/"
# ]

# # Initialize a set to store unique topic URLs
# visited_urls = set()

# def clean_text(text):
#     """Clean text for LLM input."""
#     text = re.sub(r'\s+', ' ', text)  # remove extra whitespace
#     text = text.replace('\xa0', ' ')  # non-breaking spaces
#     text = text.strip()
#     return text

# def extract_content(url):
#     """Extract content from a given URL."""
#     print(f"Fetching: {url}")
#     try:
#         r = requests.get(url)
#         r.raise_for_status()
#         soup = BeautifulSoup(r.text, "html.parser")

#         # Extract content from <article> tag
#         article = soup.find("article")
#         if not article:
#             print(f"No article found at {url}")
#             return None

#         # Extract headings, paragraphs, and list items
#         content_parts = []
#         for tag in article.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
#             text = clean_text(tag.get_text())
#             if text:
#                 content_parts.append(text)

#         content_text = "\n".join(content_parts)
#         if content_text:
#             print(f"Extracted content from {url} of length {len(content_text)}")
#             return {
#                 "description": f"Content extracted from {url}",
#                 "content": content_text
#             }
#         else:
#             print(f"No content found in article at {url}")
#             return None

#     except requests.RequestException as e:
#         print(f"Error fetching {url}: {e}")
#         return None

# def crawl_and_extract(base_url):
#     """Crawl and extract content starting from a base URL."""
#     to_visit = [base_url]
#     while to_visit:
#         current_url = to_visit.pop()
#         if current_url in visited_urls:
#             continue
#         visited_urls.add(current_url)

#         # Extract content from the current URL
#         content = extract_content(current_url)
#         if content:
#             all_topics.append(content)

#         # Find and add new topic links to the list
#         try:
#             r = requests.get(current_url)
#             r.raise_for_status()
#             soup = BeautifulSoup(r.text, "html.parser")
#             for a in soup.find_all("a", href=True):
#                 href = a['href']
#                 full_url = urljoin(current_url, href)
#                 if full_url.startswith("https://www.geeksforgeeks.org/chemistry") and full_url not in visited_urls and not full_url.endswith("#main"):
#                     print(f"Adding to visit: {full_url}")
#                     to_visit.append(full_url)
#         except requests.RequestException as e:
#             print(f"Error fetching {current_url}: {e}")

#         # Be polite to the server
#         time.sleep(100)

# # List to store all extracted topics
# all_topics = []

# # Start crawling from each base URL
# for base_url in BASE_URLS:
#     crawl_and_extract(base_url)

# # Save the extracted content to a JSON file
# with open("cleaned_chem_gfg_v2.json", "w", encoding="utf-8") as f:
#     json.dump(all_topics, f, indent=4, ensure_ascii=False)

# print(f"\nSaved {len(all_topics)} topics from GeeksforGeeks Chemistry Notes")


#!/usr/bin/env python3
"""
geeksforgeeks_chem_scraper_concurrent.py

Enhanced scraper with:
- Proxy provider rotation (round-robin)
- Threaded concurrent requests (polite)
- Respect for robots.txt
- Recursive crawling
- Content extraction suitable for LLM ingestion
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import urllib.robotparser
import json
import time
import random
import itertools
import os
from queue import Queue
from threading import Thread, Lock

# ---------------- CONFIG ----------------

BASE_URLS = [
    "https://www.geeksforgeeks.org/chemistry/cbse-notes-class-11-chemistry/",
    "https://www.geeksforgeeks.org/chemistry/cbse-class-12-chemistry-notes/"
]

OUTPUT_FILE = "geeksforgeeks_chemistry_final.json"
USER_AGENT = "MyChemScraper/1.0 (+https://yourdomain.example/)"

# Proxy providers (lists of proxies from multiple providers)
PROXY_PROVIDER_FILES = []
VERIFY_PROXIES = True
PROXY_TEST_URL = "https://httpbin.org/ip"
PROXY_TIMEOUT = 8

# Crawling / concurrency
MIN_DELAY = 1.0
MAX_DELAY = 3.0
MAX_RETRIES = 4
BACKOFF_FACTOR = 1.5
REQUEST_TIMEOUT = 15
MAX_THREADS = 5  # concurrent threads
ALLOWED_PREFIXES = "https://www.geeksforgeeks.org/chemistry"

# ---------------- END CONFIG ----------------

visited_lock = Lock()
visited = set()
output_lock = Lock()
output_list = []

# ----------------- HELPER CLASSES -----------------

def load_proxies_from_files(files):
    proxies = []
    for f in files:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as fh:
                lines = [line.strip() for line in fh if line.strip() and not line.startswith("#")]
                proxies.extend(lines)
    return proxies

def validate_proxy(proxy):
    try:
        r = requests.get(PROXY_TEST_URL, proxies={"http": proxy, "https": proxy}, timeout=PROXY_TIMEOUT, headers={"User-Agent": USER_AGENT})
        return r.status_code == 200
    except:
        return False

class ProxyRotator:
    """Round-robin across multiple proxies with fail tracking"""
    def __init__(self, proxy_list):
        self._proxies = proxy_list[:]
        random.shuffle(self._proxies)
        self._cycle = itertools.cycle(self._proxies) if self._proxies else None
        self._bad = set()
        self.lock = Lock()

    def next(self):
        with self.lock:
            if not self._proxies:
                return None
            for _ in range(len(self._proxies)):
                p = next(self._cycle)
                if p not in self._bad:
                    return p
            return None

    def mark_bad(self, proxy):
        with self.lock:
            self._bad.add(proxy)

# ----------------- SCRAPER FUNCTIONS -----------------

def polite_sleep():
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

def get_robots_parser(base_url):
    parsed = urlparse(base_url)
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(f"{parsed.scheme}://{parsed.netloc}/robots.txt")
    try:
        rp.read()
        return rp
    except:
        return None

def is_allowed_by_robots(rp, url):
    if rp is None:
        return True
    return rp.can_fetch(USER_AGENT, url)

def clean_text_for_llm(text):
    text = text.replace("\xa0", " ").strip()
    text = "\n".join([line.rstrip() for line in text.splitlines()])
    text = "\n".join([l for l in text.splitlines() if l.strip() != ""])
    return text

def extract_article_content(html, url):
    soup = BeautifulSoup(html, "html.parser")
    article = soup.find("article") or soup.find("div", class_=lambda c: c and ("entry" in c or "content" in c))
    if not article:
        return None
    parts = []
    for tag in article.find_all(["h1","h2","h3","h4","p","li","pre","code"]):
        text = tag.get_text(separator=" ", strip=True)
        if text:
            parts.append(text)
    combined = "\n\n".join(parts)
    return clean_text_for_llm(combined)

def fetch_with_retries(url, proxy_rotator, rp):
    if rp and not is_allowed_by_robots(rp, url):
        print(f"[robots.txt] Skipping disallowed URL: {url}")
        return None

    attempt = 0
    while attempt < MAX_RETRIES:
        proxy = proxy_rotator.next() if proxy_rotator else None
        proxies = {"http": proxy, "https": proxy} if proxy else None
        try:
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT, proxies=proxies)
            if r.status_code == 429 or 500 <= r.status_code < 600:
                attempt += 1
                wait = (BACKOFF_FACTOR ** attempt) + random.uniform(0,1)
                print(f"[WARN] {r.status_code} {url} attempt {attempt}, backoff {wait:.1f}s, proxy={proxy}")
                if proxy and r.status_code in (502,504):
                    proxy_rotator.mark_bad(proxy)
                time.sleep(wait)
                continue
            return r
        except requests.exceptions.ProxyError as e:
            print(f"[ProxyError] {proxy} failed: {e}")
            if proxy:
                proxy_rotator.mark_bad(proxy)
            attempt += 1
            time.sleep(random.uniform(1,2))
        except requests.exceptions.RequestException as e:
            attempt += 1
            wait = (BACKOFF_FACTOR ** attempt) + random.uniform(0,1)
            print(f"[ERROR] {url} error: {e} attempt {attempt}, wait {wait:.1f}s")
            time.sleep(wait)
    return None

# ----------------- THREAD WORKER -----------------

def worker(queue, proxy_rotator, rp):
    while True:
        try:
            url = queue.get(timeout=3)
        except:
            break
        with visited_lock:
            if url in visited:
                queue.task_done()
                continue
            visited.add(url)
        if not url.startswith(ALLOWED_PREFIXES):
            queue.task_done()
            continue
        resp = fetch_with_retries(url, proxy_rotator, rp)
        if resp:
            content = extract_article_content(resp.text, url)
            if content:
                entry = {
                    "description": f"Content extracted from {url}",
                    "url": url,
                    "content": content
                }
                with output_lock:
                    output_list.append(entry)
                    print(f"[SAVED] {url} ({len(content)} chars)")

            # enqueue internal links
            soup = BeautifulSoup(resp.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href = urljoin(url, a["href"].split("#")[0])
                if href.startswith(ALLOWED_PREFIXES) and not href.endswith("#main") and "cbse" not in href.lower():
                    with visited_lock:
                        if href not in visited:
                            queue.put(href)
        polite_sleep()
        queue.task_done()

# ----------------- MAIN -----------------

def main():
    # Load & validate proxies
    proxies = load_proxies_from_files(PROXY_PROVIDER_FILES)
    good_proxies = []
    if proxies and VERIFY_PROXIES:
        print(f"[INFO] Validating {len(proxies)} proxies...")
        for p in proxies:
            ok = validate_proxy(p)
            print(f"  proxy {p} -> {'OK' if ok else 'BAD'}")
            if ok:
                good_proxies.append(p)
    else:
        good_proxies = proxies

    rotator = ProxyRotator(good_proxies)
    rp = get_robots_parser(BASE_URLS[0])

    queue = Queue()
    for base in BASE_URLS:
        queue.put(base)

    threads = []
    for _ in range(MAX_THREADS):
        t = Thread(target=worker, args=(queue, rotator, rp), daemon=True)
        t.start()
        threads.append(t)

    queue.join()

    # Save final JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_list, f, indent=2, ensure_ascii=False)
    print(f"\nDONE. Saved {len(output_list)} entries to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
