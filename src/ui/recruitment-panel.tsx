import { FormEvent, useState, useEffect } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { createOrUpdateFile } from './privos-rest';
import { PipelineService } from './pipeline-service';
import { MarkdownPathContextBuilder } from './cv-context-builder';

type Department = string;

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
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();

  const [departments, setDepartments] = useState<{ id: Department; label: string; count?: number }[]>([
    { id: 'it', label: 'IT', count: 3 },
    { id: 'marketing', label: 'Marketing' },
    { id: 'hr', label: 'HR' },
    { id: 'other', label: 'Khác' },
  ]);
  const [department, setDepartment] = useState<Department>('it');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobsByDept, setJobsByDept] = useState<Record<string, Job[]>>({
    'it': IT_JOBS,
    'marketing': [],
    'hr': [],
    'other': [],
  });
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!app || !roomId) return;
    const loadJDs = async () => {
      try {
        const service = new PipelineService(app, roomId, new MarkdownPathContextBuilder());
        const jds = await service.fetchAvailableJDs();
        
        const nextJobsByDept: Record<string, Job[]> = {
          it: [...IT_JOBS],
          marketing: [],
          hr: [],
          other: []
        };
        const nextDepts = [
          { id: 'it', label: 'IT', count: 3 },
          { id: 'marketing', label: 'Marketing' },
          { id: 'hr', label: 'HR' },
          { id: 'other', label: 'Khác' },
        ];

        for (const jd of jds) {
          if (!jd.name.startsWith('JD_')) continue;
          if (jd.name === 'JD_Backend_Java.md' || jd.name === 'JD_IT_System_Admin.md' || jd.name === 'JD_Manual_Tester.md') continue;
          
          let content = '';
          try {
            if (jd.downloadUrl) {
              const res = await fetch(jd.downloadUrl);
              content = await res.text();
            } else {
              const res: any = await app.callServerTool({
                name: 'privos.files.getContent',
                arguments: { path: `${roomId}/hr-miniapp/jds/${jd.name}` }
              });
              content = typeof res === 'string' ? res : (res?.data || '');
            }
          } catch (e: any) {
            content = await service.getMarkdownContent(jd.name);
          }
          if (!content) {
            continue;
          }

          const titleMatch = content.match(/^# (.*)/m);
          if (!titleMatch) {
            continue;
          }

          const deptMatch = content.match(/- Ph\u00f2ng ban: (.*)/);
          const typeMatch = content.match(/- H\u00ecnh th\u1ee9c: (.*)/);
          const salaryMatch = content.match(/- Thu nh\u1eadp: (.*)/);
          const summaryMatch = content.match(/- M\u00f4 t\u1ea3 ng\u1eafn: (.*)/);
          
          const title = titleMatch[1].trim();
          const deptLabel = deptMatch ? deptMatch[1].trim() : 'Khác';
          const type = typeMatch ? typeMatch[1].trim() : 'Thỏa thuận';
          const salary = salaryMatch ? salaryMatch[1].trim() : 'Thỏa thuận';
          const summary = summaryMatch ? summaryMatch[1].trim() : '';

          const deptId = deptLabel.toLowerCase().replace(/\s+/g, '_');
          if (!nextDepts.find(d => d.id === deptId)) {
            nextDepts.push({ id: deptId, label: deptLabel });
          }

          if (!nextJobsByDept[deptId]) nextJobsByDept[deptId] = [];

          const respMatch = content.match(/## M\u00f4 t\u1ea3 c\u00f4ng vi\u1ec7c\n([\s\S]*?)(?=\n## |\n*$)/);
          const responsibilities = respMatch ? respMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim()) : [];
          
          const reqMatch = content.match(/## Y\u00eau c\u1ea7u\n([\s\S]*?)(?=\n## |\n*$)/);
          const requirements = reqMatch ? reqMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim()) : [];

          const bonusMatch = content.match(/## \u0110i\u1ec3m c\u1ed9ng\n([\s\S]*?)(?=\n## |\n*$)/);
          const bonuses = bonusMatch ? bonusMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim()) : [];

          // Avoid duplicates
          if (!nextJobsByDept[deptId].find(j => j.title === title)) {
            nextJobsByDept[deptId].push({
              title, type, salary, summary, responsibilities, requirements, bonuses
            });
          }
        }

        setDepartments(nextDepts);
        setJobsByDept(nextJobsByDept);
      } catch (e: any) {
        console.error("Failed to load JDs from room files", e);
      }
    };
    loadJDs();
  }, [app, roomId]);

  const selectDepartment = (nextDepartment: Department) => {
    setDepartment(nextDepartment);
    setSelectedJob(null);
  };

  const submitJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.summary.trim()) return;

    const newJob: Job = {
      title: draft.title.trim(),
      type: draft.type.trim() || 'Thỏa thuận',
      salary: draft.salary.trim() || 'Thỏa thuận',
      summary: draft.summary.trim(),
      responsibilities: splitLines(draft.responsibilities),
      requirements: splitLines(draft.requirements),
      bonuses: splitLines(draft.bonuses),
    };

    setJobsByDept(prev => ({
      ...prev,
      [department]: [...(prev[department] || []), newJob]
    }));

    if (app && roomId) {
      const content = `# ${newJob.title}
- Phòng ban: ${departments.find(d => d.id === department)?.label || department}
- Hình thức: ${newJob.type}
- Thu nhập: ${newJob.salary}
- Mô tả ngắn: ${newJob.summary}

## Mô tả công việc
${newJob.responsibilities.map(x => `- ${x}`).join('\n')}

## Yêu cầu
${newJob.requirements.map(x => `- ${x}`).join('\n')}

## Điểm cộng
${newJob.bonuses.map(x => `- ${x}`).join('\n')}
`;
      const fileName = `JD_${newJob.title.replace(/[^a-zA-Z0-9_]/g, '_')}.md`;
      createOrUpdateFile(app, `${roomId}/hr-miniapp/jds/${fileName}`, content)
        .catch(console.error);
    }

    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  };

  const addDepartment = () => {
    const name = window.prompt("Nhập tên phòng ban mới:");
    if (name && name.trim()) {
      const id = name.trim().toLowerCase().replace(/\s+/g, '_');
      if (!departments.find(d => d.id === id)) {
        setDepartments([...departments, { id, label: name.trim() }]);
        setJobsByDept(prev => ({ ...prev, [id]: [] }));
        setDepartment(id);
      }
    }
  };

  const jobs = jobsByDept[department] || [];
  const departmentLabel = departments.find(d => d.id === department)?.label || department;

  return (
    <main className="recruitment-page">
      <section className="recruitment-hero">
        <span>B.ARMY CAREERS</span>
        <h1>Cùng tạo nên những sản phẩm công nghệ có ảnh hưởng.</h1>
        <p>Khám phá cơ hội nghề nghiệp và phát triển cùng đội ngũ B.ARMY.</p>
      </section>

      <section className="recruitment-content">
        <div className="recruitment-category-list" role="tablist" aria-label="Nhóm vị trí tuyển dụng" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
          {departments.map((item) => {
            const count = item.id === 'it' ? 3 : (jobsByDept[item.id]?.length || 0);
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={department === item.id}
                className={`recruitment-category${department === item.id ? ' recruitment-category-active' : ''}`}
                onClick={() => selectDepartment(item.id)}
              >
                {item.label}
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
          <button type="button" className="recruitment-category" onClick={addDepartment} style={{ borderStyle: 'dashed' }}>
            + Thêm phòng ban
          </button>
        </div>

            <div className="recruitment-heading">
              <div>
                <span>{jobs.length > 0 ? 'ĐANG TUYỂN' : 'TỰ TẠO JD'}</span>
                <h2>Vị trí {departmentLabel}</h2>
              </div>
              <button type="button" className="add-job-button" onClick={() => setShowForm(true)}>
                <span aria-hidden="true">+</span> Thêm JD
              </button>
            </div>

            {showForm && (
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
      </section>
    </main>
  );
}
