import type { Dictionary } from './en'

/** Kiểu lấy từ `en`, nên thiếu một chuỗi là trình biên dịch báo lỗi ngay. */
export const vi: Dictionary = {
  formatLocale: 'vi-VN',
  htmlLang: 'vi',
  label: 'Tiếng Việt',

  app: {
    name: 'Bid Portal',
    tagline: 'Tổng hợp đồ cổ đấu giá từ nhiều sàn về một nơi.',
  },

  nav: {
    search: 'Tìm kiếm',
    watchlist: 'Quan tâm',
    sources: 'Nguồn',
    settings: 'Cài đặt',
    signOut: 'Thoát',
    currencyLabel: 'Tiền tệ quy đổi',
    keepOriginal: 'Giữ tiền gốc',
    languageLabel: 'Ngôn ngữ',
  },

  login: {
    email: 'Email',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    failed: 'Email hoặc mật khẩu không đúng.',
  },

  search: {
    title: 'Tìm hàng',
    placeholder: 'Ví dụ: tiffany lamp, rococo table, bronze statue…',
    inputLabel: 'Từ khóa tìm kiếm',
    submit: 'Tìm',
    searching: 'Đang tìm…',
    forbidden: 'Bạn không có quyền vào trang quản trị.',
    noResults: 'Không tìm thấy món nào khớp từ khóa này.',
    lastChecked: (when: string) => `Kiểm tra lần cuối: ${when}`,
    truncatedCached: 'Lần lấy dữ liệu gần nhất chưa lấy hết — còn hàng chưa về.',
    allSourcesFailed: 'Tất cả nguồn đều lỗi — xem chi tiết bên dưới.',
    someSourcesFailed: 'Một số nguồn lỗi — danh sách dưới đây chưa đầy đủ.',
    pollTimeout: 'Tìm kiếm quá lâu không phản hồi. Thử lại, hoặc kiểm tra worker còn chạy không.',
    progressFailed: 'Không đọc được tiến độ tìm kiếm.',
    requestFailed: 'Tìm kiếm thất bại.',
    itemCount: (n: number) => `${n} món`,
    stillMore: 'còn nữa, chưa lấy hết',
  },

  sourceStatus: {
    pending: 'đang chờ',
    running: 'đang lấy dữ liệu',
    ok: 'xong',
    zero_results: 'không có kết quả (nghi adapter hỏng)',
    error: 'lỗi',
    blocked: 'bị chặn',
    disabled: 'đã tắt',
  },

  card: {
    lot: (n: string) => `Lô ${n}`,
    viewOn: (source: string) => `Xem trên ${source}`,
    estimate: (value: string) => `Ước tính: ${value}`,
    unknownCurrency: '(không rõ tiền tệ)',
    unknownCurrencyHint: 'Nguồn không kèm thông tin tiền tệ cho món này',
    convertedHint: 'Quy đổi tham khảo theo tỷ giá cập nhật hằng ngày',
    liveApproximate: '(phiên live, giờ đóng chỉ là ước lượng)',
    noPrice: '—',
    watchAdd: 'Lưu vào danh sách quan tâm',
    watchRemove: 'Bỏ khỏi danh sách quan tâm',
    closed: 'đã đóng',
    daysLeft: (n: number) => `còn ${n} ngày`,
    hoursLeft: (n: number) => `còn ${n} giờ`,
    minutesLeft: (n: number) => `còn ${n} phút`,
    endsAtHint: (when: string, tz: string) => `${when} (giờ ${tz})`,
  },

  priceKind: {
    current_bid: 'Giá hiện tại',
    starting_bid: 'Giá khởi điểm',
    buy_now: 'Mua ngay',
    sold: 'Đã bán',
    estimate: 'Ước tính',
    unknown: 'Chưa có giá',
  },

  listingStatus: {
    ended: 'Đã kết thúc',
    sold: 'Đã bán',
    withdrawn: 'Đã gỡ',
    stale: 'Có thể đã gỡ',
  },

  watchlist: {
    title: 'Hàng quan tâm',
    empty: 'Chưa lưu món nào. Vào',
    emptyLinkText: 'Tìm hàng',
    emptyAfter: 'và bấm ☆ trên món bạn quan tâm.',
    endedOn: (date: string) => `Đã kết thúc ${date}`,
  },

  admin: {
    sourcesTitle: 'Quản trị nguồn',
    workerStale: (hours: number) =>
      `Không có lần crawl nào trong ${hours} giờ qua — worker có thể đã dừng.`,
    colSource: 'Nguồn',
    colStatus: 'Trạng thái',
    colInterval: 'Giãn cách',
    enabled: 'đang bật',
    disabled: 'đã tắt',
    turnOff: 'Tắt nguồn',
    turnOn: 'Bật lại',
    recentRuns: 'Lần chạy gần đây',
    noRuns: 'Chưa có lần chạy nào.',
    colStarted: 'Bắt đầu',
    colKeyword: 'Từ khóa',
    colResult: 'Kết quả',
    colItems: 'Số món',
    colPages: 'Trang',
    colError: 'Lỗi',

    settingsTitle: 'Cài đặt',
    saved: 'Đã lưu.',
    rejected: (keys: string) => `Giá trị không hợp lệ, bỏ qua: ${keys}`,
    save: 'Lưu',
    timezoneLabel: 'Múi giờ hiển thị',
    timezoneHint: 'Dùng cho đếm ngược và email digest. Ví dụ: Asia/Ho_Chi_Minh',
    pagesLabel: 'Số trang lấy mỗi nguồn cho một từ khóa',
    pagesHint: 'HiBid trả 100 món mỗi trang, Invaluable 40, LiveAuctioneers 24.',
    cacheLabel: 'Thời hạn cache kết quả (giờ)',
    cacheHint: 'Trong thời hạn này, tìm lại cùng từ khóa sẽ trả ngay từ kho, không crawl.',
  },

  runStatus: {
    ok: 'ổn',
    error: 'lỗi',
    blocked: 'bị chặn (bản ghi cũ)',
    zero_results: '0 kết quả (nghi hỏng)',
  },

  errors: {
    adminOnly: '403 — chỉ admin truy cập được trang này',
  },
}
