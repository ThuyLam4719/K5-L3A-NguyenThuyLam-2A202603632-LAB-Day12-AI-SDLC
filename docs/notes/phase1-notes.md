# Phase 1 — Giả định & Ghi chép

## Giả định

Những chỗ PRD-0 mơ hồ, tôi đã tự giả định:

1. **Kích thước đảo:** Bán kính 40m, hình tròn. Đủ lớn để chạy nhưng không quá rộng.
2. **Tốc độ nhân vật:** 6 m/s. Vừa đủ nhanh để di chuyển nhưng Bóng Mực (3.5 m/s) vẫn có thể đuổi kịp nếu không cẩn thận.
3. **Carry capacity:** Mang tối đa 10 đom đóm. Buộc người chơi phải quyết định khi nào nên nạp đèn.
4. **Lantern cost:** Mỗi đèn cần 5 đom đóm. Tổng cần 25 đom đóm cho 5 đèn.
5. **Số đom đóm ban đầu:** 30 con. Đủ để thắp 5 đèn + dùng pulse.
6. **Mote respawn:** Mỗi 15 giây nếu còn ít hơn 10 con active.
7. **Shade spawn:** Bắt đầu 3 con, thêm 1 con mỗi 30 giây, tối đa 8 con.
8. **Thời gian đêm:** 300 giây (5 phút).
9. **Hit drop ratio:** 50% đom đóm đang mang bị rơi khi bị Bóng Mực chạm.
10. **Fall off island:** Có phạt — mất 1 flame, teleport về (0,0,0).
11. **Pulse:** Tốn 2 đom đóm, bán kính 8m, choáng 3s, đẩy 5m, hồi chiêu 5s.
12. **Safe radius:** 6m quanh đèn đã sáng, Bóng Mực bỏ chạy.
13. **Invulnerability:** 1.5 giây sau khi bị đánh.

## Tiêu chí nghiệm thu Phase 1

| # | Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---------|------------------|---------|
| 1 | Nhân vật di chuyển, nhảy, camera 3D | Chạy game, dùng WASD + Space + Mouse | ✅ |
| 2 | Đom đóm xuất hiện rải rác, nhặt được | Chạy game, đi lại nhặt đom đóm | ✅ |
| 3 | Nạp ánh sáng vào đèn để thắp | Nhặt đủ đom đóm, đứng gần đèn, nhấn E | ✅ |
| 4 | Bóng Mực đuổi người chơi | Quan sát Bóng Mực chạy về phía nhân vật | ✅ |
| 5 | Bị Bóng Mực chạm mất máu | Để Bóng Mực chạm, kiểm tra flames giảm | ✅ |
| 6 | Tỏa sáng xua Bóng Mực | Nhấn F khi có đủ đom đóm, Bóng Mực bị choáng | ✅ |
| 7 | Thắng khi thắp hết 5 đèn | Thắp hết đèn, hiện màn hình chiến thắng | ✅ |
| 8 | Thua khi hết máu | Để Bóng Mực đánh hết flames | ✅ |
| 9 | Có điểm số, HUD | HUD hiển thị flames, carried, time, score | ✅ |
| 10 | Chơi lại được | Nhấn "Chơi Lại" sau thắng/thua | ✅ |
| 11 | Headless chạy đúng | `node src/headless.js` với tham số đúng | ✅ |
| 12 | Tính tất định | Chạy 2 lần cùng seed, so output | ✅ |
| 13 | game.contract.json đúng format | Kiểm tra file JSON | ✅ |

## Nhật ký dùng AI

### Phase 1
- **Thời gian:** ~45 phút
- **Công cụ:** Google Antigravity (Claude model)
- **Token ước tính:** ~50K tokens
- **Quy trình:**
  1. Đọc tất cả tài liệu (README, GUIDE, CHECKPOINTS, RUBRIC, SUBMISSION, RULES)
  2. Lên kiến trúc: tách game-engine.js (logic thuần) khỏi main.js (Three.js render)
  3. Viết game-engine.js với tất cả logic game
  4. Viết headless.js theo Test Contract
  5. Viết main.js (Three.js renderer)
  6. Viết tests/run-tests.js
  7. Chạy test và sửa lỗi
- **Tiết kiệm token:**
  - Viết nhiều file song song thay vì tuần tự
  - Đọc tất cả tài liệu cùng lúc
  - Dùng kiến trúc rõ ràng để giảm debug
