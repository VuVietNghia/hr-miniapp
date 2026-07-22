import { useState } from 'react';

type Department = 'it' | 'marketing' | 'hr';

interface Job {
  title: string;
  type: string;
  salary: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  bonuses: string[];
}

const DEPARTMENTS: { id: Department; label: string; count?: number }[] = [
  { id: 'it', label: 'IT', count: 3 },
  { id: 'marketing', label: 'Marketing' },
  { id: 'hr', label: 'HR' },
];

const IT_JOBS: Job[] = [
  {
    title: 'Thực tập sinh / Junior Backend Java Developer',
    type: 'Full-time hoặc Part-time',
    salary: 'Hỗ trợ thực tập 3 – 6 triệu/tháng',
    summary: 'Tham gia phát triển backend cho MiniApp và Web App cùng đội ngũ kỹ thuật.',
    responsibilities: [
      'Phát triển hệ thống backend Java/Spring Boot cho MiniApp và Web App.',
      'Thiết kế, tối ưu cơ sở dữ liệu SQL Server và MySQL.',
      'Tích hợp APIs cùng đội ngũ Frontend và viết unit test.',
    ],
    requirements: [
      'Nắm vững Java và kiến thức phát triển ứng dụng web.',
      'Hiểu Spring Boot: Spring MVC, Spring Data JPA, Spring Security.',
      'Biết Git/GitHub; tư duy logic, chủ động và có trách nhiệm.',
    ],
    bonuses: ['Có dự án Spring Boot thực tế.', 'Biết Docker, VueJS hoặc Python là lợi thế.'],
  },
  {
    title: 'Chuyên viên CNTT / Hệ thống',
    type: 'Full-time',
    salary: '12 – 18 triệu/tháng',
    summary: 'Vận hành hạ tầng công nghệ, hỗ trợ người dùng và tư vấn giải pháp CNTT cho công ty.',
    responsibilities: [
      'Quản lý mạng nội bộ, camera, máy chấm công và server.',
      'Triển khai, vận hành các phần mềm MS365, Base.vn, FastWork, NextCloud.',
      'Hỗ trợ Helpdesk và tham mưu giải pháp tối ưu hiệu suất doanh nghiệp.',
    ],
    requirements: [
      'Tốt nghiệp CNTT, An toàn thông tin hoặc Điện tử viễn thông.',
      'Có kinh nghiệm Microsoft 365, Base.vn và hạ tầng mạng.',
      'Troubleshooting tốt, cẩn thận và có khả năng tự nghiên cứu.',
    ],
    bonuses: ['Có chứng chỉ CCNA/MCSA.', 'Biết AWS, Azure hoặc ảo hóa.'],
  },
  {
    title: 'Thực tập sinh Manual Tester / QC',
    type: 'Full-time hoặc Part-time',
    salary: 'Hỗ trợ thực tập 2 – 5 triệu/tháng',
    summary: 'Kiểm thử sản phẩm Web, Mobile và MiniApp để mang lại trải nghiệm chất lượng cho người dùng.',
    responsibilities: [
      'Phân tích PRD/SOP và viết Test Case, Test Scenario.',
      'Kiểm thử thủ công trên Web, Mobile và MiniApp.',
      'Theo dõi bug bằng Trello/Jira và phối hợp nghiệm thu tính năng.',
    ],
    requirements: [
      'Hiểu Testing Lifecycle, Test Levels và Test Types.',
      'Viết Test Case rõ ràng; tỉ mỉ khi phát hiện lỗi UI/UX và logic.',
      'Sử dụng tốt Trello, Excel hoặc công cụ quản lý bug.',
    ],
    bonuses: ['Biết Postman.', 'Có kiến thức Selenium, Photoshop hoặc Figma.'],
  },
];

export default function RecruitmentPanel() {
  const [department, setDepartment] = useState<Department>('it');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const selectDepartment = (nextDepartment: Department) => {
    setDepartment(nextDepartment);
    setSelectedJob(null);
  };

  return (
    <main className="recruitment-page">
      <section className="recruitment-hero">
        <span>B.ARMY CAREERS</span>
        <h1>Cùng tạo nên những sản phẩm công nghệ có ảnh hưởng.</h1>
        <p>Khám phá cơ hội nghề nghiệp và phát triển cùng đội ngũ B.ARMY.</p>
      </section>

      <section className="recruitment-content">
        <div className="recruitment-category-list" role="tablist" aria-label="Nhóm vị trí tuyển dụng">
          {DEPARTMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={department === item.id}
              className={`recruitment-category${department === item.id ? ' recruitment-category-active' : ''}`}
              onClick={() => selectDepartment(item.id)}
            >
              {item.label}
              {item.count && <span>{item.count}</span>}
            </button>
          ))}
        </div>

        {department === 'it' ? (
          <>
            <div className="recruitment-heading">
              <div>
                <span>ĐANG TUYỂN</span>
                <h2>Vị trí IT</h2>
              </div>
            </div>

            <div className="job-grid">
              {IT_JOBS.map((job) => (
                <article className="job-card" key={job.title}>
                  <span className="job-team">IT</span>
                  <h3>{job.title}</h3>
                  <p>{job.summary}</p>
                  <dl>
                    <div><dt>Hình thức</dt><dd>{job.type}</dd></div>
                    <div><dt>Thu nhập</dt><dd>{job.salary}</dd></div>
                  </dl>
                  <button
                    type="button"
                    className="job-detail-button"
                    onClick={() => setSelectedJob(selectedJob?.title === job.title ? null : job)}
                  >
                    {selectedJob?.title === job.title ? 'Thu gọn' : 'Xem chi tiết'} <span aria-hidden="true">→</span>
                  </button>
                </article>
              ))}
            </div>

            {selectedJob && (
              <article className="job-detail-panel">
                <div className="job-detail-title">
                  <div>
                    <span>IT · THÔNG TIN TUYỂN DỤNG</span>
                    <h2>{selectedJob.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedJob(null)} aria-label="Đóng chi tiết vị trí">×</button>
                </div>
                <div className="job-detail-columns">
                  <div>
                    <h3>Mô tả công việc</h3>
                    <ul>{selectedJob.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <h3>Yêu cầu</h3>
                    <ul>{selectedJob.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <h3>Điểm cộng</h3>
                    <ul>{selectedJob.bonuses.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </div>
              </article>
            )}
          </>
        ) : (
          <section className="recruitment-empty">
            <div aria-hidden="true">+</div>
            <h2>Vị trí {department === 'marketing' ? 'Marketing' : 'HR'} đang được cập nhật</h2>
            <p>Hãy quay lại sau để khám phá những cơ hội phù hợp với bạn.</p>
          </section>
        )}
      </section>
    </main>
  );
}
