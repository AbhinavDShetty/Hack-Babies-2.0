# import json
# #Clean the text:
# with open("extracted_XI_chem_p1.json", "r", encoding="utf-8") as f:
#     pdf_texts = json.load(f)

# cleaned_texts = []
# # Example cleaning step
# for entry in pdf_texts:
#     entry = entry.replace('\n', ' ').strip()
#     cleaned_texts.append(entry)
    
# with open("cleaned_XI_chem_p1.json", "w", encoding="utf-8") as f:
#     json.dump(cleaned_texts, f, ensure_ascii=False, indent=2)


# -------------------------------------------------------------------------------------

# import json
# import re

# with open("extracted_all_chem.json", "r", encoding="utf-8") as f:
#     pdf_texts = json.load(f)


# def clean_text(text: str) -> str:
#     # Remove unwanted punctuation and symbols
#     text = re.sub(r"[;{}()\[\]<>~^|•✓→←↔]+", " ", text)
    
#     # Replace multiple dots or dashes with a single one
#     text = re.sub(r"\.{2,}", ".", text)
#     text = re.sub(r"-{2,}", "-", text)
    
#     # Remove multiple spaces, tabs, and newlines
#     text = re.sub(r"\s+", " ", text)
    
#     # Remove stray symbols from PDF extraction
#     text = re.sub(r"[^A-Za-z0-9.,:%°±×/\-\+\=\s]", "", text)
    
#     # Clean spacing around punctuation
#     text = re.sub(r"\s([.,;:!?])", r"\1", text)
    
#     # Fix capitalization for readability
#     text = re.sub(r'([.!?]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), text.capitalize())
#     text = text.strip()
    
#     return text

# #remove \n and extra spaces
# for entry in pdf_texts:
#     cleaned = entry["text"].replace("\n", " ").strip()
#     entry["text"] = " ".join(cleaned.split()) 

# # Save cleaned version
# with open("cleaned_all_chem.json", "w", encoding="utf-8") as f:
#     json.dump(pdf_texts, f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------------------------------
import re
import json
import unicodedata

def normalize_unicode(s: str) -> str:
    return unicodedata.normalize("NFKC", s)

# Heuristics: token considered "formula-like" -> skip aggressive casing fixes
def is_formula_like(token: str) -> bool:
    # contains digits or chemical/ math symbols => formula-like
    if re.search(r'[\d\+\-\=\(\)\[\]°·×•/±→⇌]', token):
        return True
    # many uppercase letters in a row (e.g. "NaOH", "CO2", "DNA") -> treat as formula/acronym
    # count uppercase letters only
    up = sum(1 for ch in token if 'A' <= ch <= 'Z')
    alpha = sum(1 for ch in token if ch.isalpha())
    if alpha > 0 and up / alpha >= 0.7 and len(token) > 1:
        return True
    return False

def collapse_long_letter_runs(s: str) -> str:
    # replace any same-letter run of length >=3 with a single letter
    # keep double letters (like 'oo') intact
    return re.sub(r'([A-Za-z])\1{2,}', r'\1', s)

def collapse_repeated_punct(s: str) -> str:
    # collapse repeated punctuation like ,,,,, or !!!!! or ----- to single
    s = re.sub(r'([,;:\.\?!\-\—_])\1{1,}', r'\1', s)
    # collapse repeated whitespace to single space
    s = re.sub(r'\s+', ' ', s)
    return s

def fix_token_casing(token: str, sentence_start=False) -> str:
    """
    Normalize casing for a single token while preserving formula-like tokens.
    sentence_start: if True, we'll capitalize the token (if we decide to alter it).
    """
    # if token is formula-like: leave as-is (except we already collapsed letter runs globally)
    if is_formula_like(token):
        return token

    # If token contains mixed case (both upper and lower), fix to 'normal' case:
    if re.search(r'[A-Z]', token) and re.search(r'[a-z]', token):
        token = token.lower().capitalize()  # e.g. ElEmeNTS -> Elements
        if sentence_start:
            return token
        return token

    # If token is all upper:
    if token.isupper():
        # keep short acronyms (<=3) as-is (e.g., DNA, CPU)
        if len(token) <= 3:
            return token
        # for longer all-uppercase words (headers like "ELEMENTS"), convert to title-case
        token = token.lower().capitalize()
        return token

    # if all-lower or normal -> maybe capitalize if sentence start
    if sentence_start:
        return token[0].upper() + token[1:] if token else token

    return token

sentence_end_re = re.compile(r'[.!?]["\']?\s+')

def clean_text_chemistry_aware(text: str, do_sentence_capitalization: bool = True) -> str:
    # 1) unicode norm
    text = normalize_unicode(text)

    # 2) collapse long punctuation runs, normalize whitespace first
    text = collapse_repeated_punct(text)

    # 3) collapse long letter runs globally (reduces UUUUUnnnnniiiiittt -> Unit after later casing)
    text = collapse_long_letter_runs(text)

    # 4) remove stray non-printable/control characters (preserve common chemistry punctuation)
    text = re.sub(r'[^\x20-\x7E\u00A0-\u017F]', ' ', text)  # keep extended latin
    text = re.sub(r'\s+', ' ', text).strip()

    # 5) tokenize by whitespace and punctuation while preserving punctuation tokens
    tokens = re.findall(r"\w+|[^\w\s]", text, re.UNICODE)

    # Determine sentence boundaries if doing sentence capitalization
    sent_starts = set()
    if do_sentence_capitalization:
        # naive approach: mark first token and tokens that follow a sentence end
        sent_starts.add(0)
        for m in sentence_end_re.finditer(text):
            # find index of token after match end
            pos = m.end()
            # count tokens before position
            idx = 0
            cur = 0
            for i, tok in enumerate(tokens):
                cur_pos = text.find(tok, cur)
                cur = cur_pos + len(tok)
                if cur_pos >= pos:
                    idx = i
                    break
                idx = i + 1
            sent_starts.add(idx)

    # 6) process tokens
    new_tokens = []
    for i, tok in enumerate(tokens):
        # if pure word (letters/digits/underscore)
        if re.match(r'^\w+$', tok):
            fixed = fix_token_casing(tok, sentence_start=(i in sent_starts))
            new_tokens.append(fixed)
        else:
            # punctuation or non-word token: keep but collapsed earlier
            new_tokens.append(tok)

    # 7) rejoin tokens into text (simple join with spaces but remove space before punctuation)
    out = ' '.join(new_tokens)
    out = re.sub(r'\s+([,.;:!?()\[\]])', r'\1', out)   # remove space before punctuation
    out = re.sub(r'([(\[\{])\s+', r'\1', out)          # after opening bracket no extra space
    out = re.sub(r'\s+([)\]\}])', r'\1', out)          # before closing bracket no extra space
    out = out.strip()

    return out

# If you want to process your JSON file extracted_all_chem.json (list of dicts with "text"):
def clean_json_file(infile="extracted_all_chem.json", outfile="cleaned_all_chem.json"):
    with open(infile, "r", encoding="utf-8") as f:
        data = json.load(f)

    for entry in data:
        entry_text = entry.get("text", "")
        entry["text_clean"] = clean_text_chemistry_aware(entry_text)

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Uncomment to run on your JSON:
clean_json_file()
