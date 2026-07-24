import { EmployeeProfile } from '../types';

interface ProfileCardProps {
  profile: EmployeeProfile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <div className="lifecycle-profile-card">
      <div className="profile-name">
        <span className="profile-icon">👤</span> 
        {profile.name}
      </div>
      <div className="profile-badge-row">
        {profile.position && <span className="position-badge">{profile.position}</span>}
        {profile.department && <span className="dept-badge">{profile.department}</span>}
      </div>
      
      <div className="profile-details">
        {(profile.phone || profile.email) && (
          <div className="detail-section">
            {profile.phone && (
              <div className="detail-row">
                <span className="detail-icon">📞</span> 
                <span className="detail-value">{profile.phone}</span>
              </div>
            )}
            {profile.email && (
              <div className="detail-row">
                <span className="detail-icon">✉️</span> 
                <span className="detail-value text-truncate" title={profile.email}>{profile.email}</span>
              </div>
            )}
          </div>
        )}

        <div className="detail-divider"></div>

        <div className="detail-section">
          <div className="detail-row">
            <span className="detail-label">MST:</span> 
            <span className="detail-value">{profile.mst || '---'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">STK:</span> 
            <span className="detail-value">{profile.bankAccount || '---'}</span>
          </div>
          {profile.salary && (
            <div className="detail-row">
              <span className="detail-label">Lương:</span> 
              <span className="detail-value font-mono">
                {parseInt(profile.salary).toLocaleString('vi-VN')} đ
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
