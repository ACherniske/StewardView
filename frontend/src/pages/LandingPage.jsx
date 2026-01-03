import '../styles/pages/LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="project-title">StewardView</h1>
          <p className="brief-description">
            Empowering land trusts and communities to document, monitor, and protect natural spaces through collaborative visual stewardship
          </p>
          <div className="scroll-indicator">
            <span>Scroll to learn more</span>
            <svg className="scroll-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Detailed Description Section */}
      <section className="details-section">
        <div className="details-content">
          <h2>About StewardView</h2>
          <div className="description-placeholder">
            <p>Add your in-depth description here...</p>
            <p>This section will contain more detailed information about the project.</p>
            <p>You can add multiple paragraphs of content to explain the mission, features, and benefits of StewardView.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
