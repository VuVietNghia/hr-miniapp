export interface DraftingTemplate {
  id: string;
  title: string;
  category: 'onboarding' | 'personnel' | 'admin' | 'legal';
  categoryLabel: string;
  track: 'nd30_administrative' | 'modern_enterprise';
  icon: string;
  description: string;
  defaultData: Record<string, string>;
  templateText: string;
}

export const DRAFTING_TEMPLATES: DraftingTemplate[] = [
  {
    id: 'implementation-plan',
    title: 'Kế hoạch triển khai (Implementation Plan / Roadmap)',
    category: 'admin',
    categoryLabel: 'Hành chính & Chiến lược',
    track: 'nd30_administrative',
    icon: '📋',
    description: 'Kế hoạch triển khai dự án/chuyển đổi số chuẩn thể thức NĐ 30/2020/NĐ-CP (Khớp 100% định dạng Word chuẩn).',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      planCode: '03',
      subject: 'V/v triển khai Ứng dụng di động (App) phục vụ chăm sóc khách hàng năm 2026',
      draftingDept: 'Phòng Công nghệ thông tin',
      recipients: '- Ban Giám đốc Công ty;\n- Các Phòng: Công nghệ thông tin, Kinh doanh, Marketing, Chăm sóc khách hàng;\n- Trung tâm Vận hành.',
      signerName: 'Trần Văn Giám Đốc',
      signerRole: 'GIÁM ĐỐC',
      totalBudget: '5.000.000.000 đồng (năm tỷ đồng)',
      duration: '05 tháng'
    },
    templateText: `| **{{companyName}}**<br>Số: {{planCode}}/{{year}}/KH-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# KẾ HOẠCH
### {{subject}}

**Đơn vị soạn thảo:** {{draftingDept}}

**Kính gửi:**
{{recipients}}

- Căn cứ Luật Doanh nghiệp số 59/2020/QH14 được Quốc hội nước Cộng hoà xã hội chủ nghĩa Việt Nam thông qua ngày 17 tháng 6 năm 2020;
- Căn cứ Điều lệ tổ chức và hoạt động của {{companyName}};
- Căn cứ Nghị quyết Hội đồng quản trị Công ty về chiến lược chuyển đổi số giai đoạn 2025 - 2027;
- Xét đề nghị của Trưởng phòng Công nghệ thông tin và Trưởng phòng Kinh doanh,

Nhằm đẩy nhanh tiến độ chiến lược chuyển đổi số của Công ty, nâng cao trải nghiệm khách hàng và mở rộng thị phần dịch vụ trong năm 2026, Ban Giám đốc ban hành Kế hoạch triển khai chi tiết như sau:

**1. Mục tiêu - Yêu cầu:** Triển khai thành công phiên bản App thương mại (MVP) trên hai nền tảng iOS và Android trong Quý IV/2026.

a) Mục tiêu chi tiết:
- Giao diện ứng dụng thân thiện, dễ sử dụng, thống nhất với nhận diện thương hiệu của Công ty trên các nền tảng số.
- Tích hợp đầy đủ các tính năng cốt lõi: đăng ký/đăng nhập tài khoản, tra cứu thông tin sản phẩm - dịch vụ, tích điểm đổi quà và thanh toán trực tuyến bảo mật.
- Đạt chứng nhận bảo mật dữ liệu theo quy định của Luật An ninh mạng 2018 và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.

b) Yêu cầu kỹ thuật:
- Kiến trúc microservices, hỗ trợ mở rộng linh hoạt; thời gian phản hồi (response time) dưới 02 giây cho 95% số lượng tác vụ người dùng.
- Tỷ lệ hoạt động ổn định (uptime) đạt tối thiểu 99.5% trong điều kiện tải bình thường và giờ cao điểm.

**2. Đối tượng và phạm vi áp dụng:** Kế hoạch áp dụng đối với toàn bộ cán bộ, nhân viên các Phòng: Công nghệ thông tin, Kinh doanh, Marketing, Chăm sóc khách hàng và các đơn vị liên quan.

**3. Nội dung công việc:** Bao gồm các giai đoạn triển khai chính:
a) Giai đoạn chuẩn bị (Tháng 07 - 08/{{year}}): Hoàn thiện tài liệu yêu cầu nghiệp vụ (PRD), thiết kế UI/UX và phê duyệt kiến trúc kỹ thuật tổng thể.
b) Giai đoạn phát triển (Tháng 08 - 10/{{year}}): Lập trình các module backend và frontend; tích hợp cổng thanh toán và hệ thống CRM.
c) Giai đoạn thử nghiệm (Tháng 10/{{year}}): Tổ chức Closed Beta với 500 người dùng nội bộ và khách hàng thân thiết để ghi nhận phản hồi, khắc phục lỗi.
d) Giai đoạn phát hành chính thức (Tháng 11/{{year}}): Đăng tải App lên App Store và Google Play; triển khai chiến dịch truyền thông diện rộng.
e) Giai đoạn vận hành - bảo trì (Từ tháng 12/{{year}} trở đi): Giám sát hệ thống, phát hành các bản cập nhật định kỳ và tối ưu hóa hiệu năng.

**4. Tiến độ thực hiện:** Tổng thời gian triển khai là {{duration}} kể từ ngày Kế hoạch có hiệu lực.

**5. Tổ chức bộ máy điều hành:** Thành lập Ban Chỉ đạo dự án do Giám đốc điều hành làm Trưởng ban; Phó ban Thường trực là Trưởng phòng Công nghệ thông tin.

**6. Nguồn lực bảo đảm:** Tổng mức đầu tư dự kiến là {{totalBudget}}, bảo đảm từ nguồn vốn đầu tư phát triển công nghệ năm {{year}} của Công ty.

**7. Phân công trách nhiệm:** Cụ thể như sau:
- Phòng Công nghệ thông tin: Chủ trì thiết kế kiến trúc, lập trình, kiểm thử và vận hành kỹ thuật.
- Phòng Kinh doanh: Cung cấp yêu cầu nghiệp vụ, danh mục sản phẩm - dịch vụ và chính sách giá trên App.
- Phòng Marketing: Lên kế hoạch truyền thông, nội dung sáng tạo và quảng bá App trên các kênh số.
- Phòng Chăm sóc khách hàng: Chuẩn bị kịch bản hỗ trợ, đào tạo tổng đài viên và xử lý phản hồi người dùng.
- Trung tâm Vận hành: Đảm bảo quy trình giao dịch, hoàn tất đơn hàng và xử lý khiếu nại liên quan.

**8. Tiêu chí đánh giá hiệu quả:**
- Số lượt tải và cài đặt đạt tối thiểu 100.000 trong 03 tháng đầu phát hành.
- Điểm đánh giá trung bình trên App Store và Google Play đạt từ 4.2/5 sao trở lên.
- Tỷ lệ chuyển đổi giao dịch qua App chiếm ít nhất 25% tổng giao dịch toàn hệ thống.

Kế hoạch này là cơ sở để các Phòng, Ban và cá nhân có liên quan triển khai thực hiện. Trong quá trình thực hiện, nếu có khó khăn, vướng mắc, các đơn vị kịp thời báo cáo Ban Chỉ đạo dự án để xem xét, chỉ đạo giải quyết./.

./.

| **Nơi nhận:**<br>*- Như trên (để chỉ đạo, triển khai);*<br>*- Ban Giám đốc (để báo cáo);*<br>*- Lưu: VT, CNTT.* | *Hà Nội, ngày {{currentDate}}*<br><br>**{{signerRole}}**<br><br><br>*(Đã ký)*<br><br>**{{signerName}}** |
| :--- | :---: |
`
  },
  {
    id: 'salary-increase-decision',
    title: 'Quyết định bổ nhiệm / Tăng lương',
    category: 'personnel',
    categoryLabel: 'Quyết định & Nhân sự',
    track: 'nd30_administrative',
    icon: '🎖️',
    description: 'Quyết định hành chính chuẩn thể thức NĐ 30/2020/NĐ-CP về bổ nhiệm và điều chỉnh lương.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      signerName: 'Trần Văn Giám Đốc',
      signerRole: 'TỔNG GIÁM ĐỐC',
      employeeName: 'Nguyễn Văn A',
      currentPosition: 'Chuyên viên Kỹ thuật',
      newPosition: 'Trưởng nhóm Phát triển Sản phẩm (Tech Lead)',
      department: 'Phòng Kỹ thuật & Công nghệ',
      oldSalary: '25.000.000 VNĐ / tháng',
      newSalary: '35.000.000 VNĐ / tháng',
      effectiveDate: '01/09/2026',
      reason: 'Hoàn thành xuất sắc các chỉ tiêu KPI và dẫn dắt thành công dự án trọng điểm.'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docNumber}}/{{year}}/QĐ-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# QUYẾT ĐỊNH
### Về việc bổ nhiệm chức danh và điều chỉnh mức lương nhân sự

**{{signerRole}} {{companyName}}**

- Căn cứ Điều lệ tổ chức và hoạt động của {{companyName}};
- Căn cứ Quy chế Tiền lương & Đãi ngộ hiện hành của Công ty;
- Xét kết quả đánh giá năng lực công tác và đề xuất của Trưởng phòng Nhân sự,

### QUYẾT ĐỊNH:

**Điều 1.** Bổ nhiệm chức vụ và điều chỉnh mức lương cho cán bộ nhân sự:
- **Họ và tên:** **Ông/Bà {{employeeName}}**
- **Vị trí hiện tại:** {{currentPosition}}
- **Vị trí bổ nhiệm mới:** **{{newPosition}}**
- **Phòng ban:** {{department}}

**Điều 2.** Điều chỉnh mức thu nhập hàng tháng:
- **Mức lương cũ:** {{oldSalary}}
- **Mức lương mới:** **{{newSalary}}** (Chưa bao gồm các khoản phụ cấp trách nhiệm theo quy chế).
- **Lý do:** {{reason}}

**Điều 3.** Quyết định này có hiệu lực thi hành kể từ ngày **{{effectiveDate}}**.

**Điều 4.** Phòng Hành chính - Nhân sự, Phòng Kế toán - Tài chính, các bộ phận liên quan và Ông/Bà **{{employeeName}}** chịu trách nhiệm thi hành Quyết định này./.

./.

| **Nơi nhận:**<br>*- Như Điều 4;*<br>*- Lưu: VT, HSNV.* | *Hà Nội, ngày {{currentDate}}*<br><br>**{{signerRole}}**<br><br><br>*(Đã ký & Đóng dấu)*<br><br>**{{signerName}}** |
| :--- | :---: |
`
  },
  {
    id: 'offer-letter',
    title: 'Thư mời nhận việc (Offer Letter)',
    category: 'onboarding',
    categoryLabel: 'Tuyển dụng & Onboarding',
    track: 'modern_enterprise',
    icon: '✉️',
    description: 'Thư mời nhận việc trang trọng gửi ứng viên trúng tuyển, chuẩn chính sách đãi ngộ B.Army.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      candidateName: 'Nguyễn Văn A',
      position: 'Senior Frontend Engineer',
      department: 'Phòng Kỹ thuật & Công nghệ',
      startDate: '15/08/2026',
      probationSalary: '25.500.000 VNĐ / tháng',
      officialSalary: '30.000.000 VNĐ / tháng',
      probationDuration: '02 tháng (hưởng 85% lương chính thức)',
      workLocation: 'Tầng 8, Tòa nhà B.Army Tower, Cầu Giấy, Hà Nội',
      reportingTo: 'Trưởng phòng Kỹ thuật',
      replyDeadline: '10/08/2026'
    },
    templateText: `# THƯ MỜI NHẬN VIỆC (JOB OFFER LETTER)
### V/v Tuyển dụng nhân sự vị trí {{position}}

**Số:** {{docNumber}}/{{year}}/OL-BARMY
**Hà Nội, ngày {{currentDate}}**

---

### Kính gửi: **Ông/Bà {{candidateName}}**

Ban Giám đốc và Phòng Nhân sự **{{companyName}}** trân trọng chúc mừng và gửi lời mời Ông/Bà gia nhập đội ngũ nhân sự của công ty với các thông tin chi tiết như sau:

**1. Thông tin vị trí công tác:**
- **Vị trí tuyển dụng:** {{position}}
- **Phòng ban / Bộ phận:** {{department}}
- **Cán bộ quản lý trực tiếp:** {{reportingTo}}
- **Địa điểm làm việc:** {{workLocation}}
- **Thời gian làm việc:** Từ Thứ 2 đến Thứ 6 (08:30 - 17:30)
- **Ngày bắt đầu nhận việc (Onboarding Date):** **{{startDate}}**

**2. Chế độ tiền lương & Đãi ngộ:**
- **Thời gian thử việc:** {{probationDuration}}
- **Mức lương thử việc:** **{{probationSalary}}**
- **Mức lương chính thức (Gross):** **{{officialSalary}}**
- **Đánh giá & Thưởng:** Thưởng KPI định kỳ theo quý, lương tháng 13 và thưởng Lễ Tết.
- **Bảo hiểm & Phúc lợi:** Tham gia đầy đủ BHXH, BHYT, BHTN theo quy định; Gói bảo hiểm sức khỏe B.Army Care.

**3. Xác nhận nhận việc:**
Vui lòng phản hồi xác nhận đồng ý nhận việc bằng cách gửi email hoặc ký xác nhận văn bản này trước **17:00 ngày {{replyDeadline}}**.

Chúng tôi rất hân hạnh được chào đón Ông/Bà đồng hành cùng sự phát triển của **{{companyName}}**./.

./.

| **ĐẠI DIỆN CÔNG TY**<br>*(Ký & Đóng dấu)*<br><br><br>**TRƯỞNG PHÒNG NHÂN SỰ** | **XÁC NHẬN CỦA ỨNG VIÊN**<br>*(Ký & Ghi rõ họ tên)*<br><br><br>**{{candidateName}}** |
| :---: | :---: |
`
  },
  {
    id: 'probation-contract',
    title: 'Hợp đồng thử việc (Probation Contract)',
    category: 'onboarding',
    categoryLabel: 'Tuyển dụng & Onboarding',
    track: 'nd30_administrative',
    icon: '📝',
    description: 'Hợp đồng thử việc chuẩn theo Bộ luật Lao động 2019 và thể thức văn bản hiện đại.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      companyRep: 'Trần Văn Giám Đốc',
      companyRole: 'Tổng Giám đốc',
      companyAddress: 'Tầng 8, Tòa nhà B.Army Tower, Cầu Giấy, Hà Nội',
      candidateName: 'Nguyễn Văn A',
      dob: '01/01/1995',
      idCard: '001095012345',
      idCardDate: '10/05/2021',
      idCardPlace: 'Cục Cảnh sát QLHC về TTXH',
      candidateAddress: 'Số 123 Đường Cầu Giấy, Hà Nội',
      position: 'Chuyên viên Kỹ thuật phần mềm',
      department: 'Phòng Kỹ thuật & Công nghệ',
      startDate: '15/08/2026',
      endDate: '15/10/2026',
      baseSalary: '25.500.000 VNĐ / tháng (85% mức lương chính thức)'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docNumber}}/{{year}}/HĐTV-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# HỢP ĐỒNG THỬ VIỆC
### V/v Thử việc vị trí {{position}}

*Hôm nay, ngày {{currentDate}}, tại trụ sở Công ty, chúng tôi gồm có:*

**BÊN A: NGƯỜI SỬ DỤNG LAO ĐỘNG**
- **Tên doanh nghiệp:** **{{companyName}}**
- **Đại diện:** {{companyRep}} - **Chức vụ:** {{companyRole}}
- **Địa chỉ:** {{companyAddress}}

**BÊN B: NGƯỜI LAO ĐỘNG**
- **Họ và tên:** **{{candidateName}}**
- **Ngày sinh:** {{dob}} - **Số CCCD:** {{idCard}} (Cấp ngày: {{idCardDate}} tại {{idCardPlace}})
- **Địa chỉ thường trú:** {{candidateAddress}}

Hai bên thống nhất ký kết Hợp đồng thử việc với các điều khoản sau:

**Điều 1. Công việc và thời hạn hợp đồng:**
- Vị trí công tác: {{position}} - Bộ phận: {{department}}
- Thời hạn thử việc: 02 tháng, bắt đầu từ ngày **{{startDate}}** đến hết ngày **{{endDate}}**.
- Nhiệm vụ: Thực hiện các công việc chuyên môn theo Bản mô tả công việc (JD) và chỉ đạo của Cán bộ quản lý trực tiếp.

**Điều 2. Chế độ làm việc & Tiền lương:**
- Thời gian làm việc: 40 giờ/tuần (Thứ 2 đến Thứ 6: 08:30 - 17:30).
- Tiền lương trong thời gian thử việc: **{{baseSalary}}**.
- Hình thức trả lương: Chuyển khoản ngân hàng vào ngày 05 hàng tháng.

**Điều 3. Nghĩa vụ và quyền lợi:**
- Bên A: Có trách nhiệm hướng dẫn, tạo điều kiện thuận lợi và đánh giá trung thực kết quả thử việc của Bên B.
- Bên B: Tuân thủ nội quy lao động, quy chế bảo mật thông tin và hoàn thành nhiệm vụ được giao.

**Điều 4. Hiệu lực hợp đồng:**
Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện./.

./.

| **ĐẠI DIỆN BÊN A**<br>*(Ký tên, đóng dấu)*<br><br><br>**{{companyRep}}** | **ĐẠI DIỆN BÊN B**<br>*(Ký & ghi rõ họ tên)*<br><br><br>**{{candidateName}}** |
| :---: | :---: |
`
  },
  {
    id: 'internal-announcement',
    title: 'Thông báo nội bộ (Nghỉ Lễ / Quy chế)',
    category: 'admin',
    categoryLabel: 'Hành chính & Truyền thông',
    track: 'nd30_administrative',
    icon: '📢',
    description: 'Thông báo toàn thể CBNV chuẩn thể thức văn bản hành chính công vụ.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      announcementTitle: 'Lịch nghỉ Lễ Quốc khánh 02/09 và hoạt động Teambuilding năm 2026',
      recipientGroup: 'Toàn thể Cán bộ Nhân viên Công ty B.Army',
      startDate: '01/09/2026',
      endDate: '03/09/2026',
      resumeDate: '04/09/2026',
      notes: '- Cán bộ nhân viên chủ động hoàn thành công việc tồn đọng trước kỳ nghỉ.\n- Bộ phận Kỹ thuật và Vận hành duy trì trực On-call 24/7 theo lịch phân công.\n- Chú ý ngắt các thiết bị điện và niêm phong văn phòng trước khi nghỉ.'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docNumber}}/{{year}}/TB-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# THÔNG BÁO
### Về việc {{announcementTitle}}

**Kính gửi:** **{{recipientGroup}}**

Ban Giám đốc **{{companyName}}** trân trọng thông báo đến toàn thể Cán bộ Nhân viên lịch nghỉ và kế hoạch làm việc như sau:

**1. Thời gian nghỉ và làm việc lại:**
- Thời gian bắt đầu nghỉ: Từ ngày **{{startDate}}**
- Thời gian kết thúc nghỉ: Hết ngày **{{endDate}}**
- Tổng số ngày nghỉ: 03 ngày liên tục.
- Thời gian quay trở lại làm việc: **08:30 Thứ Sáu, ngày {{resumeDate}}**.

**2. Các quy định lưu ý:**
{{notes}}

Ban Giám đốc chúc toàn thể Cán bộ Nhân viên cùng gia đình một kỳ nghỉ lễ nhiều niềm vui và an toàn./.

./.

| **Nơi nhận:**<br>*- Toàn thể CBNV;*<br>*- Lưu: Hành chính.* | *Hà Nội, ngày {{currentDate}}*<br><br>**TRƯỞNG PHÒNG HÀNH CHÍNH - NHÂN SỰ**<br><br><br>*(Đã duyệt & thông báo)* |
| :--- | :---: |
`
  },
  {
    id: 'official-dispatch',
    title: 'Công văn hành chính (Official Dispatch)',
    category: 'admin',
    categoryLabel: 'Hành chính & Trao đổi',
    track: 'nd30_administrative',
    icon: '📨',
    description: 'Công văn trao đổi công việc, đề nghị phối hợp hoặc phúc đáp đối tác chuẩn thể thức Nghị định 30.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      docCode: '88',
      subject: 'V/v phối hợp triển khai hạ tầng kết nối và bảo mật hệ thống năm 2026',
      recipientOrg: 'TẬP ĐOÀN VIỄN THÔNG VÀ CÔNG NGHỆ THÔNG TIN',
      signerName: 'Trần Văn Giám Đốc',
      signerRole: 'TỔNG GIÁM ĐỐC',
      draftingDept: 'Phòng Kỹ thuật & Hạ tầng',
      recipients: '- Như trên;\n- Ban Giám đốc (để b/c);\n- Lưu: VT, KT.'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docCode}}/{{year}}/BARMY-CV<br>V/v {{subject}} | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

Kính gửi: **{{recipientOrg}}**

- Căn cứ Biên bản ghi nhớ hợp tác chiến lược giữa {{companyName}} và {{recipientOrg}} ký ngày 15 tháng 01 năm 2026;
- Căn cứ Kế hoạch nâng cấp và bảo đảm an toàn thông tin mạng năm 2026 của Công ty,

Nhằm bảo đảm tiến độ triển khai đồng bộ hạ tầng truyền dẫn số và nâng cao độ an toàn cho các ứng dụng nghiệp vụ trọng điểm, {{companyName}} trân trọng gửi lời chào và trân trọng đề nghị Quý đơn vị phối hợp triển khai các nội dung sau:

**1. Nội dung phối hợp kỹ thuật:**
- Cung cấp kênh truyền dẫn cáp quang dự phòng tốc độ 10Gbps kết nối trực tiếp giữa hai Trung tâm dữ liệu (DC chính và DC dự phòng).
- Phối hợp thiết lập hệ thống tường lửa thế hệ mới (Next-Gen Firewall) và kiểm thử khả năng phòng chống tấn công từ chối dịch vụ (DDoS).
- Cử cán bộ kỹ thuật thường trực tham gia Ban Chỉ đạo kỹ thuật chung trước ngày 20/08/{{year}}.

**2. Tiến độ và đầu mối liên hệ:**
- Thời gian hoàn tất kiểm thử kết nối: Trước ngày 30/09/{{year}}.
- Đầu mối phụ trách kỹ thuật của {{companyName}}: {{draftingDept}} (Điện thoại: 024.3888.9999 - Email: tech@barmy.vn).

{{companyName}} rất mong nhận được sự quan tâm, phối hợp chặt chẽ của Quý đơn vị để công tác triển khai đạt hiệu quả cao nhất./.

./.

| **Nơi nhận:**<br>*- {{recipients}}* | *Hà Nội, ngày {{currentDate}}*<br><br>**{{signerRole}}**<br><br><br>*(Đã ký & Đóng dấu)*<br><br>**{{signerName}}** |
| :--- | :---: |
`
  },
  {
    id: 'submission-proposal',
    title: 'Tờ trình phê duyệt (Submission / Proposal)',
    category: 'admin',
    categoryLabel: 'Hành chính & Tờ trình',
    track: 'nd30_administrative',
    icon: '📑',
    description: 'Tờ trình trình cấp có thẩm quyền phê duyệt chủ trương, kinh phí hoặc phương án công tác chuẩn NĐ 30.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      docCode: '12',
      subject: 'V/v phê duyệt chủ trương đầu tư nâng cấp hạ tầng máy chủ AI năm 2026',
      approver: 'Hội đồng Quản trị và Tổng Giám đốc Công ty',
      proposerRole: 'TRƯỞNG PHÒNG CÔNG NGHỆ THÔNG TIN',
      proposerName: 'Lê Văn Kỹ Thuật',
      budget: '2.500.000.000 VNĐ (Hai tỷ năm trăm triệu đồng)',
      recipients: '- Như kính gửi;\n- Phòng Kế toán - Tài chính;\n- Lưu: VT, CNTT.'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docCode}}/{{year}}/TTr-CNTT | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# TỜ TRÌNH
### {{subject}}

Kính gửi: **{{approver}}**

- Căn cứ Chiến lược phát triển sản phẩm công nghệ và ứng dụng trí tuệ nhân tạo (AI) giai đoạn 2025 - 2027 của Công ty;
- Căn cứ tình hình thực tế về nhu cầu tài nguyên tính toán phục vụ các mô hình phân tích dữ liệu tuyển dụng và tự động hóa quy trình,

Phòng Công nghệ thông tin kính trình Ban Giám đốc xem xét, phê duyệt chủ trương đầu tư với các nội dung chi tiết sau:

**1. Sự cần thiết đầu tư:**
Hệ thống máy chủ hiện tại đã khai thác 90% công suất tải. Để đáp ứng lưu lượng xử lý tài liệu đồng thời của hơn 10.000 người dùng doanh nghiệp, việc nâng cấp cụm GPU chuyên dụng là yêu cầu cấp thiết nhằm tránh gián đoạn dịch vụ.

**2. Phương án và quy mô thực hiện:**
- Mua sắm bổ sung 04 cụm máy chủ tính toán GPU hiệu năng cao đạt chuẩn Tier 3.
- Nâng cấp băng thông kết nối nội bộ lên 40Gbps và bổ sung hệ thống lưu trữ phân tán SSD NVMe 100TB.
- Thời gian triển khai dự kiến: 45 ngày kể từ ngày được phê duyệt ngân sách.

**3. Dự toán kinh phí và nguồn vốn:**
- Tổng kinh phí đầu tư dự kiến: **{{budget}}**.
- Nguồn vốn: Trích từ Quỹ Đầu tư và Phát triển Công nghệ năm {{year}} của Công ty.

**4. Kiến nghị:**
Kính trình Ban Giám đốc xem xét, phê duyệt chủ trương đầu tư và ủy quyền cho Phòng Công nghệ thông tin phối hợp với Phòng Kế toán thực hiện quy trình mua sắm theo đúng quy chế hiện hành.

Kính trình Ban Giám đốc xem xét, quyết định./.

./.

| **Nơi nhận:**<br>*- {{recipients}}* | *Hà Nội, ngày {{currentDate}}*<br><br>**{{proposerRole}}**<br><br><br>*(Đã ký)*<br><br>**{{proposerName}}** |
| :--- | :---: |
`
  },
  {
    id: 'work-report',
    title: 'Báo cáo công tác / Tổng kết (Work Report)',
    category: 'admin',
    categoryLabel: 'Hành chính & Báo cáo',
    track: 'nd30_administrative',
    icon: '📊',
    description: 'Báo cáo tổng kết tình hình thực hiện nhiệm vụ, kết quả và kiến nghị công tác chuẩn thể thức NĐ 30.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      docCode: '45',
      reportTitle: 'Báo cáo kết quả công tác Quý III và Phương hướng nhiệm vụ Quý IV năm 2026',
      reportingDept: 'Phòng Vận hành & Phát triển Kinh doanh',
      reporterRole: 'TRƯỞNG PHÒNG VẬN HÀNH',
      reporterName: 'Phạm Thu Trang',
      recipients: '- Ban Giám đốc (để b/c);\n- Các Phòng/Ban liên quan;\n- Lưu: VT, VH.'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docCode}}/{{year}}/BC-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# BÁO CÁO
### {{reportTitle}}

**Đơn vị thực hiện:** {{reportingDept}}

- Căn cứ Kế hoạch công tác năm {{year}} của {{companyName}};
- Căn cứ kết quả hoạt động thực tế của các đơn vị trong Quý III/{{year}},

{{reportingDept}} trân trọng báo cáo Ban Giám đốc kết quả thực hiện nhiệm vụ công tác và đề xuất phương hướng nhiệm vụ thời gian tới như sau:

**I. TÌNH HÌNH CHUNG VÀ BỐI CẢNH TRIỂN KHAI**
Trong Quý III/{{year}}, toàn thể cán bộ nhân viên đã nỗ lực hoàn thành tốt các chỉ tiêu kế hoạch được giao trong bối cảnh thị trường công nghệ có nhiều chuyển biến tích cực.

**II. KẾT QUẢ THỰC HIỆN NHIỆM VỤ**
1. Về công tác chuyên môn và vận hành:
- Đã hoàn thành 100% các mốc tiến độ phát triển phần mềm theo đúng kế hoạch ban hành.
- Tỷ lệ hài lòng của khách hàng doanh nghiệp đối với dịch vụ đạt 96.8% (vượt 4.8% so với mục tiêu).
- Duy trì thời gian hoạt động ổn định hệ thống (uptime) đạt 99.92%.

2. Về quản trị nhân sự và tài chính:
- Thực hiện nghiêm túc quy chế làm việc, đảm bảo an toàn an ninh văn phòng và dữ liệu khách hàng.
- Tối ưu hóa chi phí vận hành thường xuyên, tiết kiệm 12% so với định mức ngân sách được duyệt.

**III. ĐÁNH GIÁ CHUNG**
1. Ưu điểm nổi bật:
- Tinh thần trách nhiệm cao, phối hợp liên phòng ban nhịp nhàng, xử lý sự cố nhanh chóng.
- Ứng dụng hiệu quả các công cụ trí tuệ nhân tạo (AI) giúp tăng năng suất lao động lên 35%.

2. Tồn tại, hạn chế và nguyên nhân:
- Một số vị trí nhân sự tuyển dụng mới cần thêm thời gian đào tạo chuyên sâu về quy trình nội bộ.

**IV. PHƯƠNG HƯỚNG NHIỆM VỤ VÀ KIẾN NGHỊ QUÝ IV/{{year}}**
1. Phương hướng trọng tâm:
- Đẩy mạnh hoàn thiện phiên bản thương mại của các ứng dụng chuyển đổi số trước tháng 12/{{year}}.
- Tổ chức chương trình đào tạo nội bộ nâng cao kỹ năng cho đội ngũ kỹ sư và quản trị viên.

2. Kiến nghị, đề xuất:
- Kính đề nghị Ban Giám đốc xem xét phê duyệt bổ sung định biên 05 chuyên viên kỹ thuật chất lượng cao để đáp ứng quy mô mở rộng dự án.

./.

| **Nơi nhận:**<br>*- {{recipients}}* | *Hà Nội, ngày {{currentDate}}*<br><br>**{{reporterRole}}**<br><br><br>*(Đã ký)*<br><br>**{{reporterName}}** |
| :--- | :---: |
`
  },
  {
    id: 'meeting-minutes',
    title: 'Biên bản cuộc họp (Meeting Minutes)',
    category: 'admin',
    categoryLabel: 'Hành chính & Quản trị',
    track: 'nd30_administrative',
    icon: '📋',
    description: 'Biên bản cuộc họp, giao ban hoặc bàn giao công việc chuẩn thể thức NĐ 30 không có nơi nhận.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      docCode: '08',
      meetingSubject: 'Biên bản cuộc họp Ban Chỉ đạo Triển khai Dự án Chuyển đổi số Quý IV/2026',
      meetingTime: '09 giờ 00 phút, ngày 15 tháng 08 năm 2026',
      meetingLocation: 'Phòng họp Hội đồng tầng 8, Tòa nhà B.Army Tower',
      chairperson: 'Ông Trần Văn Giám Đốc - Tổng Giám đốc',
      secretary: 'Bà Nguyễn Thị Thư Ký - Chuyên viên Văn phòng',
      attendees: '- Ông Lê Văn Kỹ Thuật - Trưởng phòng CNTT;\n- Bà Phạm Thu Trang - Trưởng phòng Vận hành;\n- Ông Hoàng Văn Kinh Doanh - Trưởng phòng Kinh doanh.'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docCode}}/{{year}}/BB-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# BIÊN BẢN
### {{meetingSubject}}

*Hôm nay, vào hồi {{meetingTime}}, tại {{meetingLocation}}, Công ty đã tổ chức cuộc họp với các nội dung chi tiết như sau:*

**I. THÀNH PHẦN THAM DỰ:**
- **Chủ trì cuộc họp:** {{chairperson}}
- **Thư ký cuộc họp:** {{secretary}}
- **Thành phần tham dự:**
{{attendees}}

**II. NỘI DUNG CUỘC HỌP:**
1. Đồng chí Chủ trì tóm tắt mục đích cuộc họp: Rà soát toàn diện tiến độ phát triển các module ứng dụng, thống nhất giải pháp xử lý vướng mắc và phân công nhiệm vụ cụ thể cho từng bộ phận.
2. Đại diện Phòng Công nghệ thông tin báo cáo: Đã hoàn thiện 85% kiến trúc backend và các luồng API tích hợp. Đang tiến hành kiểm thử hiệu năng tải cao.
3. Đại diện Phòng Kinh doanh và Vận hành phát biểu: Thống nhất lộ trình chuẩn bị dữ liệu sản phẩm, xây dựng chính sách khách hàng thân thiết.

**III. KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP:**
Sau khi thảo luận và thống nhất giữa các bộ phận, Chủ trì cuộc họp kết luận chỉ đạo:
- Phòng CNTT tập trung tối đa nguồn lực hoàn thành bản thử nghiệm nội bộ trước ngày 30/08/{{year}}.
- Phòng Vận hành xây dựng tài liệu hướng dẫn sử dụng và kịch bản đào tạo nhân viên trước ngày 15/09/{{year}}.
- Các bộ phận báo cáo tiến độ định kỳ vào sáng Thứ Hai hàng tuần.

Cuộc họp kết thúc vào hồi 11 giờ 30 phút cùng ngày. Biên bản đã được đọc lại cho toàn thể thành viên tham dự cùng nghe, nhất trí thông qua và ký tên xác nhận dưới đây./.

./.

| **THƯ KÝ CUỘC HỌP**<br>*(Ký, ghi rõ họ tên)*<br><br><br><br>**{{secretary}}** | **CHỦ TRÌ CUỘC HỌP**<br>*(Ký, ghi rõ họ tên)*<br><br><br><br>**{{chairperson}}** |
| :---: | :---: |
`
  },
  {
    id: 'power-of-attorney',
    title: 'Giấy ủy quyền giải quyết công việc (Power of Attorney)',
    category: 'legal',
    categoryLabel: 'Pháp chế & Ủy quyền',
    track: 'nd30_administrative',
    icon: '📜',
    description: 'Giấy ủy quyền thực hiện công việc, ký kết và giải quyết thủ tục chuẩn Bộ luật Dân sự và NĐ 30.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      docCode: '05',
      authorizerName: 'Trần Văn Giám Đốc',
      authorizerRole: 'Tổng Giám đốc - Người đại diện theo pháp luật',
      authorizerId: '001080001234',
      authorizedPerson: 'Lê Văn Phó Giám Đốc',
      authorizedRole: 'Phó Tổng Giám đốc Kỹ thuật',
      authorizedId: '001085005678',
      authorizedIdDate: '15/04/2021',
      authorizedIdPlace: 'Cục Cảnh sát QLHC về TTXH',
      scope: 'Đại diện Công ty ký kết các hợp đồng cung cấp dịch vụ công nghệ, đàm phán phương án kỹ thuật và làm việc với các đối tác viễn thông trong phạm vi ngân sách dưới 1.000.000.000 VNĐ.',
      validFrom: '15/08/2026',
      validTo: '31/12/2026'
    },
    templateText: `| **{{companyName}}**<br>Số: {{docCode}}/{{year}}/GUQ-BARMY | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
| :---: | :---: |

# GIẤY ỦY QUYỀN
### V/v Ủy quyền thực hiện giao dịch và ký kết văn bản công tác

- Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội ban hành ngày 24 tháng 11 năm 2015;
- Căn cứ Điều lệ tổ chức và hoạt động của {{companyName}};
- Căn cứ yêu cầu thực tế trong công tác quản lý và điều hành hoạt động sản xuất kinh doanh của Công ty,

*Hôm nay, ngày {{currentDate}}, tại trụ sở Công ty, chúng tôi gồm có:*

**I. BÊN ỦY QUYỀN (BÊN A):**
- **Họ và tên:** **{{authorizerName}}**
- **Chức vụ:** {{authorizerRole}} của {{companyName}}
- **Số CCCD:** {{authorizerId}}

**II. BÊN ĐƯỢC ỦY QUYỀN (BÊN B):**
- **Họ và tên:** **{{authorizedPerson}}**
- **Chức vụ:** {{authorizedRole}} của {{companyName}}
- **Số CCCD:** {{authorizedId}} (Cấp ngày {{authorizedIdDate}} tại {{authorizedIdPlace}})

**III. NỘI DUNG VÀ PHẠM VI ỦY QUYỀN:**
1. Bên A ủy quyền cho Bên B thay mặt và nhân danh {{companyName}} thực hiện các công việc sau:
{{scope}}
2. Bên B có trách nhiệm báo cáo kết quả thực hiện công việc định kỳ hoặc đột xuất cho Bên A và chịu trách nhiệm trước pháp luật cũng như trước Bên A về các hành vi thực hiện trong phạm vi ủy quyền.
3. Bên B không được ủy quyền lại cho bất kỳ bên thứ ba nào khác nếu không có sự đồng ý bằng văn bản của Bên A.

**IV. THỜI HẠN ỦY QUYỀN:**
Giấy ủy quyền này có hiệu lực kể từ ngày **{{validFrom}}** đến hết ngày **{{validTo}}** hoặc chấm dứt khi công việc hoàn thành hoặc khi Bên A có văn bản thu hồi ủy quyền.

Giấy ủy quyền được lập thành 03 bản có giá trị pháp lý như nhau, lưu tại Văn phòng Công ty và các bên liên quan để thi hành./.

./.

| **NGƯỜI ĐƯỢC ỦY QUYỀN**<br>*(Ký và ghi rõ họ tên)*<br><br><br><br>**{{authorizedPerson}}** | **NGƯỜI ỦY QUYỀN / ĐẠI DIỆN PHÁP LUẬT**<br>*(Ký, đóng dấu & ghi rõ họ tên)*<br><br><br><br>**{{authorizerName}}** |
| :---: | :---: |
`
  },
  {
    id: 'digital-proposal',
    title: 'Đề xuất Kế hoạch & Tính toán ROI (Digital Proposal)',
    category: 'admin',
    categoryLabel: 'Chiến lược Doanh nghiệp',
    track: 'modern_enterprise',
    icon: '💡',
    description: 'Bản đề xuất giải pháp công nghệ, chuyển đổi số kèm bảng ước tính ROI và lộ trình triển khai.',
    defaultData: {
      companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ B.ARMY',
      proposalSubject: 'Đề án Tự động hóa Quy trình Quản trị Nhân sự và Tuyển dụng thông minh',
      proposerName: 'Trần Văn Giám Đốc',
      proposerRole: 'GIÁM ĐỐC CÔNG NGHỆ',
      targetCompany: 'Toàn thể Ban Lãnh đạo Công ty',
      expectedRoi: 'Tiết kiệm 45% thời gian xử lý hồ sơ, giảm 30% chi phí vận hành tuyển dụng'
    },
    templateText: `# BẢN ĐỀ XUẤT KẾ HOẠCH & TÍNH TOÁN HIỆU QUẢ ĐẦU TƯ (ROI)
### {{proposalSubject}}

**Đơn vị đề xuất:** Phòng Kỹ thuật & Công nghệ
**Đơn vị tiếp nhận:** {{targetCompany}}
**Hà Nội, ngày {{currentDate}}**

---

### I. HIỆN TRẠNG VÀ BÀI TOÁN KINH DOANH
1. Thực trạng vận hành hiện tại:
- Quy trình sàng lọc CV và soạn thảo văn bản hành chính đang phụ thuộc vào thao tác thủ công, tốn từ 2 - 3 giờ cho mỗi bộ tài liệu.
- Nguy cơ sai lệch thông tin và chậm tiến độ phản hồi ứng viên chất lượng cao trong mùa cao điểm.

2. Hệ quả kinh doanh:
- Chi phí cơ hội bị lãng phí do thời gian tuyển dụng kéo dài (Time-to-hire trung bình 32 ngày).
- Khối lượng công việc hành chính quá tải ảnh hưởng đến việc tập trung vào chiến lược nhân sự cốt lõi.

### II. CÁCH TIẾP CẬN VÀ GIẢI PHÁP ĐỀ XUẤT
Ứng dụng Nền tảng Tự động hóa Quy trình Tuyển dụng & Soạn thảo Hành chính thông minh tích hợp AI (PrivOS AI Engine):
- Bóc tách và chấm điểm CV tự động theo khung tiêu chí JD 5 giai đoạn.
- Sinh tự động hợp đồng thử việc, thư mời nhận việc, quyết định bổ nhiệm chuẩn thể thức Nghị định 30.
- Đồng bộ dữ liệu 2 chiều với hệ thống bảng Kanban quản lý hồ sơ nhân sự.

### III. BẢNG ƯỚC TÍNH CHI PHÍ VÀ HIỆU QUẢ ĐẦU TƯ (ROI)
| STT | Hạng mục so sánh | Quy trình thủ công cũ | Giải pháp AI tự động hóa mới | Hiệu quả cải thiện (ROI) |
| :---: | :--- | :--- | :--- | :--- |
| 1 | Thời gian sàng lọc 1 CV | 15 - 20 phút | 10 - 15 giây | **Giảm 95% thời gian** |
| 2 | Soạn thảo 01 Hợp đồng/Quyết định | 45 phút | 30 giây (1-Click) | **Giảm 98% thời gian** |
| 3 | Chi phí nhân sự vận hành | 120.000.000 VNĐ / năm | 25.000.000 VNĐ / năm | **Tiết kiệm 79% ngân sách** |
| 4 | Tỷ lệ chuẩn hóa thể thức | 75% (có lỗi chính tả) | 100% chuẩn NĐ 30 / Word XML | **Độ chính xác tuyệt đối** |

### IV. LỘ TRÌNH VÀ QUY TRÌNH TRIỂN KHAI (TIMELINE)
- **Giai đoạn 1 (Tuần 1 - 2):** Khởi tạo hệ thống, thiết lập cấu hình bảng Kanban và định nghĩa trường dữ liệu hồ sơ.
- **Giai đoạn 2 (Tuần 3 - 4):** Triển khai thử nghiệm (Pilot) trên 200 hồ sơ ứng viên và đào tạo nội bộ đội ngũ HR.
- **Giai đoạn 3 (Từ Tuần 5):** Chuyển giao toàn diện, vận hành chính thức trên toàn hệ thống doanh nghiệp.

Kính trình Ban Lãnh đạo xem xét phê duyệt chủ trương triển khai./.

./.

| **ĐƠN VỊ ĐỀ XUẤT**<br>*(Ký và ghi rõ họ tên)*<br><br><br><br>**{{proposerName}}** | **PHÊ DUYỆT CỦA BAN LÃNH ĐẠO**<br>*(Ký, đóng dấu & ghi rõ họ tên)*<br><br><br><br>**TỔNG GIÁM ĐỐC** |
| :---: | :---: |
`
  }
];

export function renderDraftingTemplate(templateText: string, data: Record<string, string>): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const currentDate = `${day}/${month}/${year}`;
  const docNumber = String(Math.floor(100 + Math.random() * 900));

  let result = templateText
    .replace(/\{\{currentDate\}\}/g, currentDate)
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{docNumber\}\}/g, docNumber);

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || `[${key}]`);
  }

  return result;
}

/**
 * Xây dựng Prompt chuẩn hóa gửi cho PrivOS AI
 * Kế thừa quy chuẩn Thể thức NĐ 30/2020/NĐ-CP và Luật Lao động từ skill 'xu-ly-van-phong'
 */
export function buildDraftingAIPrompt(
  template: DraftingTemplate,
  formData: Record<string, string>,
  actionType: 'full_generation' | 'make_formal' | 'make_concise' | 'add_nda' | 'bilingual_summary' | 'custom',
  customInstruction?: string,
  currentDocText?: string
): string {
  const isND30 = template.track === 'nd30_administrative';

  const systemDirectives = `
<system_directives>
  <role>
    Bạn là Chuyên gia Soạn thảo Văn bản Hành chính & Pháp chế Doanh nghiệp Cấp cao tại Việt Nam.
    Nhiệm vụ của bạn là soạn thảo, tinh chỉnh và chuẩn hóa văn bản hành chính theo đúng quy chuẩn thể thức Nghị định 30/2020/NĐ-CP và Bộ luật Lao động 2019.
  </role>

  <standards_nd30>
    QUY CHUẨN THỂ THỨC VĂN BẢN (BẮT BUỘC):
    - Khởi đầu văn bản LUÔN có Bảng Header 2 cột:
      | **TÊN CƠ QUAN / CÔNG TY**<br>Số: ... | **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**<br>**Độc lập - Tự do - Hạnh phúc** |
      | :---: | :---: |
    - Tên loại văn bản in hoa, in đậm (# KẾ HOẠCH / # QUYẾT ĐỊNH / # THÔNG BÁO / # HỢP ĐỒNG).
    - Trích yếu in thường, in đậm, bắt đầu bằng "### Về việc..." hoặc "### V/v...".
    - Các căn cứ pháp lý in nghiêng, mỗi căn cứ một dòng bắt đầu bằng "- Căn cứ ...;", căn cứ cuối kết thúc bằng dấu phẩy (,) hoặc chấm (.).
    - Đề mục phân cấp rõ: 1., a), - (thụt lề có tổ chức).
    - Đoạn kết thúc văn bản kết thúc bằng ký hiệu "./.".
    - Chân trang LUÔN có Bảng Footer 2 cột (Nơi nhận bên trái, Chức vụ chữ ký bên phải):
      | **Nơi nhận:**<br>*- Như trên;<br>*- Lưu: VT, ... | *Hà Nội, ngày ...*<br><br>**GIÁM ĐỐC**<br><br><br>*(Đã ký)*<br><br>**Họ và tên** |
      | :--- | :---: |
  </standards_nd30>

  <ai_cleansing_rules>
    QUY TẮC KHỬ DẤU VẾT AI (BẮT BUỘC):
    - CẤM dùng gạch ngang dài em dash "—". Thay thế bằng gạch ngang cách đều " - " hoặc từ nối tiếng Việt rõ nghĩa.
    - CẤM đặt dấu hai chấm ":" trong dòng tiêu đề/đề mục cấp 1.
    - CẤM dùng Oxford comma ", và".
    - Đại từ xưng hô chuẩn pháp nhân: "Công ty", "Ban Giám đốc", "Tổng Giám đốc", "Người lao động". Không dùng đại từ suồng sã ("tôi", "chúng mình").
  </ai_cleansing_rules>

  <zero_trust_rules>
    - Chỉ sử dụng các thông tin họ tên, phòng ban, mức lương, số liệu đã được cung cấp trong payload.
    - Không tự ý bịa thêm số liệu tài chính sai lệch.
  </zero_trust_rules>
</system_directives>
`;

  let actionInstruction = '';

  if (actionType === 'full_generation') {
    actionInstruction = `
HÃY SOẠN THẢO HOÀN CHỈNH VĂN BẢN MỚI DỰA TRÊN THÔNG TIN SAU:
- Loại văn bản: ${template.title} (${template.categoryLabel})
- Dữ liệu nhân sự và tham số:
${JSON.stringify(formData, null, 2)}

${customInstruction ? `YÊU CẦU BỔ SUNG ĐẶC BIỆT CỦA HR:\n${customInstruction}` : ''}
`;
  } else if (actionType === 'make_formal') {
    actionInstruction = `
HÃY CHUẨN HÓA VĂN PHONG VĂN BẢN HIỆN TẠI THEO CHUẨN HÀNH CHÍNH CÔNG VỤ (NĐ 30/2020/NĐ-CP):
- Tăng tính trang trọng, mạch lạc, chuẩn mực pháp lý.
- Đảm bảo đầy đủ căn cứ và thẩm quyền ban hành.
VĂN BẢN HIỆN TẠI:
${currentDocText}
`;
  } else if (actionType === 'make_concise') {
    actionInstruction = `
HÃY RÚT GỌN VĂN BẢN HIỆN TẠI (GIẢM 40-50% ĐỘ DÀI) NHƯNG GIỮ NGUYÊN 100% CÁC ĐIỀU KHOẢN PHÁP LÝ CỐT LÕI:
- Bỏ câu từ rườm rà, tập trung vào quyền lợi, nghĩa vụ và trách nhiệm thực thi.
VĂN BẢN HIỆN TẠI:
${currentDocText}
`;
  } else if (actionType === 'add_nda') {
    actionInstruction = `
HÃY BỔ SUNG THÊM ĐIỀU KHOẢN BẢO MẬT THÔNG TIN & SỞ HỮU TRÍ TUỆ (NDA) CHẶT CHẼ VÀO VĂN BẢN HIỆN TẠI:
- Cam kết bảo mật bí mật kinh doanh, mã nguồn, dữ liệu khách hàng.
- Thời hạn bảo mật tối thiểu 02 năm sau khi chấm dứt hợp đồng.
VĂN BẢN HIỆN TẠI:
${currentDocText}
`;
  } else if (actionType === 'bilingual_summary') {
    actionInstruction = `
HÃY BỔ SUNG PHẦN TÓM TẮT SONG NGỮ TIẾNG ANH (EXECUTIVE SUMMARY IN ENGLISH) Ở CUỐI VĂN BẢN ĐỂ BÁO CÁO BAN GIÁM ĐỐC/QUẢN LÝ NƯỚC NGOÀI:
VĂN BẢN HIỆN TẠI:
${currentDocText}
`;
  } else if (actionType === 'custom') {
    actionInstruction = `
HÃY ĐIỀU CHỈNH/BỔ SUNG VĂN BẢN HIỆN TẠI THEO YÊU CẦU CỤ THỂ DƯỚI ĐÂY:
YÊU CẦU: ${customInstruction}

VĂN BẢN HIỆN TẠI:
${currentDocText}
`;
  }

  const prompt = `${systemDirectives}

<task_payload>
${actionInstruction}

YÊU CẦU ĐẦU RA:
- Trả về toàn bộ nội dung văn bản hoàn chỉnh định dạng Markdown để in ấn A4.
- Bọc toàn bộ nội dung trong thẻ:
<drafting_content>
[Toàn bộ nội dung văn bản Markdown]
</drafting_content>
</task_payload>
`;

  return prompt;
}
