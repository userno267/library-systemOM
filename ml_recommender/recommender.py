import pandas as pd
import numpy as np
import re
import sys
import json
import random
from collections import defaultdict
from sqlalchemy import create_engine

from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from sentence_transformers import SentenceTransformer

# ===============================
# CONFIG
# ===============================
DB_USER = "root"
DB_PASS = ""
DB_HOST = "localhost"
DB_NAME = "library_db"

engine = create_engine(f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}")

DEBUG = False
EVAL_MODE = len(sys.argv) > 2 and sys.argv[2] == "eval"

def log(msg):
    if DEBUG or EVAL_MODE:
        print(f"[DEBUG] {msg}")

# ===============================
# LOAD DATA
# ===============================
query = """
SELECT
    b.id,
    b.title,
    b.author,
    b.description,
    b.cover_image,
    b.section,
    GROUP_CONCAT(DISTINCT s.name SEPARATOR ' ') AS subjects
FROM books b
LEFT JOIN book_subjects bs ON b.id = bs.book_id
LEFT JOIN subjects s ON bs.subject_id = s.id
GROUP BY b.id;
"""

df = pd.read_sql(query, engine)

# ===============================
# CLEAN TEXT
# ===============================
text_cols = ["title", "author", "description", "section", "subjects"]

for col in text_cols:
    df[col] = df[col].fillna("").astype(str)

def clean_text(text):
    tokens = re.split(r"[\/,;]", text)
    return " ".join([t.strip().lower() for t in tokens if t.strip()])

# 🔥 NEW: normalize title (remove volume info)
def normalize_title(title):
    title = title.lower()
    title = re.sub(r'\b(vol|volume|book|part)\s*\d+\b', '', title)
    title = re.sub(r'\b\d+\b$', '', title)
    title = re.sub(r'\s+', ' ', title)
    return title.strip()

for col in text_cols:
    df[col] = df[col].apply(clean_text)

df["combined_text"] = (
    df["title"] + " " +
    df["author"] + " " +
    df["description"] + " " +
    df["section"] + " " +
    df["subjects"]
)

# ===============================
# ML MODELS
# ===============================

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = embed_model.encode(df["combined_text"].tolist(), show_progress_bar=False)

tfidf = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=2)
tfidf_matrix = tfidf.fit_transform(df["combined_text"])

# ===============================
# COLLABORATIVE FILTERING (SVD)
# ===============================
def train_cf():
    ratings = pd.read_sql("SELECT user_id, book_id, status FROM borrows", engine)

    if ratings.empty:
        return None, None, None

    ratings["value"] = ratings["status"].apply(lambda x: 2 if x == "borrowed" else 1)

    matrix = ratings.pivot_table(
        index="user_id",
        columns="book_id",
        values="value",
        fill_value=0
    )

    if matrix.shape[1] < 2:
        return None, None, None

    svd = TruncatedSVD(n_components=min(10, matrix.shape[1] - 1))
    user_factors = svd.fit_transform(matrix)
    item_factors = svd.components_

    return matrix, user_factors, item_factors

user_item_matrix, user_factors, item_factors = train_cf()

# ===============================
# HELPERS
# ===============================
def get_user_books(user_id):
    q = """
    SELECT DISTINCT book_id
    FROM borrows
    WHERE user_id=%s AND status IN ('borrowed','returned')
    """
    res = pd.read_sql(q, engine, params=(user_id,))
    return res["book_id"].tolist()

def format_book(book_id, score, rec_type, reason):
    book = df[df["id"] == book_id]
    if book.empty:
        return None

    b = book.iloc[0]

    return {
        "id": int(book_id),
        "title": b["title"],
        "author": b["author"],
        "section": b["section"],
        "subjects": b["subjects"],
        "cover_image": b["cover_image"] if pd.notna(b["cover_image"]) else None,
        "score": float(score),
        "type": rec_type,
        "reason": reason
    }

# ===============================
# TF-IDF FALLBACK
# ===============================
def fallback_recommend(user_id, top_n=5):
    borrowed = get_user_books(user_id)
    if not borrowed:
        return []

    idxs = df[df["id"].isin(borrowed)].index.tolist()
    if not idxs:
        return []

    user_vec = np.mean(tfidf_matrix[idxs].toarray(), axis=0)
    sims = cosine_similarity([user_vec], tfidf_matrix)[0]
    ranked = np.argsort(sims)[::-1]

    results = []
    used = set()
    seen_titles = set()  # 🔥 NEW

    for i in ranked:
        book_id = int(df.iloc[i]["id"])
        title = df.iloc[i]["title"]
        base_title = normalize_title(title)

        if (
            book_id in borrowed or
            book_id in used or
            base_title in seen_titles
        ):
            continue

        rec = format_book(book_id, sims[i], "tfidf-fallback", "fallback similarity")
        if rec:
            results.append(rec)
            used.add(book_id)
            seen_titles.add(base_title)

        if len(results) >= top_n:
            break

    return results

# ===============================
# MAIN RECOMMENDER (HYBRID ML)
# ===============================
def recommend_for_user(user_id, top_n=10, min_score=0.1, override_borrowed_ids=None):

    if override_borrowed_ids is not None:
        borrowed = override_borrowed_ids
        min_score = 0.0
        log("[EVAL MODE] Using training data")
    else:
        borrowed = get_user_books(user_id)

    if not borrowed:
        return []

    idxs = df[df["id"].isin(borrowed)].index.tolist()
    if not idxs:
        return []

    results = []
    used = set()
    seen_titles = set()  # 🔥 NEW

    # ===========================
    # CONTENT-BASED (EMBEDDINGS)
    # ===========================
    user_vec = np.mean(embeddings[idxs], axis=0)
    sims = cosine_similarity([user_vec], embeddings)[0]

    for i in np.argsort(sims)[::-1]:

        book_id = int(df.iloc[i]["id"])
        title = df.iloc[i]["title"]
        base_title = normalize_title(title)

        if (
            book_id in borrowed or
            book_id in used or
            base_title in seen_titles
        ):
            continue

        if sims[i] < min_score:
            continue

        rec = format_book(book_id, sims[i], "content-ml", "semantic similarity")
        if rec:
            results.append(rec)
            used.add(book_id)
            seen_titles.add(base_title)

        if len(results) >= int(top_n * 0.6):
            break

    # ===========================
    # COLLABORATIVE (SVD)
    # ===========================
    if user_item_matrix is not None and user_id in user_item_matrix.index:

        uid = list(user_item_matrix.index).index(user_id)
        scores = np.dot(user_factors[uid], item_factors)

        ranked = sorted(
            zip(user_item_matrix.columns, scores),
            key=lambda x: x[1],
            reverse=True
        )

        for book_id, score in ranked:

            if score < 0.01:
                continue

            book_row = df[df["id"] == book_id]
            if book_row.empty:
                continue

            title = book_row.iloc[0]["title"]
            base_title = normalize_title(title)

            if (
                book_id in borrowed or
                book_id in used or
                base_title in seen_titles
            ):
                continue

            rec = format_book(book_id, score, "collaborative-ml", "SVD learning")
            if rec:
                results.append(rec)
                used.add(book_id)
                seen_titles.add(base_title)

            if len(results) >= top_n:
                break

    # ===========================
    # FALLBACK
    # ===========================
    if len(results) < top_n:
        fb = fallback_recommend(user_id, top_n)
        for r in fb:
            if r["id"] not in used:
                results.append(r)
            if len(results) >= top_n:
                break

    return results

# ===============================
# EVALUATION
# ===============================
def split_train_test(ratio=0.2):
    data = pd.read_sql("SELECT user_id, book_id FROM borrows", engine)

    groups = defaultdict(list)

    for _, r in data.iterrows():
        groups[r["user_id"]].append(r["book_id"])

    train, test = defaultdict(list), defaultdict(list)

    for u, books in groups.items():
        if len(books) < 5:
            continue

        random.shuffle(books)
        cut = int(len(books) * (1 - ratio))

        train[u] = books[:cut]
        test[u] = books[cut:]

    return train, test


def precision_recall_at_k(user_id, train, test, k=3):

    train_books = set(train.get(user_id, []))
    test_books = set(test.get(user_id, []))

    if not train_books or not test_books:
        return None

    recs = recommend_for_user(user_id, k, override_borrowed_ids=list(train_books))
    rec_ids = [r["id"] for r in recs if r["id"] not in train_books]

    hits = len(set(rec_ids) & test_books)

    return hits / k, hits / len(test_books)


def evaluate(k=3):
    train, test = split_train_test()

    p, r = [], []

    for u in test.keys():
        res = precision_recall_at_k(u, train, test, k)
        if res:
            p1, r1 = res
            p.append(p1)
            r.append(r1)

    if not p:
        return {"Precision@K": 0, "Recall@K": 0}

    return {
        "Precision@K": sum(p)/len(p),
        "Recall@K": sum(r)/len(r),
        "Users_Evaluated": len(p)
    }

# ===============================
# MAIN
# ===============================
if __name__ == "__main__":
    try:
        user_id = int(sys.argv[1])
        mode = sys.argv[2] if len(sys.argv) > 2 else "prod"

        if mode == "eval":
            print(json.dumps(evaluate(k=3), indent=2))
        else:
            recs = recommend_for_user(user_id, top_n=10)
            print(json.dumps(recs, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}))