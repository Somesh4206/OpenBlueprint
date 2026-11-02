// SEO utilities for structured data (JSON-LD)

export function generateOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OpenBlueprint',
    description: 'AI-powered architectural planning and preliminary blueprint generation platform for homes and small construction projects.',
    url: 'https://openblueprint.onrender.com',
    slogan: 'From Measurements to Intelligent Blueprints.',
  };
}

export function generateWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OpenBlueprint',
    url: 'https://openblueprint.onrender.com',
    description: 'AI-powered architectural planning and preliminary blueprint generation platform.',
  };
}

export function generateFAQJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is OpenBlueprint?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'OpenBlueprint is an AI-powered architectural planning platform that generates editable preliminary floor plans from your plot measurements and room requirements.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does OpenBlueprint work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Enter your plot dimensions, define your room requirements, and the AI generates multiple dimension-aware preliminary floor plan concepts that you can inspect, edit, visualize in 3D, estimate costs for, and export.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is OpenBlueprint free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'OpenBlueprint offers a free Starter plan with 3 projects, a Pro plan at ₹1,499/mo with unlimited projects and advanced features, and a Studio plan at ₹4,999/mo for teams and professionals.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I export my floor plans?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, you can export your designs as PDF blueprints, PNG images, SVG vectors, or JSON project files.',
        },
      },
    ],
  };
}
