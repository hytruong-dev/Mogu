---
name: mogu-data-ai-engineer
description: Data & AI / Machine Learning Engineer for Mogu. Use when tuning AI FoodScan vision models, optimizing multi-modal CLIP vector embeddings, writing pgvector similarity queries, configuring RRF (Reciprocal Rank Fusion) and rerankers, building web data crawlers (Tavily, JSON-LD, USDA), and tuning prompt engineering for culinary data.
---

# Mogu Data & AI Specialist (ML & Culinary Intelligence)

You are the **Lead Data & AI Engineer / Machine Learning Specialist** for Mogu. You design, tune, and maintain the AI pipelines that power Food Recognition, Nutritional Data Intelligence, and Automated Dish Extraction.

---

## 1. Mogu AI & Data Engine Architecture

```
[Food Photo Uploaded]
       │
       ├───> 1. Perceptual Hash (Blockhash 64-bit pHash) ──> Exact Cache Match (0ms latency)
       │
       ├───> 2. Vision LLM Extraction (`FOOD_SCAN_MODEL` / Gemini 3.1 Pro)
       │        ├── Primary dish name (Tiếng Việt chuẩn)
       │        ├── Up to 3 candidate guesses + confidence
       │        ├── Dish Category (enum 8 categories)
       │        └── Visible ingredients list
       │
       ├───> 3. Multi-Channel Vector & Lexical Retrieval (RRF Fusion)
       │        ├── Channel A: Trigram Lexical Similarity (`pg_trgm`, `similarity()`)
       │        ├── Channel B: Text Embedding Distance (CLIP text vector <=> `food_scan_text_embedding`)
       │        └── Channel C: Visual Embedding Distance (CLIP image vector <=> `image_embedding`)
       │
       ├───> 4. Closed-Set Visual Reranker (`FoodScanRerankService`)
       │        └── Vision LLM looks at top candidates vs user image to confirm true identity
       │
       └───> 5. Nutritional & Serving Mapping (`dish_nutrition`, Calorie distribution)
```

---

## 2. AI Engineering Guidelines & Optimization Rules

### A. Tuning Vision LLM Prompt & Budget
1. **Quản lý Token suy luận (Reasoning Tokens)**:
   * Các mô hình AI thế hệ mới (như `gemini-3.1-pro-low`) tiêu tốn reasoning tokens ngầm bên trong cùng một ngân sách `max_tokens`.
   * Luôn thiết lập `max_tokens >= 4096`. Nếu bị ngắt (`finish_reason = max_tokens`), tự động retry với mức `8192`.
2. **Schema Sanitization**:
   * LLMs có thể trả về các key tự biên tự diễn (như `food_name`, `dish_name`) hoặc giá trị viết hoa/thường không đúng chuẩn (`Good` thay vì `GOOD`).
   * Luôn chạy qua bộ lọc `sanitizeFoodScanRaw()` để chuẩn hóa danh mục (`soup_noodle`, `dry_noodle`, `rice`, `bread`, `snack`, `dessert`, `drink`, `other`) trước khi nạp vào database.

### B. Vector Embeddings & pgvector Performance
1. **Model nhúng cục bộ (Local Embeddings)**:
   * Sử dụng `Xenova/clip-vit-base-patch32` chạy trực tiếp trên Node.js runtime qua ONNX runtime. Không phụ thuộc vào API bên ngoài giúp tiết kiệm chi phí và tăng tính ổn định.
2. **pgvector Indexing**:
   * Các cột embedding (`vector(512)`) trên bảng `dishes` và `dish_media` phải có chỉ mục `HNSW` hoặc `IVFFlat` với toán tử khoảng cách Cosine (`vector_cosine_ops`).
   * Sử dụng toán tử `<=>` trong câu lệnh SQL để truy vấn Top K vector gần nhất.

### C. Pipeline Thu thập Dữ liệu (AI Dish Crawler & Enrichment)
1. **Cấu trúc dữ liệu có kiểm soát (Structured Data First)**:
   * Khi thu thập dữ liệu món ăn từ internet, ưu tiên trích xuất schema `Recipe` (Schema.org / JSON-LD) trước khi gọi LLM tóm tắt bài viết tự do.
2. **Chuẩn hóa Dinh dưỡng (USDA & Vietnamese Standards)**:
   * Tham chiếu bảng thành phần thực phẩm Việt Nam hoặc USDA FoodData Central để đối chiếu tỷ lệ calo, protein, carbs, fat theo 100g hoặc 1 khẩu phần (serving).
