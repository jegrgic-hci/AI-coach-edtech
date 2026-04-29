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

  // Relationship overlap (with normalized relationship types)
  // Groups similar types: "causes", "produces", "creates" → "causes"
  const aiEdges = new Set(aiGraph.relationships.map(r =>
    `${r.from.toLowerCase()}→${r.to.toLowerCase()}:${normalizeRelationType(r.type)}`
  ));
  const essayEdges = new Set(essayGraph.relationships.map(r =>
    `${r.from.toLowerCase()}→${r.to.toLowerCase()}:${normalizeRelationType(r.type)}`
  ));

  const sharedEdges = new Set([...aiEdges].filter(e => essayEdges.has(e)));
  const relationshipOverlap = sharedEdges.size / Math.max(aiEdges.size, essayEdges.size) || 0;

  // New relationships in essay (keyed by nodes, any type difference is new)
  const newRelationships = [...essayEdges].filter(e => !aiEdges.has(e));

  return {
    conceptOverlap: Math.round(conceptOverlap * 100),
    relationshipOverlap: Math.round(relationshipOverlap * 100),
    sharedConcepts: [...shared].length,
    totalConcepts: Math.max(aiEntities.size, essayEntities.size),
    newConcepts,
    newRelationships,
    aiEntityCount: aiEntities.size,
    essayEntityCount: essayEntities.size,
    aiEdgeCount: aiEdges.size,
    essayEdgeCount: essayEdges.size,
    sharedEdgeCount: sharedEdges.size,
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

  // 5. CRITICAL ENGAGEMENT LEVEL
  let criticalEngagement = 'LOW';
  let engagementSignals = [];

  if (contradictions.length > 0) {
    engagementSignals.push(`${contradictions.length} relationship changes (reframing)`);
    if (contradictions.some(c => c.type === 'contradiction')) {
      engagementSignals.push('explicit contradictions detected');
      criticalEngagement = 'STRONG';
    } else {
      criticalEngagement = 'MODERATE';
    }
  }

  if (newSynthesisEdges.length > 2) {
    engagementSignals.push(`${newSynthesisEdges.length} novel concept connections`);
    if (criticalEngagement === 'LOW') criticalEngagement = 'MODERATE';
    if (newSynthesisEdges.length > 3) criticalEngagement = 'STRONG';
  }

  if (comparison.newConcepts.length > comparison.totalConcepts * 0.3) {
    engagementSignals.push('significant new concepts introduced');
    if (criticalEngagement === 'LOW') criticalEngagement = 'MODERATE';
  }

  if (comparison.conceptOverlap < 30 && comparison.relationshipOverlap > 0) {
    engagementSignals.push('AI concepts used selectively');
  }

  return {
    synthesisRatio,
    evidenceScore,
    contradictions,
    newSynthesisEdges,
    criticalEngagement,
    engagementSignals: engagementSignals.length > 0 ? engagementSignals : ['limited transformation detected'],
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
  console.log(`Concept Overlap: ${comparison.conceptOverlap}% (${comparison.sharedConcepts}/${comparison.totalConcepts})`);
  console.log(`Relationship Overlap: ${comparison.relationshipOverlap}% (${comparison.sharedEdgeCount}/${Math.max(comparison.aiEdgeCount, comparison.essayEdgeCount)})`);

  if (comparison.newConcepts.length > 0) {
    console.log(`\n✨ New Concepts in Essay (${comparison.newConcepts.length}):`);
    comparison.newConcepts.slice(0, 10).forEach(c => console.log(`  • ${c}`));
    if (comparison.newConcepts.length > 10) {
      console.log(`  ... and ${comparison.newConcepts.length - 10} more`);
    }
  }

  if (comparison.newRelationships.length > 0) {
    console.log(`\n✨ New Relationships in Essay (${comparison.newRelationships.length}):`);
    comparison.newRelationships.slice(0, 5).forEach(r => console.log(`  • ${r}`));
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
  console.log('\n🔬 TRANSFORMATION ANALYSIS (Critical Thinking with AI)');
  console.log('─'.repeat(60));

  console.log(`\n📊 Synthesis Metrics:`);
  console.log(`  Synthesis Ratio: ${transformation.synthesisRatio}%`);
  console.log(`  └─ Interpretation: ${transformation.synthesisRatio > 40 ? 'Student reorganized AI concepts' : 'Limited reorganization'}`);

  console.log(`\n  Evidence Integration: ${transformation.evidenceScore}`);

  if (comparison.conceptOverlap > 0) {
    console.log(`  Concepts Retained: ${comparison.sharedConcepts}/${comparison.totalConcepts} (${comparison.conceptOverlap}%)`);
  }

  console.log(`\n🔄 Relationship Transformations:`);
  if (transformation.contradictions.length > 0) {
    console.log(`  Found ${transformation.contradictions.length} relationship changes:`);
    transformation.contradictions.slice(0, 5).forEach(c => {
      const arrow = c.type === 'contradiction' ? '↔️ ' : '→ ';
      console.log(`    ${arrow} ${c.edge.split('→')[0]} (AI: ${c.aiType}, Essay: ${c.essayType})`);
    });
    if (transformation.contradictions.length > 5) {
      console.log(`    ... and ${transformation.contradictions.length - 5} more`);
    }
  } else {
    console.log(`  No detected relationship changes (no reorganization)`);
  }

  console.log(`\n✨ New Concept Connections:`);
  if (transformation.newSynthesisEdges.length > 0) {
    console.log(`  ${transformation.newSynthesisEdges.length} novel connections between AI concepts:`);
    transformation.newSynthesisEdges.slice(0, 4).forEach(edge => {
      console.log(`    • ${edge.from} ──[${edge.type}]──> ${edge.to}`);
    });
    if (transformation.newSynthesisEdges.length > 4) {
      console.log(`    ... and ${transformation.newSynthesisEdges.length - 4} more`);
    }
  } else {
    console.log(`  No new concept connections detected`);
  }

  console.log(`\n🎯 Critical Thinking Assessment:`);
  console.log(`  Level: ${transformation.criticalEngagement}`);
  console.log(`  Signals:`);
  transformation.engagementSignals.forEach(signal => {
    console.log(`    ✓ ${signal}`);
  });

  console.log(`\n📋 Summary:`);
  if (transformation.criticalEngagement === 'STRONG') {
    console.log(`  Student engaged critically with AI ideas: reorganized, reframed, or extended them.`);
    console.log(`  AI augmented thinking rather than replaced it.`);
  } else if (transformation.criticalEngagement === 'MODERATE') {
    console.log(`  Student showed some critical engagement: modified AI structure or added new concepts.`);
    console.log(`  Mixed signal: some augmentation, but also some direct usage.`);
  } else {
    console.log(`  Limited critical engagement detected: minimal transformation of AI ideas.`);
    console.log(`  Student may have copied structure or not engaged deeply with AI content.`);
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
