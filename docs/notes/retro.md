# Retro — AI SDLC, Phase 1–4

## Điều hiệu quả

Chia riêng engine thuần, renderer và headless runner giúp giữ logic có thể chạy tất định và kiểm tra mà không cần GPU. `AGENTS.md` giữ các quy ước tick cố định, fuel số nguyên và yêu cầu đầu ra headless; bộ regression chạy được sau khi đổi contract sang v1.3. Scenario JSONL giúp tái hiện các ca fuel, bình minh và tương tác. Ở Phase 4, đo rồi mới tối ưu đã phát hiện đúng chi phí lớn: bóng đổ, đèn điểm gắn từng đom đóm và nhiều draw call riêng cho thực thể. Chuyển sang instancing trong cảnh bench và bỏ bóng đổ/đèn đom đóm đã làm số FPS cục bộ tăng rõ rệt.

## Điều chưa hiệu quả và lỗi AI đã phát hiện

Ở Phase 2–3, AI thêm nhạc nền và một trình phát YouTube vì yêu cầu trước đó, nhưng phần này không phù hợp yêu cầu Phase 4. Đã gỡ nhạc nền và trình phát; giữ lại âm báo giao diện ngắn. Một lượt đo benchmark ban đầu tính sai `load_ms` và phép đo FPS chạy song song với vòng render, cho ra số liệu không thể dùng. So sánh với định nghĩa Test Contract và lặp lại phép đo đã phát hiện vấn đề; runner hiện đo trong vòng render sau giai đoạn khởi động. Lượt đo ban đầu không được dùng làm bằng chứng. Asset GLB Nezuko vẫn không được đưa vào vì chưa có file và chưa xác minh được quyền sử dụng; trò chơi dùng hình khối tự dựng.

## Harness và quy trình

Hữu ích nhất là `AGENTS.md` cùng `game.contract.json` và `tests/run-tests.js`: chúng làm rõ engine không phụ thuộc renderer, ngăn tuning lệch khỏi engine và bắt được assert version cũ khi contract chuyển lên 1.3. Các fixture headless cũng giúp phát hiện thay đổi ngoài ý muốn. Không dùng skill, hook hay plugin riêng cho repo này.

## Token / chi phí AI

Phase 1 notes ghi khoảng **50K token**. Phase 2 notes nói rõ token không được ghi; Phase 3–4 cũng không có usage counter hoặc cost log trong workspace. Vì vậy tổng đủ bốn phase và chi phí thực trả **chưa được xác minh**. Chủ repo cần tra usage của Google Antigravity/OpenAI Codex và cập nhật con số trước khi nộp; không tự cộng một ước lượng bịa từ độ dài mã nguồn. Cách tiết kiệm thể hiện trong lịch sử làm việc là tái dùng harness, fixtures và lệnh kiểm chứng thay vì yêu cầu AI đọc/ghi lại engine từ đầu.

## Nếu làm lại

Ghi lại kết quả đo và đánh giá sau từng phase, tạo tag ngay khi phase hoàn thành, chốt nguồn/giấy phép asset trước khi thêm, và giữ yêu cầu âm thanh/nhạc tách biệt khỏi hiệu ứng chơi. Với Phase 4, nên xác nhận runner trên đúng máy đo chuẩn sớm hơn; số đo SwiftShader chỉ có ý nghĩa tham khảo. Số FPS cục bộ và kết quả soak được lưu ở `bench.json`, `soak.json`; chi tiết lệnh và giới hạn môi trường nằm trong `docs/proof/phase4.md`.
