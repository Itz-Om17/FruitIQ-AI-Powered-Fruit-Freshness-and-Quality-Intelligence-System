/**
 * FreshTrack AI — FruitBot Conversational Engine (Powered by Groq LLM & Live Database RAG)
 * Combines real-time MongoDB inventory batches, spoilage logs, and shelf-life metrics
 * with Groq LLM (openai/gpt-oss-120b) to provide warehouse dispatch answers and
 * agronomic advice on expanding produce shelf life.
 */
const Batch = require('../models/Batch');
const Inspection = require('../models/Inspection');
const StockMovement = require('../models/StockMovement');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

/**
 * Helper to call Groq completions API with primary and fallback models
 */
async function callGroqLLM(systemPrompt, userQuery) {
  const modelsToTry = [GROQ_MODEL, 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'].filter((v, i, a) => a.indexOf(v) === i);

  for (const model of modelsToTry) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
          ],
          temperature: 0.25,
          max_tokens: 850
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        const errText = await res.text();
        console.warn(`Groq (${model}) returned non-200:`, errText);
      }
    } catch (err) {
      console.warn(`Groq (${model}) call failed:`, err.message);
    }
  }
  return null;
}

/**
 * POST /api/chatbot/query
 */
exports.askFruitBot = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const query = message.trim();

    // 1. Retrieve live inventory data for RAG context
    const [activeBatches, recentInspections, spoiledMovements] = await Promise.all([
      Batch.find({ user: userId, status: { $in: ['active', 'low_stock'] } }).sort({ 'priority.score': -1 }),
      Inspection.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
      StockMovement.find({ user: userId, type: 'spoiled' }).sort({ createdAt: -1 }).limit(10)
    ]);

    // Format live batches summary for LLM prompt context
    const inventoryContext = activeBatches.map(b => ({
      batch_code: b.batch_code,
      fruit_type: b.fruit_type,
      quantity_remaining: `${b.remaining_quantity !== undefined ? b.remaining_quantity : b.quantity} ${b.unit}`,
      freshness_state: b.freshness?.state || 'NOT_INSPECTED',
      freshness_score_pct: b.freshness?.avg_freshness_pct ?? 'N/A',
      remaining_shelf_life_days: b.remaining_shelf_life_days ?? 'N/A',
      storage_location: b.storage_location || 'Warehouse',
      storage_conditions: b.storage_conditions || {},
      priority_level: b.priority?.level || 'normal',
      priority_reason: b.priority?.reason || ''
    }));

    const totalSpoiled = activeBatches.reduce((acc, b) => acc + (b.spoiled_quantity || 0), 0);

    const systemPrompt = `You are "FruitBot", an expert Produce Quality, Shelf-Life & Warehouse Inventory Intelligence AI assistant for FreshTrack AI.
You have real-time access to the user's active produce inventory batches, inspection records, and spoilage logs:

--- LIVE INVENTORY CONTEXT (DATABASE) ---
Total Active Batches: ${activeBatches.length}
Total Recorded Spoilage: ${totalSpoiled} units
Recent Batches in Storage:
${JSON.stringify(inventoryContext, null, 2)}
Recent Inspections: ${recentInspections.length} recorded
----------------------------------------

GUIDELINES FOR YOUR RESPONSE:
1. Always base inventory details (quantities, batch codes, days left, urgency) strictly on the live database records above.
2. EXPANDING & EXTENDING SHELF LIFE: Whenever the user asks about fruit freshness, shelf life, or how to store produce, provide concrete, actionable agronomic measures to maximize longevity:
   - Temperature Zones: Cold storage (0°C to 4°C) for temperate fruits (Apples, Pears) vs. Chilling-Sensitive storage (12°C to 14°C) for tropical fruits (Bananas, Mangoes). Mention that refrigerating bananas causes chilling injury and skin browning!
   - Relative Humidity (RH): Maintain 90-95% RH to prevent water loss and shriveling, while ensuring adequate ventilation so standing condensation doesn't form.
   - Ethylene Gas Management: High ethylene producers (ripe Apples, Bananas) MUST be physically separated from ethylene-sensitive items (Citrus, Greens, Kiwis) to stop premature ripening and rotting.
   - Airflow & Sanitation: Maintain clean crates, ensure cross-ventilation, and immediately cull/quarantine any bruised or softening items to prevent mold (e.g. Botrytis, Penicillium) from spreading to adjacent healthy fruit.
   - Packaging / MAP: Mention Modified Atmosphere Packaging (micro-perforated liners) or post-harvest edible coatings where applicable.
3. First-Expired, First-Out (FEFO): Recommend dispatching batches with the fewest remaining days or lowest freshness scores first.
4. Formatting: Keep your reply friendly, concise, and formatted with markdown bullet points and bold batch identifiers.`;

    let actionSuggestions = [];
    let relatedBatches = [];

    // Call Groq LLM API with 20B/120B fallback
    let reply = await callGroqLLM(systemPrompt, query);

    // Dynamic suggested quick prompts based on query
    const qLower = query.toLowerCase();
    if (qLower.includes('urgent') || qLower.includes('attention')) {
      actionSuggestions = ["What should I sell first?", "How to extend apple shelf life?", "Check inventory totals"];
      relatedBatches = activeBatches.filter(b => b.priority?.level === 'urgent' || b.priority?.level === 'sell_first').slice(0, 3);
    } else if (qLower.includes('sell') || qLower.includes('dispatch') || qLower.includes('fefo')) {
      actionSuggestions = ["What batches need urgent attention?", "Storage tips to expand shelf life", "Show batches expiring soon"];
      relatedBatches = activeBatches.filter(b => b.priority?.level === 'sell_first').slice(0, 3);
    } else if (qLower.includes('extend') || qLower.includes('shelf life') || qLower.includes('temperature')) {
      actionSuggestions = ["What should I sell first?", "What batches need urgent attention?", "Run new scan"];
    } else {
      actionSuggestions = [
        "What batches need urgent attention?",
        "What should I sell first?",
        "How do I extend banana & apple shelf life?",
        "Show batches expiring soon"
      ];
    }

    // Fallback if LLM was unavailable
    if (!reply) {
      reply = `👋 **FruitBot:** You currently have **${activeBatches.length} active batch(es)** in storage. ` +
        `To extend produce shelf life, maintain optimal cold chain (4°C for apples/citrus, 12-14°C for bananas/tropicals), ensure proper air circulation, and separate high-ethylene producers like ripe apples and bananas from sensitive stock.`;
    }

    res.json({
      reply,
      actionSuggestions,
      relatedBatches
    });
  } catch (err) {
    next(err);
  }
};
