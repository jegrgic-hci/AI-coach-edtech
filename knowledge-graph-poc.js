#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load config and test data
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const testData = JSON.parse(fs.readFileSync('./test-examples-synthetic.json', 'utf8'));

const GROQ_API_KEY = config.groq.apiKey;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ============================================================================
// EXTRACTION PROMPT
// ============================================================================

const extractionPrompt = (text) => `Extract entities (concepts, ideas, claims) and relationships from this text.

Return ONLY valid JSON in this exact format:
{
  "entities": ["entity1", "entity2", "entity3"],
  "relationships": [
    {"from": "entity1", "to": "entity2", "type": "causes"},
    {"from": "entity2", "to": "entity3", "type": "supports"}
  ]
}

Relationship types: causes, supports, contradicts, defines, explains, enables, produces, opposes

Text:
${text}`;

// ============================================================================
// GROQ API CALL
// ============================================================================

async function callGroqLlama(text, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: extractionPrompt(text),
            },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 3000; // 3s, 6s, 12s
        console.log(`⏳ Rate limited. Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();

      // Parse JSON response
      try {
        const graph = JSON.parse(content);
        return graph;
      } catch (parseError) {
        console.error('JSON parse error. Raw content:', content.substring(0, 200));
        throw new Error('Failed to parse LLM response as JSON');
      }
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
    }
  }
}

// ============================================================================
// RELATIONSHIP TYPE NORMALIZATION
// ============================================================================

function normalizeRelationType(type) {
  const lower = type.toLowerCase();
  if (['produces', 'creates', 'causes', 'leads to', 'results in'].includes(lower)) return 'causes';
  if (['enables', 'supports', 'facilitates'].includes(lower)) return 'enables';
  if (['reduces', 'decreases', 'opposes', 'contradicts'].includes(lower)) return 'opposes';
  if (['defines', 'is', 'describes'].includes(lower)) return 'defines';
  if (['influences', 'affects', 'impacts'].includes(lower)) return 'affects';
  return lower;
}

// ============================================================================
// GRAPH COMPARISON
// ============================================================================

function compareGraphs(aiGraph, essayGraph) {
  const aiEntities = new Set(aiGraph.entities.map(e => e.toLowerCase()));
  const essayEntities = new Set(essayGraph.entities.map(e => e.toLowerCase()));

  // Concept overlap
  const shared = new Set([...aiEntities].filter(e => essayEntities.has(e)));
  const conceptOverlap = shared.size / Math.max(aiEntities.size, essayEntities.size) || 0;

  // New concepts in essay
  const newConcepts = [...essayEntities].filter(e => !aiEntities.has(e));

  // Build relationship maps (normalized types)
  const aiRelationships = aiGraph.relationships.map(r => ({
    from: r.from.toLowerCase(),
    to: r.to.toLowerCase(),
    type: normalizeRelationType(r.type),
    original: r,
  }));

  const essayRelationships = essayGraph.relationships.map(r => ({
    from: r.from.toLowerCase(),
    to: r.to.toLowerCase(),
    type: normalizeRelationType(r.type),
    original: r,
  }));

  // Relationship overlap: match on (from, to) pairs, check if type is the same
  let sharedEdgesCount = 0;
  let changedTypeEdges = 0;

  essayRelationships.forEach(essayRel => {
    const aiMatch = aiRelationships.find(
      air => air.from === essayRel.from && air.to === essayRel.to
    );

    if (aiMatch) {
      if (aiMatch.type === essayRel.type) {
        sharedEdgesCount++;
      } else {
        changedTypeEdges++;
      }
    }
  });

  // Relationship overlap: % of AI relationships that appear in essay (same or changed type)
  const relationshipOverlapPct = aiRelationships.length > 0
    ? Math.round(((sharedEdgesCount + changedTypeEdges) / aiRelationships.length) * 100)
    : 0;

  // Type match ratio: of relationships that exist in both, what % have same type
  const existingEdges = sharedEdgesCount + changedTypeEdges;
  const typeMatchRatio = existingEdges > 0
    ? Math.round((sharedEdgesCount / existingEdges) * 100)
    : 100;

  const newRelationships = essayRelationships.filter(
    essayRel => !aiRelationships.some(
      air => air.from === essayRel.from && air.to === essayRel.to
    )
  );

  return {
    conceptOverlap: Math.round(conceptOverlap * 100),
    relationshipOverlap: relationshipOverlapPct,
    typeMatchRatio, // % of existing edges where type is same (high = copied, low = reorganized)
    sharedConcepts: [...shared].length,
    totalConcepts: Math.max(aiEntities.size, essayEntities.size),
    newConcepts,
    newRelationships,
    aiEntityCount: aiEntities.size,
    essayEntityCount: essayEntities.size,
    aiEdgeCount: aiRelationships.length,
    essayEdgeCount: essayRelationships.length,
    sharedEdgeCount: sharedEdgesCount,
    changedTypeEdges,
    existingEdgesInBoth: existingEdges,
  };
}

// ============================================================================
// TRANSFORMATION ANALYSIS
// ============================================================================

function analyzeTransformation(aiGraph, essayGraph, comparison) {
  // 1. SYNTHESIS RATIO: kept concepts but changed relationships
  const synthesisRatio = comparison.conceptOverlap > 0
    ? Math.round((comparison.conceptOverlap / 100) * (1 - (comparison.relationshipOverlap / 100)) * 100)
    : 0;

  // 2. EVIDENCE INTEGRATION: are AI concepts used sparingly as support?
  // High if: concepts present but relationship overlap is low
  const evidenceScore = comparison.conceptOverlap > 30 && comparison.relationshipOverlap < 40
    ? 'HIGH (AI concepts used as evidence)'
    : comparison.conceptOverlap > 60
    ? 'MODERATE (AI ideas are present)'
    : 'LOW (AI concepts not heavily used)';

  // 3. CONTRADICTION DETECTION: look for opposite relationship types
  const aiEdgesNormalized = new Map();
  aiGraph.relationships.forEach(r => {
    const key = `${r.from.toLowerCase()}→${r.to.toLowerCase()}`;
    aiEdgesNormalized.set(key, normalizeRelationType(r.type));
  });

  const essayEdgesNormalized = new Map();
  essayGraph.relationships.forEach(r => {
    const key = `${r.from.toLowerCase()}→${r.to.toLowerCase()}`;
    essayEdgesNormalized.set(key, normalizeRelationType(r.type));
  });

  const contradictions = [];
  const opposites = {
    'causes': ['opposes', 'affects'],
    'enables': ['opposes'],
    'opposes': ['enables', 'causes'],
    'defines': ['opposes'],
  };

  aiEdgesNormalized.forEach((aiType, edge) => {
    if (essayEdgesNormalized.has(edge)) {
      const essayType = essayEdgesNormalized.get(edge);
      if (aiType !== essayType) {
        // Check if they're opposite
        if (opposites[aiType] && opposites[aiType].includes(essayType)) {
          contradictions.push({
            edge,
            aiType,
            essayType,
            type: 'contradiction',
          });
        } else {
          // Different but not opposite - reframing
          contradictions.push({
            edge,
            aiType,
            essayType,
            type: 'reframe',
          });
        }
      }
    }
  });

  // 4. SYNTHESIS DEPTH: new relationships between AI concepts
  const aiConceptsSet = new Set(aiGraph.entities.map(e => e.toLowerCase()));
  const newSynthesisEdges = [];

  essayGraph.relationships.forEach(r => {
    const fromInAI = aiConceptsSet.has(r.from.toLowerCase());
    const toInAI = aiConceptsSet.has(r.to.toLowerCase());

    if (fromInAI && toInAI) {
      // Both concepts from AI
      const aiEdgeKey = `${r.from.toLowerCase()}→${r.to.toLowerCase()}`;
      const aiHasEdge = Array.from(aiEdgesNormalized.keys()).some(key => key === aiEdgeKey);

      if (!aiHasEdge) {
        newSynthesisEdges.push({
          from: r.from,
          to: r.to,
          type: r.type,
          description: 'New connection between AI concepts',
        });
      }
    }
  });

  // 5. CRITICAL ENGAGEMENT LEVEL - based on typeMatchRatio
  // typeMatchRatio = % of matching edges where type is the same
  // High typeMatchRatio (>70%) = copied structure (BAD)
  // Low typeMatchRatio (<40%) = reorganized structure (GOOD)

  const typeMatchRatio = comparison.typeMatchRatio || 0;
  let criticalEngagement = 'UNKNOWN';
  let engagementSignals = [];

  // CASE 1: High concept overlap (student used AI's ideas)
  if (comparison.conceptOverlap >= 60) {
    if (typeMatchRatio >= 70) {
      // High concepts + high type match = COPYING
      criticalEngagement = 'LOW';
      engagementSignals.push(`High concept overlap (${comparison.conceptOverlap}%) with same relationship types (${typeMatchRatio}%) → copied structure`);
    } else if (typeMatchRatio >= 40) {
      // High concepts + medium type match = MIXED
      criticalEngagement = 'MODERATE';
      engagementSignals.push(`High concept overlap (${comparison.conceptOverlap}%) but changed relationships (${typeMatchRatio}% match) → mixed reorganization`);
    } else {
      // High concepts + low type match = REORGANIZATION
      criticalEngagement = 'STRONG';
      engagementSignals.push(`High concept overlap (${comparison.conceptOverlap}%) with significant relationship changes (${typeMatchRatio}% match) → reorganized thinking`);
    }
  }
  // CASE 2: Medium concept overlap
  else if (comparison.conceptOverlap >= 30) {
    if (typeMatchRatio >= 70) {
      criticalEngagement = 'LOW';
      engagementSignals.push('Selective concept usage but kept same structure');
    } else {
      criticalEngagement = 'MODERATE';
      engagementSignals.push('Selective concept usage with some reorganization');
    }
  }
  // CASE 3: Low concept overlap (independent thinking)
  else {
    if (comparison.newConcepts.length > comparison.totalConcepts * 0.4) {
      criticalEngagement = 'STRONG';
      engagementSignals.push(`Built mostly new framework (${comparison.newConcepts.length} new concepts) → independent thinking`);
    } else {
      criticalEngagement = 'MODERATE';
      engagementSignals.push('Low concept reuse → independent or minimal AI engagement');
    }
  }

  return {
    typeMatchRatio,
    criticalEngagement,
    engagementSignals: engagementSignals.length > 0 ? engagementSignals : ['analysis inconclusive'],
  };
}

// ============================================================================
// FORMATTING OUTPUT
// ============================================================================

function formatGraph(graph, label) {
  console.log(`\n📊 ${label} GRAPH`);
  console.log('─'.repeat(60));
  console.log(`\nEntities (${graph.entities.length}):`);
  graph.entities.forEach(e => console.log(`  • ${e}`));

  console.log(`\nRelationships (${graph.relationships.length}):`);
  graph.relationships.forEach(r =>
    console.log(`  • ${r.from} ──[${r.type}]──> ${r.to}`)
  );
}

function formatComparison(comparison) {
  console.log('\n📈 COMPARISON METRICS');
  console.log('─'.repeat(60));
  console.log(`\n🔤 Concept Overlap: ${comparison.conceptOverlap}%`);
  console.log(`   (${comparison.sharedConcepts}/${comparison.totalConcepts} shared concepts)`);

  console.log(`\n🔗 Relationship Analysis:`);
  console.log(`   Relationships that appear in both: ${comparison.relationshipOverlap}%`);
  console.log(`   Type Match Ratio: ${comparison.typeMatchRatio}%`);
  console.log(`   └─ ${comparison.typeMatchRatio > 70 ? '🔴 HIGH (student kept same relationship types → copied structure)' :
                       comparison.typeMatchRatio > 40 ? '🟡 MEDIUM (some relationship changes → mixed engagement)' :
                       '🟢 LOW (changed relationship types → reorganized thinking)'}`);

  if (comparison.existingEdgesInBoth > 0) {
    console.log(`   Matching edges: ${comparison.sharedEdgeCount} same type, ${comparison.changedTypeEdges} changed type (of ${comparison.existingEdgesInBoth} total)`);
  }

  if (comparison.newConcepts.length > 0) {
    console.log(`\n✨ New Concepts in Essay (${comparison.newConcepts.length}):`);
    comparison.newConcepts.slice(0, 10).forEach(c => console.log(`  • ${c}`));
    if (comparison.newConcepts.length > 10) {
      console.log(`  ... and ${comparison.newConcepts.length - 10} more`);
    }
  }

  if (comparison.newRelationships.length > 0) {
    console.log(`\n✨ New Relationships in Essay (${comparison.newRelationships.length}):`);
    comparison.newRelationships.slice(0, 5).forEach(r => {
      const rel = r;
      console.log(`  • ${rel.from}→${rel.to} (${rel.type})`);
    });
    if (comparison.newRelationships.length > 5) {
      console.log(`  ... and ${comparison.newRelationships.length - 5} more`);
    }
  }
}

function formatNarrative(comparison, level) {
  console.log('\n💡 TRADITIONAL OVERLAP ANALYSIS');
  console.log('─'.repeat(60));

  const conceptOverlap = comparison.conceptOverlap;
  const relationshipOverlap = comparison.relationshipOverlap;
  const avgOverlap = (conceptOverlap + relationshipOverlap) / 2;

  let dependency = '';
  let reasoning = '';

  if (avgOverlap >= 85) {
    dependency = 'HIGH DEPENDENCY';
    reasoning = 'Essay structure mirrors AI conversation closely.';
  } else if (avgOverlap >= 60) {
    dependency = 'MODERATE DEPENDENCY';
    reasoning = 'Essay uses AI concepts but reorganizes relationships.';
  } else if (avgOverlap >= 40) {
    dependency = 'LOW DEPENDENCY';
    reasoning = 'Essay introduces significant new structure and thinking.';
  } else {
    dependency = 'INDEPENDENT THINKING';
    reasoning = 'Essay builds own framework; AI used as reference.';
  }

  console.log(`Signal: ${dependency}`);
  console.log(`Reasoning: ${reasoning}`);
  console.log(`New Ideas: ${comparison.newConcepts.length} new concepts, ${comparison.newRelationships.length} new relationships`);
}

function formatTransformationAnalysis(transformation, comparison) {
  console.log('\n🔬 CRITICAL THINKING ANALYSIS (Graph-Based)');
  console.log('─'.repeat(60));

  console.log(`\n📊 Metrics:`);
  console.log(`  Concept Overlap: ${comparison.conceptOverlap}%`);
  console.log(`  Type Match Ratio: ${transformation.typeMatchRatio}%`);
  console.log(`  └─ ${transformation.typeMatchRatio >= 70 ? '🔴 HIGH: kept same types (copied)' :
                       transformation.typeMatchRatio >= 40 ? '🟡 MEDIUM: some changes' :
                       '🟢 LOW: changed types significantly (reorganized)'}`);

  console.log(`\n🎯 Critical Thinking Level: ${transformation.criticalEngagement}`);
  console.log(`  Evidence:`);
  transformation.engagementSignals.forEach(signal => {
    console.log(`    • ${signal}`);
  });

  console.log(`\n📋 Interpretation:`);
  if (transformation.criticalEngagement === 'STRONG') {
    console.log(`  ✅ Strong critical thinking. Student engaged deeply:`);
    if (comparison.conceptOverlap >= 60) {
      console.log(`     - Took AI's concepts but reorganized relationships significantly`);
    } else {
      console.log(`     - Built mostly independent thinking`);
    }
  } else if (transformation.criticalEngagement === 'MODERATE') {
    console.log(`  🟡 Moderate critical thinking. Some engagement detected.`);
  } else {
    console.log(`  ⚠️  Limited critical thinking. Minimal transformation.`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔬 KNOWLEDGE GRAPH POC - ANALYSIS\n');
  console.log('═'.repeat(60));

  for (const example of testData.examples) {
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log(`EXAMPLE: ${example.level} - ${example.title}`);
    console.log(`Student: ${example.student}`);
    console.log('═'.repeat(60));

    try {
      console.log('\n⏳ Extracting AI conversation graph...');
      const aiGraph = await callGroqLlama(example.conversation);
      formatGraph(aiGraph, 'AI CONVERSATION');

      console.log('\n⏳ Extracting essay graph...');
      const essayGraph = await callGroqLlama(example.essay);
      formatGraph(essayGraph, 'ESSAY');

      console.log('\n⏳ Comparing graphs...');
      const comparison = compareGraphs(aiGraph, essayGraph);
      formatComparison(comparison);
      formatNarrative(comparison, example.level);

      console.log('\n⏳ Analyzing transformation patterns...');
      const transformation = analyzeTransformation(aiGraph, essayGraph, comparison);
      formatTransformationAnalysis(transformation, comparison);
    } catch (error) {
      console.error(`\n❌ Error processing ${example.title}:`, error.message);
    }

    // Add a small delay between examples to be respectful to API
    if (testData.examples.indexOf(example) < testData.examples.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('✨ Analysis complete!');
  console.log('═'.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
