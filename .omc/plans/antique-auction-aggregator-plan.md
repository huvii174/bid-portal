# Plan: Portal tổng hợp đồ cổ đấu giá (Antique Auction Aggregator)

Status: **pending approval**
Ngày tạo: 2026-09-13 · Bản: **v2** (sửa sau Critic review — xem Changelog cuối file)
Loại: Interview mode (direct), không phải consensus/ralplan

## 1. Requirements Summary

Web nội bộ cho một nhóm nhỏ (vài người trong đội/cửa hàng đồ cổ) để:

- Nhập **1 từ khóa** → hệ thống crawl và gộp kết quả từ các site đấu giá đồ cổ. **v1 chỉ HiBid**; LiveAuctioneers và Invaluable là v2, thêm từng site một sau khi v1 được dùng thật.
- Chuẩn hoá dữ liệu (loại giá, tiền tệ, giờ đóng phiên, ảnh, danh mục) để so sánh được.
- **Watchlist**: lưu hàng quan tâm; muốn đấu giá thật thì bấm nút **mở tab sang site gốc** — không đấu giá/thanh toán trong app.
- **Saved search** + crawl định kỳ + **email digest** khi có hàng mới khớp (v1.5, ngay sau khi v1 chạy ổn 2 tuần).
- Đăng nhập, 2 role: `admin` (quản lý nguồn, user, kill-switch) và `member` (tìm kiếm, watchlist, saved search).

**Quyết định đã chốt cùng người dùng (không hỏi lại):**

- Crawler tự động; người dùng đã chấp nhận rủi ro ToS/anti-bot kể cả sau khi biết robots.txt của LiveAuctioneers/Invaluable chặn path tìm kiếm và Invaluable đặt `Crawl-delay: 10`.
- Nhóm nhỏ nội bộ, không phải sản phẩm thương mại công khai.
- "Chọn hàng" = lưu watchlist + link ra site gốc.
- Stack do assistant chọn. Alert/saved-search là must-have.
- Áp dụng toàn bộ Must-fix + Should-fix từ Critic review và cắt v1 thành walking skeleton.

**Quyết định kỹ thuật chốt trong bản v2 (giải quyết các lỗ hổng review chỉ ra):**

| Chủ đề | Quyết định |
|---|---|
| Mô hình tìm kiếm | **On-demand + bất đồng bộ.** Gõ từ khóa → tạo `SearchJob` → worker crawl → UI poll và hiện dần kết quả theo từng site. Kết quả cache theo `(keyword, source)` với TTL 6h; từ khóa đã cache trả <1s. Saved search = cùng query chạy lại theo lịch. |
| Ngữ nghĩa từ khóa | Truyền **nguyên văn** cho từng site (không tự stemming), lấy **K=2 trang đầu** mỗi site. Tìm nội bộ bằng Postgres `tsvector` + GIN (fallback `pg_trgm`), **không** dùng `ILIKE '%kw%'`. |
| "Hàng mới" cho digest | Mới = **lần đầu tiên** xuất hiện cặp `(saved_search_id, listing_id)` trong `SearchMatch`. Không bao giờ báo lại, kể cả khi listing stale rồi xuất hiện lại. |
| Vòng đời listing | Vắng mặt **3 lần crawl liên tiếp** → `stale` (đánh dấu, **không xoá**). Job refresh riêng cho listing trong watchlist và listing kết thúc trong 48h qua để cập nhật `ended/sold/withdrawn`. |
| Múi giờ | UI hiện **giờ địa phương của đội** (cấu hình 1 timezone toàn hệ thống, mặc định `Asia/Ho_Chi_Minh`) + đếm ngược; hover hiện giờ gốc + timezone nguồn. |
| Queue/scheduler | **`pg-boss` trên Postgres** — không Redis, không BullMQ. Đủ cron, retry/backoff, dead-letter cho vài chục job/ngày. |
| Chống-bot | v1 **không proxy, không Playwright** nếu fetch thường/endpoint JSON đủ. Với site khó (v2): **timebox 5 ngày làm việc/adapter**; ưu tiên bắt endpoint JSON nội bộ; nếu thất bại → **dịch vụ unblocker quản lý** (Bright Data Web Unlocker / Zyte / ScrapingBee, trả theo request) thay vì tự vận hành stealth + residential proxy; hết timebox vẫn chặn → **ship không có site đó**. |
| Ngân sách request | Bộ giới hạn toàn cục: tối đa **300 page-load/ngày** toàn hệ thống (cấu hình được), tự dừng crawl khi vượt và cảnh báo. Playwright (nếu dùng) **chặn image/font/media**. Công thức theo dõi: `saved_searches × sources × K trang × lần chạy/ngày` phải < ngưỡng. |
| Chi phí vận hành thật | Ghi nhận: **2–8 giờ/tháng/adapter** sửa khi site đổi giao diện, vô thời hạn. Đây là chi phí chính, không phải proxy. |
| Pháp lý (doanh nghiệp) | **Không bao giờ crawl sau đăng nhập** trên site nguồn. Không tái xuất bản dữ liệu/ảnh full-size. Link nguồn trên mọi card. Giữ dữ liệu 90 ngày sau khi phiên kết thúc. **Chỉ định 1 người phụ trách** nhận và xử lý khiếu nại/takedown (điền tên vào `docs/OPERATIONS.md`). Crawler dùng danh tính/IP tách biệt khỏi tài khoản đấu giá thật của đội. |
| Hoãn sang v2 | Dedupe chéo site (`ListingGroup`), quy đổi tiền tệ (FX), LiveAuctioneers, Invaluable. |

## 2. Stack

- **App**: Next.js (bản **stable hiện tại** tại thời điểm scaffold, không pin 14) + TypeScript, App Router.
- **DB**: PostgreSQL (Railway/Supabase/Neon). **ORM: Drizzle** (nhẹ hơn Prisma trong container worker).
- **Queue/cron**: `pg-boss` (chạy trên cùng Postgres).
- **Worker**: Node.js; HTTP fetch + cheerio trước; Playwright chỉ khi bắt buộc (v2). Nếu dùng Playwright: container worker **≥1 GB RAM** (Fly.io mặc định sẽ OOM).
- **FTS**: Postgres `tsvector` + GIN.
- **Email**: Resend (digest + cảnh báo adapter lỗi).
- **Auth**: NextAuth (email/password), 2 role, middleware theo route.
- **Hosting**: Railway hoặc Fly.io (web + worker + Postgres managed).

## 3. Data Model

```
User             (id, email, password_hash, role: admin|member, created_at)
Source           (id, key: hibid|liveauctioneers|invaluable, name, base_url, enabled, robots_note)
AdapterRun       (id, source_id, search_job_id?, started_at, finished_at,
                  status: ok|error|blocked|zero_results, items_found, pages_fetched, error_text)
SearchJob        (id, keyword, requested_by_user_id, saved_search_id?, created_at,
                  status: queued|running|done|partial|failed)
KeywordCache     (keyword, source_id, fetched_at, expires_at)     -- TTL 6h
AuctionHouse     (id, source_id, name)
Auction          (id, auction_house_id, title, starts_at_utc, ends_at_utc, format: timed|live|sealed)
Listing          (id, source_id, source_listing_id, auction_id?, url, title, thumb_url,
                  source_category, lot_no, currency, price_kind, price_amount, raw_price_text,
                  ends_at_utc, ends_at_tz, end_time_is_approximate,
                  status: active|ended|sold|withdrawn|stale,
                  first_seen_at, last_seen_at, missing_streak, raw_json)
ListingKeyword   (listing_id, keyword, source_id, last_matched_at)  -- kết quả nào thuộc từ khóa nào
SavedSearch      (id, user_id, keyword, cadence_hours, enabled, last_run_at, created_at)
SearchMatch      (saved_search_id, listing_id, first_seen_at, notified_at)  -- PK (saved_search_id, listing_id)
WatchlistItem    (id, user_id, listing_id, note, created_at)
Notification     (id, user_id, kind: digest|adapter_alert, payload_json, sent_at)
Setting          (key, value)   -- timezone, daily_page_budget, ...
```

v2 sẽ thêm `ListingGroup`/`ListingGroupItem` (dedupe) và `FxRate`.

Nguyên tắc giữ nguyên từ v1: giá luôn là `{price_kind, price_amount, currency, raw_price_text}`; thời gian luôn là UTC + tz gốc + cờ xấp xỉ; chỉ cache thumbnail ≤400px.

## 4. Implementation Steps

### v1 — Walking skeleton (1 site, end-to-end)

**Phase 0 — Spike 30 phút + Scaffold**
- Spike: mở HiBid, bắt Network tab, xác định có endpoint JSON search ổn định không. Ghi kết quả vào `docs/SPIKE-hibid.md`. Nếu có → adapter dùng fetch JSON, không Playwright.
- Monorepo: `apps/web` (Next.js), `apps/worker` (Node + pg-boss), `packages/db` (Drizzle schema + client).
- `packages/db/src/schema.ts` — toàn bộ model mục 3.
- `packages/db/drizzle/` — migration đầu tiên, gồm GIN index trên `Listing.title` (tsvector).
- `.env.example`, `docker-compose.yml` (Postgres local).

**Phase 1 — Auth & roles (làm ngay, mọi bảng phía sau đều gắn `user_id`)**
- `apps/web/auth.ts` — NextAuth credentials provider.
- `apps/web/middleware.ts` — chặn mọi route trừ `/login`; `/admin/*` chỉ `admin`.
- `apps/web/app/login/page.tsx`, script seed admin đầu tiên `packages/db/scripts/seed-admin.ts`.

**Phase 2 — Adapter HiBid**
- `apps/worker/src/adapters/types.ts` — interface `Adapter { search(keyword, page): Promise<RawListing[]> }`.
- `apps/worker/src/adapters/hibid/index.ts` — fetch (JSON nếu spike thành công, nếu không thì HTML + cheerio), K=2 trang.
- `apps/worker/src/adapters/hibid/fixtures/*.html|json` — mẫu lưu sẵn.
- `apps/worker/src/adapters/hibid/index.test.ts` — contract test: đủ `title, url, price_kind, price_amount, currency, ends_at`, đúng kiểu.
- `apps/worker/src/rate-limit.ts` — pacing per-source (HiBid: ≥2s/request, ngẫu nhiên ±50%) + bộ đếm ngân sách toàn cục đọc từ `Setting.daily_page_budget`.

**Phase 3 — Pipeline chuẩn hoá + lưu + health**
- `apps/worker/src/pipeline/normalize.ts` — `RawListing → Listing` (giá, giờ, tz, thumbnail).
- `apps/worker/src/pipeline/upsert.ts` — upsert theo `(source_id, source_listing_id)`, cập nhật `last_seen_at`, reset `missing_streak`, ghi `ListingKeyword`.
- `apps/worker/src/pipeline/health.ts` — ghi `AdapterRun`; `zero_results` khi 0 item mà từ khóa đó từng có kết quả; gửi email `adapter_alert` cho admin khi `error|blocked|zero_results`.
- Unit test `normalize.test.ts` với input thô đa dạng.

**Phase 4 — Tìm kiếm on-demand bất đồng bộ**
- `apps/web/app/api/search/route.ts` — POST: kiểm tra `KeywordCache`; nếu còn hạn → trả kết quả từ DB (<1s); nếu không → tạo `SearchJob`, enqueue pg-boss, trả `job_id`.
- `apps/web/app/api/search/[jobId]/route.ts` — GET: trạng thái từng source + kết quả đã có.
- `apps/worker/src/jobs/search.ts` — chạy adapter theo từng source đang `enabled`, gọi pipeline, cập nhật `KeywordCache`, đánh dấu job `done|partial`.
- `apps/web/app/search/page.tsx` — ô nhập; poll mỗi 2s; hiển thị tiến độ theo site ("HiBid: đang lấy trang 2/2…"); dòng "Kiểm tra lần cuối: HH:mm" cho kết quả cache.

**Phase 5 — Card kết quả + click-out**
- `apps/web/components/ListingCard.tsx` — thumbnail, tiêu đề, **badge nguồn**, giá kèm nhãn loại rõ ràng ("Ước tính $200–300" ≠ "Giá hiện tại $150"), đếm ngược theo giờ đội (hover: giờ gốc + tz), badge `stale`/`ended`, nút **"Xem trên HiBid"** (`target=_blank rel=noopener`), nút "Lưu quan tâm".

**Phase 6 — Watchlist + vòng đời listing**
- `apps/web/app/api/watchlist/route.ts`, `apps/web/app/watchlist/page.tsx`.
- `apps/worker/src/jobs/refresh-listings.ts` (cron 6h): re-fetch listing trong watchlist + listing `ends_at_utc` trong 48h qua → cập nhật `ended|sold|withdrawn`; listing `missing_streak ≥ 3` → `stale`.
- Watchlist item đã kết thúc hiện "Đã kết thúc <ngày>" + giá cuối cùng + link gốc vẫn bấm được.

**Phase 7 — Admin: nguồn, kill-switch, health**
- `apps/web/app/admin/sources/page.tsx` — bật/tắt từng `Source`; bảng `AdapterRun` gần nhất; ngân sách page-load hôm nay đã dùng/tối đa.
- `apps/web/app/admin/settings/page.tsx` — timezone, `daily_page_budget`.

**Phase 8 — Deploy + vận hành + DỪNG DÙNG THẬT 2 TUẦN**
- Deploy web + worker + Postgres lên Railway/Fly.io.
- `apps/worker/src/jobs/retention.ts` (cron ngày): xoá listing `ended/sold/withdrawn/stale` quá 90 ngày, purge thumbnail mồ côi.
- `docs/OPERATIONS.md` — tên người phụ trách khiếu nại, cách tắt 1 nguồn, cách đọc health, checklist recall hàng tháng (so tay 3 từ khóa giữa HiBid và tool).
- **Cổng kiểm tra**: đội dùng thật 2 tuần với từ khóa thật. Chỉ đi tiếp v1.5 khi đội xác nhận "đỡ phải vào HiBid check tay".

### v1.5 — Saved search + digest (sau cổng 2 tuần)
- `apps/web/app/saved-searches/page.tsx` + API CRUD.
- `apps/worker/src/jobs/saved-search.ts` — pg-boss cron theo `cadence_hours` (mặc định 12h; cân nhắc 6h cho lot mở-đóng trong ngày), tái dùng job search, ghi `SearchMatch` với `first_seen_at`.
- `apps/worker/src/jobs/digest.ts` — cron ngày: gom `SearchMatch` có `notified_at IS NULL`, gửi 1 email/user qua Resend, set `notified_at`.

### v2 — Mở rộng nguồn (mỗi site 1 timebox 5 ngày)
- LiveAuctioneers → Invaluable (`Crawl-delay ≥10s` cứng trong rate limiter). Thứ tự: spike endpoint JSON → fetch thường → Playwright (chặn media, ≥1 GB RAM) → unblocker trả theo request → bỏ qua site nếu hết timebox.
- Dedupe chéo site (`ListingGroup`), test bằng **fixture lưu sẵn**, không bằng listing sống.
- Quy đổi tiền tệ: `FxRate` cập nhật ngày, `display_currency` theo đội, luôn giữ `price_amount` gốc.

## 5. Acceptance Criteria (v1 walking skeleton)

- [ ] AC1a — Từ khóa **chưa có cache**: submit → job hoàn tất ≤60s; UI hiện tiến độ từng site trong khi chờ; kết quả xuất hiện dần, không phải chờ hết mới hiện.
- [ ] AC1b — Từ khóa **đã cache <6h**: kết quả hiển thị <1s, kèm dòng "Kiểm tra lần cuối: HH:mm".
- [ ] AC2 — Mỗi card có: thumbnail, tiêu đề, badge nguồn, giá kèm nhãn `price_kind` rõ ràng, đếm ngược theo giờ đội (hover thấy giờ gốc + tz), nút "Xem trên HiBid" mở tab mới đúng URL listing gốc.
- [ ] AC3 — Listing vắng mặt 3 lần crawl liên tiếp → `status = stale`, card hiện badge "Có thể đã gỡ", **không bị xoá** khỏi DB.
- [ ] AC4 — Watchlist item có phiên đã kết thúc hiện "Đã kết thúc <ngày>" + giá cuối + link gốc vẫn hoạt động; watchlist tồn tại sau đăng xuất/đăng nhập lại và chỉ user đó thấy.
- [ ] AC5 — Mọi route trừ `/login` yêu cầu đăng nhập; `member` vào `/admin/*` bị 403/redirect; `admin` vào được.
- [ ] AC6 — Admin tắt HiBid → job search tiếp theo bỏ qua HiBid, trả `partial` với thông báo "Nguồn HiBid đang tắt", không crash.
- [ ] AC7 — Cố tình làm adapter lỗi (đổi selector/endpoint sai) → `AdapterRun.status = error` hiện trên `/admin/sources` **và** admin nhận email `adapter_alert` trong ≤5 phút; UI search hiện "HiBid: lỗi" thay vì danh sách rỗng im lặng.
- [ ] AC8 — Đặt `daily_page_budget = 5` → sau 5 page-load worker dừng crawl, `AdapterRun.status = blocked` với lý do "budget", admin nhận cảnh báo.
- [ ] AC9 — Rate-limit audit: log timestamp mọi request tới HiBid; khoảng cách giữa 2 request liên tiếp ≥2s (hoặc ≥10s với Invaluable ở v2).
- [ ] AC10 — Retention: listing `ended` có `ends_at_utc` > 90 ngày bị xoá sau cron, thumbnail tương ứng bị purge.
- [ ] AC11 (v1.5) — Tạo saved search X → sau lần chạy cron tiếp theo có listing mới khớp X → email digest liệt kê đúng các item mới; chạy cron lần nữa **không** gửi lại item đã báo, kể cả item đó stale rồi xuất hiện lại.

## 6. Risks and Mitigations

| # | Rủi ro | Mức | Giảm thiểu (cụ thể, có thể hành động) |
|---|---|---|---|
| 1 | Anti-bot (Cloudflare Turnstile/PerimeterX) trên LiveAuctioneers/Invaluable ở v2 | Cao | Timebox 5 ngày/adapter; ưu tiên endpoint JSON; fallback unblocker trả theo request (không tự vận hành stealth); hết timebox → ship không có site đó. v1 không đụng tới. |
| 2 | Vi phạm robots.txt/ToS (path search bị Disallow trên 2/3 site) — đã được chấp nhận | Cao | Nội bộ, không tái xuất bản, thumbnail ≤400px, link nguồn mọi card, retention 90 ngày (job Phase 8), **không crawl sau đăng nhập**, kill-switch từng site, 1 người phụ trách khiếu nại ghi tên trong `docs/OPERATIONS.md`. |
| 3 | Selector/endpoint hỏng → thu thập thiếu **âm thầm**, đội mất niềm tin và quay lại check tay | Cao | Contract test theo fixture; `zero_results` alarm; email cảnh báo admin (không chỉ dashboard); checklist recall hàng tháng so tay 3 từ khóa. |
| 4 | Chi phí request vượt kiểm soát (proxy tính theo GB, Playwright 2–5 MB/trang) | Trung bình | v1 không proxy. Bộ giới hạn `daily_page_budget` tự dừng (AC8). Playwright chặn media. Công thức volume ghi trong §1. |
| 5 | Nhầm giá do khác `price_kind`/tiền tệ | Trung bình | Schema bắt buộc `price_kind`; UI luôn hiện nhãn; **không** so sánh chéo tiền tệ cho tới khi có `FxRate` (v2). |
| 6 | Cold-start: từ khóa mới không có dữ liệu | Trung bình | Đã thiết kế on-demand async + cache TTL (AC1a/1b). |
| 7 | Chi phí bảo trì adapter dài hạn (2–8 h/tháng/adapter) | Trung bình | Ghi nhận công khai trong plan; mỗi site thêm vào phải qua cổng "đội có thực sự cần site này không". |
| 8 | Crawler làm liên luỵ tài khoản đấu giá thật của đội | Trung bình | Danh tính/IP crawler tách biệt hoàn toàn; không bao giờ đăng nhập. |
| 9 | Worker OOM khi chạy Chromium (v2) | Thấp | Container worker ≥1 GB RAM; chặn media. |
| 10 | Digest 24h quá chậm với lot mở-đóng trong ngày | Thấp-TB | `cadence_hours` cấu hình được; đo trong 2 tuần dùng thật trước khi quyết định. |

## 7. Verification Steps

1. **Unit**: `normalize.test.ts` — input thô đa dạng (estimate range, current bid, buy-now, giờ live không xác định) → đúng schema; `rate-limit.test.ts` — pacing và ngân sách.
2. **Contract**: `adapters/hibid/index.test.ts` chạy trên fixture, assert field bắt buộc + kiểu.
3. **E2E search** (Playwright test trên app, không phải site nguồn): đăng nhập → tìm "Tiffany lamp" → thấy tiến độ → thấy card → bấm "Xem trên HiBid" mở đúng URL → lưu watchlist → đăng xuất/đăng nhập → vẫn thấy.
4. **Lifecycle**: seed 1 listing, chạy 3 lần job với fixture không chứa nó → `stale`; seed listing `ends_at` quá khứ → refresh job set `ended`, watchlist hiện đúng.
5. **Failure**: đổi endpoint sai → `AdapterRun.error` + email admin ≤5 phút + UI báo lỗi.
6. **Budget**: set budget 5 → dừng đúng lúc (AC8).
7. **Rate-limit audit**: đọc log request, kiểm tra khoảng cách.
8. **Retention**: seed listing cũ 91 ngày → cron xoá + purge thumbnail.
9. **Security**: không secret trong repo; middleware chặn đúng role; worker chỉ fetch host trong allowlist `Source.base_url` (chặn SSRF); `rel=noopener` trên link ngoài.
10. **Cổng 2 tuần**: đội dùng thật; ghi lại số lần vẫn phải vào HiBid check tay. Đi tiếp v1.5 chỉ khi con số này giảm rõ.

## Changelog v2 (áp dụng từ Critic review)

**Must-fix, đã áp dụng:**
1. Search chuyển sang on-demand bất đồng bộ + `KeywordCache` TTL; AC1 tách thành AC1a/1b.
2. Timebox 5 ngày/adapter, fallback unblocker trả theo request, điều kiện dừng "ship không có site đó"; bỏ "Playwright + stealth" khỏi mitigation.
3. Ngân sách request có con số (`daily_page_budget`, mặc định 300), bộ giới hạn tự dừng (AC8), chặn media trong Playwright, công thức volume.
4. Auth chuyển từ Phase 8 lên Phase 1.
5. Vòng đời listing: `missing_streak`, job refresh, AC3/AC4, "kiểm tra lần cuối".
6. Ngữ nghĩa từ khóa (nguyên văn, K=2), Postgres FTS thay `ILIKE`, checklist recall hàng tháng.
7. Định nghĩa "hàng mới" cho digest; timezone đội + hover giờ gốc.

**Should-fix, đã áp dụng:**
- Bỏ Redis/BullMQ → `pg-boss`. Dedupe hoãn sang v2, test bằng fixture. Next.js stable hiện tại thay vì pin 14. Drizzle thay Prisma. Thêm job retention 90 ngày + purge thumbnail (Phase 8, AC10). Email cảnh báo adapter lỗi (AC7). Không crawl sau đăng nhập + người phụ trách khiếu nại. Ghi nhận chi phí bảo trì 2–8 h/tháng/adapter. Worker ≥1 GB RAM khi dùng Chromium. FX/quy đổi tiền tệ đưa vào v2.

**Cắt scope:** v1 = walking skeleton 1 site (HiBid) end-to-end, dừng dùng thật 2 tuần; v1.5 = saved search + digest; v2 = LiveAuctioneers, Invaluable, dedupe, FX.

**Câu hỏi mở còn lại (không chặn, xử lý trong Phase 0 spike / cổng 2 tuần):** HiBid có endpoint JSON ổn định không; đội có chấp nhận trả theo request cho unblocker ở v2 không; cadence digest 12h hay 6h.

---

*Plan này ở trạng thái **pending approval**. Chưa có file code nào được tạo, chưa có lệnh mutate nào được chạy. Cần bạn xác nhận trước khi bắt đầu triển khai.*
