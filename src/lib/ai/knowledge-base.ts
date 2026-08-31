import ZAI from 'z-ai-web-dev-sdk';
import { KnowledgeAnswer } from '../types';

// Curated architectural / construction knowledge base
interface KBEntry {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
  source: string;
}

export const KNOWLEDGE_BASE: KBEntry[] = [
  {
    id: 'kb-bedroom',
    topic: 'Bedroom Planning',
    keywords: ['bedroom', 'master bedroom', 'bed room', 'sleeping', 'private room'],
    content:
      'A good bedroom balances comfort, privacy, storage, and natural light. Recommended minimum sizes: master bedroom 12\' x 14\' (168 sq.ft), standard bedroom 10\' x 12\' (120 sq.ft), kids bedroom 9\' x 10\' (90 sq.ft). Place bedrooms on quieter sides of the plot, ideally with morning sun from the east. Provide at least one window for cross-ventilation and a door that does not open directly into the living area. Allow clearance for a bed (5\' x 6.5\' typical), wardrobe (2\' deep), and 3\' circulation around the bed. An attached en-suite improves convenience for the master bedroom.',
    source: 'OpenBlueprint Knowledge Base — Residential Planning Guidelines',
  },
  {
    id: 'kb-kitchen',
    topic: 'Kitchen Layout',
    keywords: ['kitchen', 'cooking', 'counter', 'modular kitchen'],
    content:
      'An efficient kitchen follows the work triangle: sink → cooktop → refrigerator, with each leg between 4\' and 9\' and the total between 12\' and 26\'. Common layouts are L-shape, U-shape, parallel (galley), and straight. Minimum kitchen size is 8\' x 8\'; preferred is 10\' x 10\'. Provide a window near the sink for ventilation and light. Keep the kitchen adjacent to the dining area for easy serving. Allow 2\'-2.5\' deep counters, a 3\' gap between opposing counters in a parallel kitchen, and at least 3\' of circulation. Include dedicated counters for prep, cooking, and plating.',
    source: 'OpenBlueprint Knowledge Base — Kitchen Design Principles',
  },
  {
    id: 'kb-cost',
    topic: 'Construction Cost Factors',
    keywords: ['cost', 'budget', 'price', 'estimate', 'expense', 'lakh', 'rupee'],
    content:
      'Construction cost depends on built-up area, location, material grade, finishes, structural complexity, and labor rates. Indicative rates (India, 2024): Basic ₹1,500/sq.ft, Standard ₹1,800/sq.ft, Premium ₹2,300/sq.ft, Luxury ₹3,000+/sq.ft. The breakdown is roughly: Foundation 10%, Structure 27%, Flooring 12%, Electrical 8%, Plumbing 8%, Doors & Windows 12%, Painting 8%, Other 15%. Costs rise with premium flooring (marble, wood), modular kitchens, smart-home systems, and complex facades. Always add a 10-15% contingency. These are preliminary estimates — actual costs require a quantity surveyor.',
    source: 'OpenBlueprint Knowledge Base — Cost Estimation',
  },
  {
    id: 'kb-builtup',
    topic: 'Built-up Area',
    keywords: ['built up', 'built-up', 'builtup', 'area', 'carpet', 'super built-up', 'fsi', 'far'],
    content:
      'Built-up area is the total covered area of all floors, including walls, balconies, and utility shafts. Carpet area is the usable internal floor area (typically 70% of built-up). Super built-up adds a proportionate share of common areas (lobby, lift, stair) — relevant for apartments. Plot area is the land area itself. Floor Space Index (FSI) / Floor Area Ratio (FAR) is the ratio of total built-up area to plot area and is regulated by local planning authorities. Setbacks (mandatory open spaces around the building) also limit buildable area. Always check local zoning bylaws for permitted FSI, setbacks, and height limits before finalizing a plan.',
    source: 'OpenBlueprint Knowledge Base — Area Definitions',
  },
  {
    id: 'kb-ventilation',
    topic: 'Ventilation & Lighting',
    keywords: ['ventilation', 'natural light', 'window', 'air', 'cross ventilation', 'light'],
    content:
      'Natural ventilation relies on cross-ventilation: openings on two opposite walls let air flow through. Aim for window area equal to at least 15-20% of the floor area of each habitable room. Place larger windows on the south and north for balanced daylight; east-facing windows give morning light, west-facing windows need shading from afternoon heat. Use stack ventilation (warm air rising out through high vents) for hot climates. Avoid deep, narrow rooms with only one window. Courtyards and light wells bring light and air into interior rooms.',
    source: 'OpenBlueprint Knowledge Base — Environmental Design',
  },
  {
    id: 'kb-vastu',
    topic: 'Vastu Shastra (Cultural Preference)',
    keywords: ['vastu', 'shastra', 'direction', 'entrance', 'pooja', 'cultural'],
    content:
      'Vastu Shastra is a traditional Indian system of architectural guidelines based on directional alignment. Common preferences: entrance on north or east, kitchen in the southeast (Agni), master bedroom in the southwest, pooja room in the northeast, and bathrooms avoiding the northeast. These are cultural and traditional preferences, not structural or engineering requirements. OpenBlueprint treats Vastu as an optional design preference. Always prioritize structural safety, local building codes, and functional planning. A qualified architect can harmonize Vastu preferences with modern engineering.',
    source: 'OpenBlueprint Knowledge Base — Cultural Design Preferences',
  },
  {
    id: 'kb-setback',
    topic: 'Setbacks & Regulations',
    keywords: ['setback', 'regulation', 'bylaw', 'code', 'permission', 'approval', 'zoning'],
    content:
      'Setbacks are mandatory open spaces between the building and the plot boundary, regulated by local planning authorities. Typical residential setbacks: front 10-15% of plot depth, rear 10%, sides 3-5% each, but rules vary by city, plot size, and road width. Setbacks ensure light, ventilation, fire safety, and future road widening. Floor Space Index (FSI) limits total buildable area. Height limits depend on road width and zone. Building permits require approved drawings from a registered architect/engineer and clearance from the local municipal authority. Never finalize a design without verifying the applicable local regulations — OpenBlueprint plans are preliminary and not regulatory drawings.',
    source: 'OpenBlueprint Knowledge Base — Regulatory Context',
  },
  {
    id: 'kb-staircase',
    topic: 'Staircase Design',
    keywords: ['stair', 'staircase', 'steps', 'spiral', 'rise', 'tread'],
    content:
      'A comfortable residential staircase has a tread of 10-12" and a riser of 6-7", with the rule of thumb: 2×riser + tread = 24-25". Minimum width is 3\' for single-family homes, 3.5\' preferred. Provide a minimum headroom of 6\'8" (2m). A standard flight has 10-12 steps; longer runs need a landing. Place the staircase centrally for balanced access to all rooms, or along a side wall to free up interior space. Ensure continuity across floors and a safe handrail on at least one side. For small plots, L-shaped or U-shaped stairs save space; spiral stairs suit tight spots but reduce furniture movement.',
    source: 'OpenBlueprint Knowledge Base — Vertical Circulation',
  },
  {
    id: 'kb-parking',
    topic: 'Parking Planning',
    keywords: ['parking', 'car', 'garage', 'porch', 'vehicle'],
    content:
      'A single car parking space needs about 9\' x 18\' (162 sq.ft); two cars need 18\' x 18\' or 9\' x 36\'. Provide a 10\' wide opening for entry/exit. Open parking in the front setback is common and often mandatory. Covered garages add cost but protect vehicles. Keep parking close to the entrance and the kitchen/utility for grocery unloading. Slope the parking surface slightly toward a drain. Verify local bylaws — many cities mandate one or two covered parking spaces per dwelling unit.',
    source: 'OpenBlueprint Knowledge Base — Parking Standards',
  },
  {
    id: 'kb-living',
    topic: 'Living & Dining',
    keywords: ['living', 'dining', 'hall', 'family', 'lounge'],
    content:
      'The living room is the social heart of the home. Recommended minimum: 12\' x 14\' for small homes, 14\' x 16\' or larger for 3+ bedroom homes. Position the living room near the entrance for guest flow and connect it to the dining area. Dining needs 10\' x 12\' for a 6-seater table with circulation. Open-plan living-dining feels larger but needs acoustic planning. Provide at least two windows on different walls for cross-ventilation. Orient the living room to catch evening light or a pleasant view where possible.',
    source: 'OpenBlueprint Knowledge Base — Public Spaces',
  },
];

function scoreEntry(query: string, entry: KBEntry): number {
  const q = query.toLowerCase();
  let score = 0;
  for (const k of entry.keywords) {
    if (q.includes(k)) score += 3;
  }
  // topic words
  const topicWords = entry.topic.toLowerCase().split(/[^a-z]+/);
  for (const w of topicWords) {
    if (w.length > 3 && q.includes(w)) score += 2;
  }
  // content word overlap
  const contentWords = entry.content.toLowerCase();
  const queryWords = q.split(/[^a-z]+/).filter((w) => w.length > 3);
  for (const w of queryWords) {
    if (contentWords.includes(w)) score += 1;
  }
  return score;
}

export function retrieveRelevant(query: string, limit = 3): KBEntry[] {
  const scored = KNOWLEDGE_BASE.map((e) => ({ e, s: scoreEntry(query, e) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.filter((x) => x.s > 0).slice(0, limit).map((x) => x.e);
}

export async function answerKnowledgeQuestion(question: string): Promise<KnowledgeAnswer> {
  const relevant = retrieveRelevant(question, 3);
  const context = relevant
    .map((e) => `### ${e.topic}\n${e.content}\nSource: ${e.source}`)
    .join('\n\n');

  const systemPrompt = `You are "Ask OpenBlueprint", an architectural and construction knowledge assistant.
Use the provided curated knowledge context to answer the user's question accurately and concisely.
If the context does not cover the question, use general architectural knowledge but clearly state that the answer is general guidance, not from the curated base.
Always include a reminder that OpenBlueprint plans are preliminary and not a substitute for professional advice or regulatory drawings.
Keep answers focused, practical, and 3-6 sentences. Use plain text (no markdown headers).`;

  const userContent = `Curated knowledge context:
${context || '(no directly relevant entries — answer from general architectural knowledge and label it as such.)'}

User question: ${question}`;

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      thinking: { type: 'disabled' },
    });
    const answer = completion.choices[0]?.message?.content || 'I could not retrieve an answer right now.';
    return {
      question,
      answer,
      sources: relevant.map((e) => e.source),
    };
  } catch {
    // Fallback: return the most relevant curated entry directly
    if (relevant.length > 0) {
      return {
        question,
        answer: relevant[0].content + '\n\nNote: OpenBlueprint plans are preliminary and not a substitute for professional advice or regulatory drawings.',
        sources: relevant.map((e) => e.source),
      };
    }
    return {
      question,
      answer: 'I could not retrieve an answer right now. Please try rephrasing your question.',
      sources: [],
    };
  }
}
