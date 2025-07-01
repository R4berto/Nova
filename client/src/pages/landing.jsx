import React, { useState, useEffect } from "react";
import styles from "./landing.module.css";

export default function Landing() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    { 
      title: "Integrated Messaging", 
      desc: "Chat instantly with peers and instructors, share files, links, and ideas in one focused space that travels with every course.",
      icon: "💬",
      color: "var(--clr-accent)"
    },
    { 
      title: "Offline Exam Creation", 
      desc: "Build full exams without internet, save locally, then sync online later so assessment design never pauses your momentum.",
      icon: "📝",
      color: "#666"
    },
    { 
      title: "Progress Pulse", 
      desc: "Vibrant charts to for your professor to track your progress in exams to keep students aware of their performance",
      icon: "📊",
      color: "#999"
    }
  ];

  const projects = [
    {
      title: "Live Leaderboard",
      category: "Analytics",
      image: "📊",
      desc: "Professors track student performance in real time, spotlighting top achievers and identifying who needs support—all from one clean dashboard."
    },
    {
      title: "Smart Course Control",
      category: "Management", 
      image: "⚙️",
      desc: "Professors can activate, archive, or deactivate courses anytime—and instantly manage student access with kick and disable options built in."
    },
    {
      title: "Personalized Timestamps",
      category: "Learning",
      image: "🔬",
      desc: "Dive into each course that color-codes the time on assignments, to keep track on the eagerness of students learning in the course."
    }
  ];

  const testimonials = [
    { 
      quote: "This platform completely transformed how I approach learning. The interactive elements and community support are incredible.", 
      name: "Sarah Chen", 
      role: "UX Designer",
      company: "Meta"
    },
    { 
      quote: "The mentoring feature helped me land my dream job. It's like having a personal coach available 24/7.", 
      name: "Marcus Rodriguez", 
      role: "Software Engineer",
      company: "Google"
    }
  ];

  return (
    <main className={styles.page}>
      {/* ========== HERO ========== */}
      <section className={styles.hero} role="banner">
        <div 
          className={styles.heroBackground}
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`
          }}
        >
          <div className={styles.solar}>
            <i className={styles.mercury}></i>
            <i className={styles.venus}></i>
            <i className={styles.earth}></i>
            <i className={styles.mars}></i>
            <i className={styles.belt}></i>
            <i className={styles.jupiter}></i>
            <i className={styles.saturn}></i>
            <i className={styles.uranus}></i>
            <i className={styles.neptune}></i>
          </div>
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>Next-Generation Learning</span>
            <h1 className={styles.heroTitle}>
              Learn
              <span className={styles.heroHighlight}> Without </span>
              Limits
            </h1>
            <p className={styles.heroSubtitle}>
              Experience the future of education with mentoring, 
              interactive projects, and a global community of innovators.
            </p>
            <div className={styles.heroActions}>
              <a href="/login" className={styles.ctaPrimary}>
                Start Your Journey
              </a>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.floatingCard} style={{ animationDelay: '0s' }}>
              <span className={styles.cardIcon}>🎯</span>
              <span className={styles.cardText}>Personalized Learning</span>
            </div>
            <div className={styles.floatingCard} style={{ animationDelay: '0.5s' }}>
              <span className={styles.cardIcon}>⚡</span>
              <span className={styles.cardText}>Real-time Collaboration</span>
            </div>
            <div className={styles.floatingCard} style={{ animationDelay: '1s' }}>
              <span className={styles.cardIcon}>🏆</span>
              <span className={styles.cardText}>Exam Ranking System</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========== INTERACTIVE FEATURES ========== */}
      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Why Choose Us</span>
            <h2 className={styles.sectionTitle}>Revolutionary Learning Experience</h2>
          </div>
          
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <article 
                key={feature.title} 
                className={styles.featureCard}
              >
                <div className={styles.featureIcon} style={{ borderColor: feature.color }}>
                  {feature.icon}
                </div>
                <div className={styles.featureContent}>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureDesc}>{feature.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========== INTERACTIVE PROJECTS ========== */}
      <section className={styles.projectsSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Featured Projects</span>
            <h2 className={styles.sectionTitle}>Hands-on Learning Experiences</h2>
          </div>
          
          <div className={styles.projectsGrid}>
            {projects.map((project, index) => (
              <div key={project.title} className={styles.projectCard}>
                <div className={styles.projectImage}>
                  <span className={styles.projectEmoji}>{project.image}</span>
                  <div className={styles.projectOverlay}>
                    <span className={styles.projectCategory}>{project.category}</span>
                  </div>
                </div>
                <div className={styles.projectInfo}>
                  <h3 className={styles.projectTitle}>{project.title}</h3>
                  <p className={styles.projectDesc}>{project.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ========== CTA SECTION ========== */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Ready to Transform Your Future?</h2>
            <p className={styles.ctaSubtitle}>
              Join thousands of learners who are already building tomorrow's skills today.
            </p>
            <div className={styles.ctaActions}>
              <a href="/login" className={styles.ctaPrimary}>Get Started</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
} 