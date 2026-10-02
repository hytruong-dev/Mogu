-- Enum import_job_status đã tồn tại từ 20260812 (không có DRAFTING); migration 20260828
-- dùng CREATE TYPE ... EXCEPTION WHEN duplicate_object nên không bổ sung giá trị mới.
-- Thêm DRAFTING để bước 6 của pipeline AI Import persist được trạng thái.
ALTER TYPE "import_job_status" ADD VALUE IF NOT EXISTS 'DRAFTING' BEFORE 'DONE';
