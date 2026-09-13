# Bid Portal

Portal nội bộ gom hàng đồ cổ đang đấu giá từ nhiều sàn về một chỗ, để đội không phải mở từng site tìm tay mỗi ngày.

**v1 chỉ có HiBid.** LiveAuctioneers và Invaluable thuộc v2 — xem `docs/OPERATIONS.md` và kế hoạch trong `.omc/plans/`.

## Làm được gì

- Gõ một từ khóa → hệ thống crawl HiBid và trả kết quả đã chuẩn hoá.
- Mỗi món hiện **rõ loại giá** (giá khởi điểm / giá hiện tại / mua ngay / đã bán) kèm **ước tính của nhà đấu giá** bên cạnh — đây là phép so sánh chính, ví dụ *giá khởi điểm 300 USD so với ước tính 600–900 USD*.
- Lưu món quan tâm vào watchlist; bấm là mở thẳng trang gốc trên HiBid để đấu giá.
- Đăng nhập, 2 quyền: `admin` (quản lý nguồn, cài đặt) và `member`.
- Trang quản trị: kill-switch từng nguồn, lịch sử các lần crawl, trần ngân sách request.

## Chạy thử

```bash
docker compose up -d
npm install
cp .env.example .env        # sửa AUTH_SECRET: openssl rand -base64 32
npm run db:migrate
npm run -w @bid/db seed-sources
npm run db:seed-admin -- ban@congty.com

npm run dev:web      # http://localhost:3100
npm run dev:worker   # phải chạy, nếu không job tìm kiếm sẽ treo
```

## Cấu trúc

```
apps/web       Next.js — giao diện + API
apps/worker    crawler, hàng đợi job, bảo trì định kỳ
packages/db    schema Drizzle + truy vấn dùng chung
docs/          SPIKE-hibid.md (cách HiBid hoạt động), OPERATIONS.md (vận hành)
```

## Nguyên tắc thiết kế đáng nhớ

- **Không bao giờ crawl trong request của người dùng.** Tìm kiếm đọc từ kho đã crawl; từ khóa chưa có cache thì tạo job và UI poll tiến độ.
- **Giá không phải một con số.** Luôn đi cùng loại giá và tiền tệ. Không bao giờ so sánh trực tiếp hai loại giá khác nhau.
- **Thất bại phải ồn ào.** Một nguồn hỏng hiện thành trạng thái riêng của nguồn đó, không bao giờ biến thành danh sách ngắn im lặng.
- **Ngân sách request là phanh cứng**, không phải cảnh báo — chạm trần là worker dừng crawl.

## Lệnh hữu ích

```bash
npm test                                      # test parser + rate limiter
npm run -w @bid/worker search -- "tiffany lamp"   # thử adapter, không đụng DB
npm run -w @bid/worker crawl  -- "tiffany lamp"   # crawl vào DB
npm run -w @bid/worker refresh                    # cập nhật vòng đời listing
npm run -w @bid/worker purge                      # xoá dữ liệu quá 90 ngày
```

## Trước khi lên production

1. Điền tên người chịu trách nhiệm khiếu nại vào `docs/OPERATIONS.md`.
2. Đặt `RESEND_API_KEY` — chưa có thì cảnh báo adapter chỉ ghi log, không ai nhận được.
3. Đổi `CRAWLER_USER_AGENT` sang email liên hệ thật của đội.
4. Đặt `POSTGRES_PASSWORD` thật (mặc định `bid` chỉ dùng cho máy local).
5. `AUTH_SECRET` phải dài ≥32 ký tự và **không** còn là placeholder — app từ chối khởi động nếu vẫn là giá trị mẫu, vì ai đọc được repo cũng tự ký được token admin.

## Ghi chú bảo mật đáng nhớ

- **Không dùng Server Action cho thao tác cần quyền.** Next dispatch server action từ một bảng toàn cục không gắn với route, nên `requireAdmin()` ở page component và middleware trên `/admin` đều không bảo vệ được nó — một `member` gọi được action từ bất kỳ trang nào. Mọi thao tác quản trị ở đây đi qua API route tự kiểm tra quyền.
- Session là JWT không trạng thái, hạn 12 giờ. Hạ quyền admin → member chỉ có hiệu lực sau khi token hết hạn.
- Postgres trong `docker-compose.yml` chỉ bind `127.0.0.1`. Bỏ tiền tố đó là phơi database ra internet.
