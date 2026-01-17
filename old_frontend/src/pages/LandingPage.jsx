import '../styles/pages/LandingPage.css';
import { Mail } from 'lucide-react';

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
          <h2>Documenting Change Over Time</h2>
          
          <div className="intro-block">
            <p>
              StewardView transforms how land trusts and conservation organizations monitor environmental change on their trails. 
              By capturing consistent photos over months and years, we create compelling timelapses that reveal the dynamic 
              story of natural spaces
            </p>
          </div>
          
          <div className="content-block-wrapper">
            <div className="content-block reverse">
              <div className="image-placeholder right">
                <span>Placeholder</span>
              </div>
              <div className="text-content">
                <h3>How It Works</h3>
                <p>
                  Along designated trails, we install custom tripod stations at key observation points. Visitors simply insert 
                  their smartphone into the tripod mount, which ensures every photo is taken from the exact same angle and position. 
                  This consistency is crucial—it's what transforms individual snapshots into smooth, professional timelapses that 
                  clearly show environmental change.
                </p>
                <p>
                  After capturing a photo, contributors can instantly upload it through our mobile-friendly interface. The system 
                  automatically organizes photos by location and date, then compiles them into timelapses that land trusts can 
                  use for education, advocacy, and stewardship.
                </p>
              </div>
            </div>
          </div>
          
          <div className="content-block-wrapper">
            <div className="content-block">
              <div className="image-placeholder left">
                <span>Placeholder</span>
              </div>
              <div className="text-content">
                <h3>Why It Matters</h3>
                <p>
                  Visual documentation is powerful. A timelapse showing forest regrowth after invasive species removal, the 
                  progression of seasonal wildflowers, or the impact of erosion control measures tells a story that resonates 
                  with stakeholders, funders, and the public in ways that reports alone cannot.
                </p>
                <p>
                  By crowdsourcing this documentation through trail visitors, we create a sustainable monitoring system that 
                  builds community engagement while reducing the workload on land trust staff. Every hiker becomes a contributor 
                  to conservation science.
                </p>
              </div>
            </div>
          </div>
          
          <div className="content-block-wrapper">
            <div className="content-block reverse">
              <div className="image-placeholder right">
                <span>Placeholder</span>
              </div>
              <div className="text-content">
                <h3 >Built for Land Trusts</h3>
                <p>
                  StewardView is designed specifically for conservation organizations managing trails and natural areas. Whether 
                  you're monitoring restoration projects, documenting seasonal changes, tracking trail conditions, or simply 
                  showcasing the beauty of your protected lands, our platform makes it easy to harness the power of community 
                  science and time-lapse photography.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Involved Section */}
      <section className="get-involved-section">
        <div className="get-involved-content">
          <h2>Get Involved</h2>
          <p>
            Interested in bringing StewardView to your land trust or conservation organization? We're actively seeking 
            partners to pilot this platform and help shape its development. Whether you manage trails, oversee conservation 
            projects, or want to engage your community in environmental stewardship, we'd love to hear from you.
          </p>
          <p>
            Reach out to discuss how StewardView can support your organization's mission and help tell the story of 
            your protected lands.
          </p>
          <div className="contact-info">
            <a href="mailto:acherniske@gmail.com">
              <Mail size={24} />
              <span>Reach Out</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
