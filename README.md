# Frontend Deep Lab

Ứng dụng học frontend từ tài liệu chính thức của **MDN, React, TypeScript và Next.js**, xây dựng bằng Next.js, React, TypeScript và Tailwind CSS.

## Chức năng

- Đọc tài liệu, tìm kiếm và đánh dấu bài đã đọc.
- Dịch bài viết sang tiếng Việt bằng Groq, trình bày thuật ngữ theo dạng **tiếng Việt (English)**; giữ nguyên tên riêng, code và đường dẫn.
- Chuyển sang bản gốc tiếng Anh để đối chiếu.
- Hỏi AI về nội dung bài đang đọc.
- Lưu bản dịch để tái sử dụng, giảm số lần gọi API.

## Yêu cầu

- Node.js **22.12 trở lên**, npm và Git.
- Kết nối Internet để tải tài liệu và gọi API.
- Groq API key để sử dụng dịch thuật và trợ lý AI.

## Cách chạy

Chạy các lệnh trong thư mục dự án.

### 1. Cài thư viện

```bash
npm install
```

### 2. Cấu hình API

Sao chép `.env.example` thành `.env.local`. Trên Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Điền API key của bạn vào `.env.local`:

```dotenv
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TRANSLATION_MODEL=openai/gpt-oss-20b
```

`GROQ_TRANSLATION_MODEL` là tùy chọn; nếu bỏ trống, phần dịch sử dụng `GROQ_MODEL`. Không chia sẻ API key. Sau khi sửa cấu hình, khởi động lại server.

### 3. Đồng bộ tài liệu

```bash
npm run docs:sync
```

Lệnh này tải tài liệu MDN, React và TypeScript từ GitHub, đọc tài liệu Next.js đi kèm phiên bản đã cài, rồi tạo dữ liệu và chỉ mục tìm kiếm trong `data/`. Lần đầu có thể mất vài phút.

**Cần chạy bước này trước khi chạy hoặc build trên máy mới**, vì `data/` không được lưu trong Git. Chạy lại khi muốn cập nhật tài liệu.

### 4. Khởi động

```bash
npm run dev
```

Mở [http://localhost:3000/learn](http://localhost:3000/learn).

Bản dịch được tạo khi bạn mở bài và lưu trong `data/translations/vi/`. Lần đọc đầu có thể chậm; nếu API chạm giới hạn, chờ rồi chọn **Thử dịch lại**, hoặc đọc **Bản gốc (English)**.

## Chạy bản production

Sau khi cấu hình API và đồng bộ tài liệu:

```bash
npm run build
npm run start
```

## Kiểm tra

```bash
npm run lint
npm test
npx tsc --noEmit
```

Để kiểm tra các trang và API cơ bản, giữ server đang chạy và mở terminal khác:

```bash
npm run test:smoke
```

Nếu server dùng cổng khác:

```bash
npm run test:smoke -- http://localhost:3001
```
