import { FormEvent, useState } from 'react';

type Department = 'it' | 'marketing' | 'hr' | 'other';

interface Job {
  title: string;
  type: string;
  salary: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  bonuses: string[];
}

interface JobDraft {
  title: string;
  type: string;
  salary: string;
  summary: string;
  responsibilities: string;
  requirements: string;
  bonuses: string;
}

const EMPTY_DRAFT: JobDraft = {
  title: '',
  type: '',
  salary: '',
  summary: '',
  responsibilities: '',
  requirements: '',
  bonuses: '',
};

const DEPARTMENTS: { id: Department; label: string; count?: number }[] = [
  { id: 'it', label: 'IT', count: 3 },
  { id: 'marketing', label: 'Marketing' },
  { id: 'hr', label: 'HR' },
  { id: 'other', label: 'Khác' },
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

function splitLines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export default function RecruitmentPanel() {
  const [department, setDepartment] = useState<Department>('it');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(EMPTY_DRAFT);

  const selectDepartment = (nextDepartment: Department) => {
    setDepartment(nextDepartment);
    setSelectedJob(null);
  };

  const submitJob = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.summary.trim()) return;

    setCustomJobs((jobs) => [
      ...jobs,
      {
        title: draft.title.trim(),
        type: draft.type.trim() || 'Thỏa thuận',
        salary: draft.salary.trim() || 'Thỏa thuận',
        summary: draft.summary.trim(),
        responsibilities: splitLines(draft.responsibilities),
        requirements: splitLines(draft.requirements),
        bonuses: splitLines(draft.bonuses),
      },
    ]);
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  };

  const jobs = department === 'it' ? IT_JOBS : customJobs;
  const departmentLabel = department === 'it' ? 'IT' : 'Khác';

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
              {(item.count || item.id === 'other') && <span>{item.id === 'other' ? customJobs.length : item.count}</span>}
            </button>
          ))}
        </div>

        {(department === 'it' || department === 'other') && (
          <>
            <div className="recruitment-heading">
              <div>
                <span>{department === 'it' ? 'ĐANG TUYỂN' : 'TỰ TẠO JD'}</span>
                <h2>Vị trí {departmentLabel}</h2>
              </div>
              {department === 'other' && (
                <button type="button" className="add-job-button" onClick={() => setShowForm(true)}>
                  <span aria-hidden="true">+</span> Thêm JD
                </button>
              )}
            </div>

            {department === 'other' && showForm && (
              <form className="job-form" onSubmit={submitJob}>
                <div className="job-form-heading">
                  <div>
                    <span>JD MỚI</span>
                    <h3>Thêm vị trí tuyển dụng</h3>
                  </div>
                  <button type="button" aria-label="Đóng form thêm JD" onClick={() => setShowForm(false)}>×</button>
                </div>
                <div className="job-form-grid">
                  <label>
                    Tên vị trí <b>*</b>
                    <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ví dụ: Chuyên viên Vận hành" required />
                  </label>
                  <label>
                    Hình thức
                    <input value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} placeholder="Ví dụ: Full-time" />
                  </label>
                  <label>
                    Thu nhập
                    <input value={draft.salary} onChange={(event) => setDraft({ ...draft, salary: event.target.value })} placeholder="Ví dụ: 15 – 20 triệu/tháng" />
                  </label>
                  <label className="job-form-wide">
                    Mô tả ngắn <b>*</b>
                    <textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="Giới thiệu ngắn về vị trí..." required />
                  </label>
                  <label>
                    Mô tả công việc
                    <textarea value={draft.responsibilities} onChange={(event) => setDraft({ ...draft, responsibilities: event.target.value })} placeholder="Mỗi dòng là một đầu việc" />
                  </label>
                  <label>
                    Yêu cầu
                    <textarea value={draft.requirements} onChange={(event) => setDraft({ ...draft, requirements: event.target.value })} placeholder="Mỗi dòng là một yêu cầu" />
                  </label>
                  <label className="job-form-wide">
                    Điểm cộng
                    <textarea value={draft.bonuses} onChange={(event) => setDraft({ ...draft, bonuses: event.target.value })} placeholder="Mỗi dòng là một điểm cộng" />
                  </label>
                </div>
                <div className="job-form-actions">
                  <button type="button" onClick={() => setShowForm(false)}>Hủy</button>
                  <button type="submit">Lưu JD</button>
                </div>
              </form>
            )}

            {jobs.length > 0 ? (
              <div className="job-grid">
                {jobs.map((job) => (
                  <article className="job-card" key={job.title}>
                    <span className="job-team">{departmentLabel}</span>
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
            ) : (
              !showForm && (
                <section className="recruitment-empty recruitment-empty-compact">
                  <div aria-hidden="true">+</div>
                  <h2>Chưa có JD nào</h2>
                  <p>Chọn “Thêm JD” để tạo vị trí tuyển dụng mới.</p>
                </section>
              )
            )}

            {selectedJob && (
              <article className="job-detail-panel">
                <div className="job-detail-title">
                  <div>
                    <span>{departmentLabel} · THÔNG TIN TUYỂN DỤNG</span>
                    <h2>{selectedJob.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedJob(null)} aria-label="Đóng chi tiết vị trí">×</button>
                </div>
                <div className="job-detail-columns">
                  {selectedJob.responsibilities.length > 0 && (
                    <div><h3>Mô tả công việc</h3><ul>{selectedJob.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  )}
                  {selectedJob.requirements.length > 0 && (
                    <div><h3>Yêu cầu</h3><ul>{selectedJob.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  )}
                  {selectedJob.bonuses.length > 0 && (
                    <div><h3>Điểm cộng</h3><ul>{selectedJob.bonuses.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  )}
                </div>
              </article>
            )}
          </>
        )}

        {(department === 'marketing' || department === 'hr') && (
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
