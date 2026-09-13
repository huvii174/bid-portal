# Spike: HiBid search endpoint (Phase 0)

Ngày: 2026-09-13 · Kết luận: **Không cần Playwright, không cần proxy, không cần parse DOM.**

## Câu hỏi cần trả lời

Plan v2 §1 đặt câu hỏi mở: "HiBid có endpoint JSON search ổn định không?" — nếu có thì bỏ được Playwright khỏi Phase 2, giảm mạnh Risk 1 (anti-bot) và Risk 3 (selector hỏng).

## Kết quả

### 1. robots.txt cho phép

`https://hibid.com/robots.txt`, khối `User-agent: *` disallow:

```
*/livecatalog/   */webcast/   /auctioneer/   */account/
*/catalog/print/   /error/   /auctions/current/map/
/auctions/past/*?q=*   /auctions/past/*&q=*   /hibiddemo/
```

Đường dẫn ta dùng — `/lots?q=...` (tìm lot đang mở) — **không nằm trong danh sách chặn**. Chỉ tìm kiếm trong *phiên đã kết thúc* (`/auctions/past/*?q=*`) mới bị chặn, và ta không dùng path đó.

Khối `User-agent: *` **không đặt `Crawl-delay`** (chỉ nhóm bingbot có `Crawl-delay: 5`). Ta vẫn tự áp ≥2s/request theo plan.

### 2. Dữ liệu là JSON nhúng sẵn, không phải HTML cần parse

`GET https://hibid.com/lots?q=<keyword>&apage=<N>` → HTTP 200, HTML có chứa:

```html
<script id="hibid-state">{"apollo.state": { ... }}</script>
```

Đây là Angular TransferState mang theo **Apollo GraphQL cache đã chuẩn hoá**. Một request cho về 100 Lot + các Auction/Auctioneer liên quan, đầy đủ field có kiểu dữ liệu rõ ràng.

Cấu trúc:

```
apollo.state
├── ROOT_QUERY
│   └── lotSearch({"input":{...}})
│       └── pagedResults { pageLength, pageNumber, totalCount, filteredCount,
│                          results: [{__ref:"Lot:316125846"}, ...] }   ← thứ tự kết quả
├── "Lot:<id>"        × 100
├── "Auction:<id>"    × ~69
└── "Auctioneer:<id>" × ~64
```

`results[]` giữ **đúng thứ tự xếp hạng** của HiBid → adapter chỉ cần resolve `__ref` sang entity.

### 3. Phân trang

`&apage=N`. Đã xác minh: `q=tiffany lamp` → trang 1 có 100 lot, trang 2 có 87 lot, **overlap = 0** (hoàn toàn rời nhau) → tổng 187 lot.

**Kích thước trang của HiBid là 100.** Trang trả về < 100 lot là trang cuối.

Hai cái bẫy đã trả giá để phát hiện (đều gây lỗi thật lúc triển khai):

1. **`pagedResults.pageLength` và `totalCount` đều vô dụng cho phân trang.** Cả hai luôn bằng đúng số lot được hydrate trong request đó (trang 1 của "tiffany lamp" báo 100, trang 2 báo 87; "rococo table" chỉ có 35 kết quả thì báo 35). Nên điều kiện `results.length < pageLength` **không bao giờ đúng** → luôn gọi thừa một trang không tồn tại. Phải so với hằng số 100.

2. **Trang vượt quá kết quả cuối được render KHÔNG kèm `lotSearch`.** Đây là "hết kết quả", không phải adapter hỏng. Nếu gộp hai trường hợp này làm một thì mọi tìm kiếm chỉ có một trang đều bắn cảnh báo giả — và đội sẽ học cách phớt lờ cảnh báo, phá đúng cơ chế bảo vệ quan trọng nhất. Adapter phân biệt: **thiếu hẳn `<script id="hibid-state">` = hỏng thật (throw); có state nhưng không có `lotSearch` = hết trang (trả rỗng)**.

### 3b. User-Agent không ảnh hưởng kết quả

Đã đo đối chứng cùng từ khóa: UA Chrome và UA trung thực `BidPortal/0.1 (... contact: ...)` đều trả **35 kết quả như nhau**. Nghĩa là **không cần giả dạng trình duyệt** — giữ UA trung thực kèm email liên hệ, đúng khuyến nghị pháp lý, mà không mất gì.

### 3c. Giới hạn đã biết: ~10% lot thiếu Auction

Trang search không hydrate đủ `Auction` cho mọi `Lot` (đo thực tế: 4/39 lot không có auction đi kèm). Hệ quả: các lot đó **thiếu `currency` và `ends_at_utc`**.

Đã giảm nhẹ bằng cách lấy currency dự phòng từ chuỗi `estimate` (có sẵn mã tiền tệ). Phần còn lại (3/39) đành để trống.

Không khắc phục triệt để ở v1: cách duy nhất là fetch riêng từng trang lot, tức nhân số request lên hàng chục lần — đúng thứ `daily_page_budget` sinh ra để ngăn. UI phải hiển thị tử tế khi thiếu hai trường này.

### 4. Field của Lot (dùng cho normalize)

| Field | Ví dụ | Map sang |
|---|---|---|
| `id` | `316125846` | `source_listing_id` |
| `lead` | "Tiffany Studios Aladdin Floor Lamp, ca. 1910" | `title` |
| `description` | text dài | `description` |
| `lotNumber` | `129` | `lot_no` |
| `estimate` | `"2,000.00 - 4,000.00 USD"` | `estimate_low/high` + currency |
| `bidAmount` | `123.45` | giá hiện tại |
| `featuredPicture.thumbnailLocation` | CDN url | `thumb_url` |
| `featuredPicture.hdThumbnailLocation` | url có `&h=400&w=400` | thumbnail 400px — **đúng quy tắc ≤400px của plan** |
| `auction.__ref` | `"Auction:766463"` | liên kết `Auction` |

`lotState` (quyết định `price_kind` và `status`):

```
bidCount, highBid, minBid, buyNow, priceRealized,
isClosed, isLive, isNotYetLive, isArchived,
reserveSatisfied, productStatus, quantitySold
```

### 5. Field của Auction

```
id, eventName, bidOpenDateTime, bidCloseDateTime,
eventDateBegin, eventDateEnd, currencyAbbreviation,
auctioneer (__ref), buyerPremium, buyerPremiumRate,
lotCount, eventCity, eventState, auctionState
```

`currencyAbbreviation` là **nguồn xác thực cho tiền tệ** (chuỗi `estimate` cũng có nhưng kém tin cậy hơn).
`buyerPremium` / `buyerPremiumRate` có sẵn — hữu ích cho v2 khi so giá thực trả.

## Tác động lên plan

| Mục plan | Thay đổi |
|---|---|
| Phase 2 (adapter HiBid) | `fetch` + `JSON.parse`. Bỏ Playwright, bỏ cheerio, bỏ proxy. |
| Risk 1 (anti-bot) | Không áp dụng cho v1. |
| Risk 3 (selector hỏng) | Giảm mạnh: khoá JSON (`lead`, `estimate`, `lotState`) bền hơn CSS selector nhiều. Vẫn giữ contract test + cảnh báo `zero_results` vì HiBid có thể đổi tên field hoặc bỏ TransferState. |
| Risk 4 (ngân sách request) | 100 lot/1 page-load → K=2 trang = 2 request cho tới 200 lot/từ khóa. Rất rẻ. |
| Risk 9 (worker OOM) | Không áp dụng cho v1 (không có Chromium). |

## Điểm cần canh chừng

1. **TransferState có thể bị bỏ** nếu HiBid đổi sang CSR thuần → adapter chết. Contract test + alarm `zero_results` sẽ bắt được.
2. `estimate` là **chuỗi tự do** (`"2,000.00 - 4,000.00 USD"`, đôi khi rỗng hoặc chỉ một số) → parser phải chịu được mọi biến thể, luôn giữ `raw_price_text`.
3. `countAsView: true` trong query input — HiBid tính lượt xem. Không thể tắt qua URL; thêm một lý do nữa để giữ tần suất crawl thấp.
4. Kích thước trang ~1.6–2 MB HTML. Không nặng, nhưng nhân với số saved search thì vẫn nên đếm vào `daily_page_budget`.
