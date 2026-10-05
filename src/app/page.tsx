import { Metadata } from 'next';
import { AppRouter } from '@/components/openblueprint/app-router';

// Enhanced metadata specifically for the homepage
export const metadata: Metadata = {
  title: 'OpenBlueprint — Free AI Blueprint & Floor Plan Generator',
  description: 'Create professional architectural blueprints and floor plans instantly with AI. Free online tool for home design, construction planning, and 3D visualization. No CAD experience needed.',
  alternates: {
    canonical: 'https://openblueprint.vercel.app',
  },
};

export default function Home() {
  return (
    <>
      {/* SEO-friendly static content that crawlers can index */}
      <noscript>
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <h1>OpenBlueprint - AI-Powered Blueprint & Floor Plan Generator</h1>
          <p>
            OpenBlueprint is a free, AI-powered tool for creating professional architectural blueprints 
            and floor plans. Design homes, visualize in 3D, and estimate construction costs in minutes.
          </p>
          <h2>Key Features:</h2>
          <ul>
            <li>AI-powered floor plan generation</li>
            <li>Interactive 2D blueprint editor with 45+ furniture items</li>
            <li>Real-time 3D visualization</li>
            <li>Construction cost estimation</li>
            <li>Export to PDF, PNG, and SVG formats</li>
            <li>Multiple design strategies (balanced, open, private)</li>
            <li>Smart room placement and circulation flow</li>
          </ul>
          <p>Enable JavaScript to use the interactive blueprint designer.</p>
        </div>
      </noscript>
      
      {/* Hidden SEO content for crawlers */}
      <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <h1>OpenBlueprint: Free AI Blueprint Generator for Home Design</h1>
        <p>
          Design professional architectural blueprints and floor plans with our free AI-powered tool. 
          Perfect for homeowners, architects, builders, and construction professionals planning 
          residential projects.
        </p>
        
        <h2>Why Choose OpenBlueprint?</h2>
        <p>
          Unlike traditional CAD software that requires extensive training, OpenBlueprint uses 
          artificial intelligence to generate optimized floor plans in seconds. Our tool handles 
          complex architectural considerations like room adjacencies, circulation flow, natural 
          lighting, and building codes automatically.
        </p>
        
        <h2>Features That Make Design Easy</h2>
        <ul>
          <li><strong>AI Blueprint Generation:</strong> Describe your dream home and watch as our AI creates multiple design options tailored to your requirements</li>
          <li><strong>Interactive 2D Editor:</strong> Customize every detail with drag-and-drop furniture placement, wall editing, and room modifications</li>
          <li><strong>3D Visualization:</strong> See your design come to life with real-time 3D rendering</li>
          <li><strong>Cost Estimator:</strong> Get preliminary construction cost estimates based on your region and design choices</li>
          <li><strong>Professional Exports:</strong> Download publication-ready blueprints in PDF, PNG, or SVG format</li>
          <li><strong>Furniture Library:</strong> Access 45+ furniture items including beds, sofas, tables, kitchen appliances, and bathroom fixtures</li>
          <li><strong>Smart Design Strategies:</strong> Choose from balanced, open-concept, or privacy-focused layouts</li>
        </ul>
        
        <h2>Perfect for Every Project</h2>
        <p>
          Whether you're planning a new home construction, renovation, or simply exploring design 
          ideas, OpenBlueprint provides the tools you need. Our platform serves homeowners dreaming 
          of their ideal home, real estate developers planning residential projects, architects 
          creating preliminary designs, and DIY enthusiasts exploring home improvement options.
        </p>
        
        <h2>How It Works</h2>
        <ol>
          <li><strong>Describe Your Vision:</strong> Enter your requirements including number of bedrooms, bathrooms, total area, and design preferences</li>
          <li><strong>AI Generation:</strong> Our advanced algorithm creates multiple floor plan options optimized for functionality and flow</li>
          <li><strong>Customize & Refine:</strong> Use the interactive editor to adjust walls, add furniture, and perfect every detail</li>
          <li><strong>Visualize in 3D:</strong> Switch to 3D view to see exactly how your space will look and feel</li>
          <li><strong>Export & Share:</strong> Download professional blueprints ready for contractors, permits, or presentations</li>
        </ol>
        
        <h2>Advanced Architectural Features</h2>
        <p>
          OpenBlueprint incorporates sophisticated architectural principles including proper room 
          adjacencies (kitchen near dining, bedrooms away from noise), efficient circulation patterns, 
          optimal natural lighting placement, building code compliance checks, and structural 
          considerations for load-bearing walls.
        </p>
        
        <h2>Free Forever</h2>
        <p>
          OpenBlueprint is completely free to use with no hidden costs, subscriptions, or limited 
          trials. Create unlimited floor plans, export as many blueprints as you need, and access 
          all features without any restrictions.
        </p>
        
        <h2>Get Started Today</h2>
        <p>
          Start designing your dream home with OpenBlueprint's AI-powered blueprint generator. 
          No account required, no software to install, and no architectural experience necessary. 
          Join thousands of users creating professional floor plans in minutes.
        </p>
        
        <h2>Frequently Asked Questions</h2>
        <dl>
          <dt>Is OpenBlueprint really free?</dt>
          <dd>Yes, OpenBlueprint is 100% free with no limitations on features or exports.</dd>
          
          <dt>Do I need architectural experience?</dt>
          <dd>No, our AI handles the complex architectural decisions while you focus on your preferences.</dd>
          
          <dt>Can I use these blueprints for actual construction?</dt>
          <dd>Our blueprints are perfect for preliminary planning. For construction, you'll need a licensed architect or engineer to create final stamped drawings.</dd>
          
          <dt>What file formats can I export?</dt>
          <dd>Export your designs as PDF for printing, PNG for presentations, or SVG for further editing.</dd>
          
          <dt>How accurate is the cost estimator?</dt>
          <dd>Cost estimates are preliminary and based on regional averages. Actual construction costs vary by location, materials, and contractor.</dd>
        </dl>
      </div>
      
      {/* Client-side application */}
      <AppRouter />
    </>
  );
}
