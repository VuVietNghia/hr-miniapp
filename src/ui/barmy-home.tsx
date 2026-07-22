import companyLogo from '../../public/images/company-logos/logo.svg?inline';

const FOCUS_AREAS = [
  {
    title: 'Đầu tư công nghệ AI',
    description: 'Đồng hành cùng các startup về machine learning, computer vision, NLP và generative AI.',
  },
  {
    title: 'Tăng tốc thị trường',
    description: 'Đưa giải pháp đến người dùng Việt Nam nhanh hơn nhờ hệ sinh thái truyền thông rộng lớn.',
  },
  {
    title: 'Blockchain & Web3',
    description: 'Đầu tư chiến lược vào các dự án blockchain có thể mở rộng năng lực của AI và hệ thống phi tập trung.',
  },
];
const PORTFOLIO = [
  'Privos AI',
  'Pictor Network',
  'PrivaSea',
  'KIP Protocol',
  'ApeX',
  'Fuel Network',
];
export default function BArmyHome() {
  return (
    <main className="barmy-home">
      <section className="barmy-hero">
        <div className="barmy-eyebrow">
          <img className="barmy-logo" src={companyLogo} alt="B.ARMY" />
        </div>
        <h1>AI &amp; Blockchain Ventures<br />cho thị trường Việt Nam</h1>
        <p>
          B.ARMY là hệ sinh thái đầu tư và tăng tốc AI, Blockchain, kết nối công nghệ
          tiên phong với cộng đồng người dùng tại Việt Nam.
        </p>
        <a className="barmy-link" href="https://www.b.army/" target="_blank" rel="noreferrer">
          Khám phá B.ARMY <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="barmy-stats" aria-label="Quy mô hệ sinh thái B.ARMY">
        <div><strong>2B+</strong><span>Lượt xem TikTok</span></div>
        <div><strong>50M+</strong><span>Người dùng mạng xã hội</span></div>
        <div><strong>1K+</strong><span>TikTok KOLs</span></div>
      </section>

      <section className="barmy-section">
        <div className="barmy-section-heading">
          <span>CHÚNG TÔI LÀM GÌ</span>
          <h2>Biến ý tưởng công nghệ thành sự hiện diện thực tế.</h2>
        </div>
        <div className="barmy-focus-grid">
          {FOCUS_AREAS.map((area, index) => (
            <article className="barmy-focus-card" key={area.title}>
              <span className="barmy-card-number">0{index + 1}</span>
              <h3>{area.title}</h3>
              <p>{area.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="barmy-portfolio">
        <div className="barmy-portfolio-heading">
          <span>HỆ SINH THÁI</span>
          <h2>Danh mục công nghệ đang phát triển</h2>
        </div>
        <div className="barmy-portfolio-grid">
          {PORTFOLIO.map((project, index) => (
            <article className={`barmy-project-card barmy-project-${index + 1}`} key={project}>
              <div className="barmy-project-art" aria-hidden="true">
                <i /><i /><i />
              </div>
              <h3>{project}</h3>
              <span className="barmy-project-arrow" aria-hidden="true">&#8599;</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
