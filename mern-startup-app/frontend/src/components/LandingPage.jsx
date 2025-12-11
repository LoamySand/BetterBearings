import { useState } from 'react';
import { userAPI } from '../services/api';

export default function LandingPageSimple() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    if (email && name) {
      try {
        await userAPI.create({ name, email });
        alert(`Thanks for signing up, ${name}!`);
        setEmail('');
        setName('');
      } catch (error) {
        console.error('Error:', error);
        alert('Error signing up. Please try again.');
      }
    }
  };

  return (
    <div className="landing-container">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-content">
          <div className="logo">
            <div className="logo-icon">S</div>
            <span className="logo-text">Startup</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <button className="btn-primary">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <h1>
          Build Your Dream Product
          <span className="hero-gradient">10x Faster</span>
        </h1>
        <p>The all-in-one platform for startups</p>
        
        <div className="signup-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="input"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="input"
          />
          <button onClick={handleSubmit} className="btn-submit">
            Start Free →
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <h2 className="section-title">Powerful Features</h2>
        <div className="features-grid">
          {[
            { title: "Lightning Fast", icon: "⚡" },
            { title: "Secure", icon: "🔒" },
            { title: "Easy Integration", icon: "🔌" },
          ].map((feature, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="pricing">
        <h2 className="section-title">Simple Pricing</h2>
        <div className="pricing-grid">
          {[
            { name: "Starter", price: "$29", features: ["5 Projects", "10GB Storage"] },
            { name: "Pro", price: "$79", features: ["Unlimited Projects", "100GB Storage"], popular: true },
            { name: "Enterprise", price: "$199", features: ["Unlimited Everything", "24/7 Support"] },
          ].map((plan, idx) => (
            <div key={idx} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              <h3>{plan.name}</h3>
              <div>
                <span className="price">{plan.price}</span>
                <span className="price-period">/month</span>
              </div>
              <ul className="features-list">
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx}>
                    <span className="checkmark">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button className="btn-primary" style={{width: '100%'}}>Get Started</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}