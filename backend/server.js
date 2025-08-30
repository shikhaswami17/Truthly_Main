const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Python service configuration
const PYTHON_SERVICE_URL = 'http://localhost:5001';

// RSS Parser
const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'pubDate', 'description']
  }
});

// Trusted RSS Feeds
const TRUSTED_FEEDS = {
  "BBC World": "http://feeds.bbci.co.uk/news/world/rss.xml",
  "BBC India": "http://feeds.bbci.co.uk/news/world/asia/india/rss.xml", 
  "Reuters": "https://feeds.reuters.com/reuters/topNews",
  "The Hindu": "https://www.thehindu.com/feeder/default.rss",
  "Indian Express": "https://indianexpress.com/section/india/feed/",
  "Times of India": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
  "NDTV": "https://feeds.feedburner.com/ndtvnews-top-stories",
  "Al Jazeera": "https://www.aljazeera.com/xml/rss/all.xml",
  "Associated Press": "https://feeds.apnews.com/rss/apf-topnews",
  "CNN": "http://rss.cnn.com/rss/edition.rss"
};

// Helper function to extract domain
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

// Enhanced text extraction for RSS articles
async function extractTextFromUrl(url) {
  try {
    console.log(`📖 Extracting content from: ${url}`);
    
    // Validate URL first
    if (!url || url === '#' || url.length < 10) {
      throw new Error('Invalid URL provided');
    }
    
    try {
      new URL(url); // Test if URL is valid
    } catch (urlError) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      timeout: 10000,
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share, .comments, .related-articles, .sidebar, noscript, iframe').remove();
    $('.ad, .advertisement, .promo, .newsletter, .subscription, .social, .share, .menu, .navigation, .trending, .recommended').remove();

    // Extract title
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                $('h1').first().text() ||
                'No title available';

    // Clean title
    title = title.replace(/\s*[\|\-\–]\s*.*$/g, '').trim().substring(0, 200);

    // Enhanced content selectors
    const contentSelectors = [
      'article .content, article .body, article .text',
      '.article-body, .article-content, .article-text',
      '.story-content, .story-body, .story-text',
      '.post-content, .post-body, .post-text',
      '.entry-content, .entry-body',
      '[data-module="ArticleBody"]',
      'main article, main .content',
      '.content .text, .main-content',
      'article', '.content', 'main'
    ];

    let content = '';
    let extractedWith = 'none';

    for (const selector of contentSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        let candidateContent = '';
        elements.each((i, el) => {
          candidateContent += $(el).text() + ' ';
        });
        candidateContent = candidateContent.trim();
        if (candidateContent.length > 150) {
          content = candidateContent;
          extractedWith = selector;
          break;
        }
      }
    }

    // Fallback extraction
    if (!content || content.length < 150) {
      const paragraphs = $('body p').map((i, el) => {
        const text = $(el).text().trim();
        return text.length > 30 ? text : null;
      }).get().filter(Boolean);

      if (paragraphs.length > 0) {
        content = paragraphs.join(' ');
        extractedWith = 'body paragraphs';
      } else {
        content = $('body').text();
        extractedWith = 'body fallback';
      }
    }

    // Clean content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .trim()
      .substring(0, 3000);

    const wordCount = content.split(' ').filter(word => word.length > 2).length;
    const hasSubstantialContent = content.length > 100 && wordCount > 20;

    if (!hasSubstantialContent) {
      throw new Error(`Insufficient content extracted (${wordCount} words, ${content.length} chars)`);
    }

    console.log(`✅ Extracted: Title="${title.substring(0, 50)}...", Content=${content.length} chars, Words=${wordCount}, Method=${extractedWith}`);

    return {
      title: title,
      content: content,
      source: 'url',
      extractedLength: content.length,
      wordCount: wordCount,
      extractedWith: extractedWith
    };

  } catch (error) {
    console.error('Text extraction error:', error.message);
    throw new Error(`Failed to extract text from URL: ${error.message}`);
  }
}

// Fetch and parse RSS feeds
async function fetchRSSFeed(feedUrl, sourceName) {
  try {
    console.log(`📡 Fetching ${sourceName} RSS feed...`);
    
    const response = await axios.get(feedUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TruthlyBot/1.0)'
      }
    });

    const feed = await parser.parseString(response.data);
    
    const articles = feed.items.slice(0, 10).map(item => ({
      title: item.title || 'No title',
      url: item.link || item.guid || '',
      snippet: item.contentSnippet || item.description || item.summary || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: sourceName,
      domain: extractDomain(item.link || '')
    }));

    console.log(`✅ ${sourceName}: Found ${articles.length} articles`);
    return articles;

  } catch (error) {
    console.warn(`⚠️ Failed to fetch ${sourceName} RSS: ${error.message}`);
    return [];
  }
}

// Topic search endpoint - FIXED VERSION
app.post('/api/search-topic', async (req, res) => {
  try {
    const { topic, maxResults = 10, minConfidence = 70 } = req.body;
    
    if (!topic || topic.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Topic must be at least 3 characters long'
      });
    }

    console.log(`🔍 TRUSTED NEWS AGGREGATOR: Searching for "${topic}" in RSS feeds`);

    // Fetch all RSS feeds in parallel
    const feedPromises = Object.entries(TRUSTED_FEEDS).map(([name, url]) => 
      fetchRSSFeed(url, name)
    );

    const allFeeds = await Promise.all(feedPromises);
    const allArticles = allFeeds.flat();

    console.log(`📰 Total articles fetched: ${allArticles.length}`);

    // Filter articles by topic
    const topicLower = topic.toLowerCase();
    const relevantArticles = allArticles.filter(article => {
      const titleMatch = article.title.toLowerCase().includes(topicLower);
      const snippetMatch = article.snippet.toLowerCase().includes(topicLower);
      return titleMatch || snippetMatch;
    });

    console.log(`🎯 Relevant articles found: ${relevantArticles.length}`);

    // Analyze each relevant article - FIXED LOGIC
    const analysisPromises = relevantArticles.slice(0, maxResults * 2).map(async (article, index) => {
      try {
        console.log(`🔬 Analyzing ${index + 1}/${Math.min(relevantArticles.length, maxResults * 2)}: ${article.title.substring(0, 60)}...`);

        let analysisResult = null;
        
        // PRIORITY 1: Try full URL extraction if we have a valid URL
        if (article.url && article.url.length > 10 && article.url.startsWith('http')) {
          try {
            console.log(`🌐 Attempting URL extraction for: ${article.url}`);
            const extracted = await extractTextFromUrl(article.url);
            
            // Analyze with full extracted content
            const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze`, {
              title: extracted.title,
              content: extracted.content
            }, { timeout: 20000 });

            if (pythonResponse.data.success) {
              const analysis = pythonResponse.data.analysis;
              
              analysisResult = {
                id: `rss_full_${Date.now()}_${index}`,
                title: extracted.title,
                url: article.url,
                source: article.source,
                domain: article.domain,
                snippet: extracted.content.substring(0, 200) + '...',
                publishedDate: article.pubDate,
                analysis: {
                  label: analysis.label,
                  confidence: analysis.confidence,
                  summary: analysis.summary,
                  reasoning: analysis.reasoning,
                  isTrusted: analysis.label === 'Trustworthy' || analysis.label === 'Real',
                  trustScore: analysis.confidence,
                  modelUsed: analysis.model || 'Full-Content-Analysis'
                },
                sourceCredibility: {
                  domain: article.domain,
                  isTrustedDomain: true,
                  credibilityScore: 95
                },
                extractedContent: extracted.content.substring(0, 500),
                analysisMode: 'rss_full',
                wordCount: extracted.wordCount || 0
              };
              
              console.log(`✅ Full URL analysis successful for: ${article.title.substring(0, 50)}`);
            }
          } catch (urlError) {
            console.warn(`⚠️ URL extraction failed: ${urlError.message}`);
          }
        }

        // PRIORITY 2: Fallback to snippet-only analysis
        if (!analysisResult) {
          const textContent = `${article.title}. ${article.snippet}`.trim();
          
          if (textContent.length >= 20) {
            console.log(`📝 Using snippet analysis for: ${article.title.substring(0, 50)}`);
            
            const directResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze`, {
              title: article.title,
              content: textContent
            }, { timeout: 15000 });

            if (directResponse.data.success) {
              const analysis = directResponse.data.analysis;
              
              analysisResult = {
                id: `rss_snippet_${Date.now()}_${index}`,
                title: article.title,
                url: article.url || '#',
                source: article.source,
                domain: article.domain,
                snippet: article.snippet,
                publishedDate: article.pubDate,
                analysis: {
                  label: analysis.label,
                  confidence: Math.round(analysis.confidence * 0.9), // Slight reduction for snippet-only
                  summary: analysis.summary,
                  reasoning: `RSS snippet analysis: ${analysis.reasoning}`,
                  isTrusted: analysis.label === 'Trustworthy' || analysis.label === 'Real',
                  trustScore: Math.round(analysis.confidence * 0.9),
                  modelUsed: 'RSS-Snippet-Analysis'
                },
                sourceCredibility: {
                  domain: article.domain,
                  isTrustedDomain: true,
                  credibilityScore: 90
                },
                extractedContent: textContent,
                analysisMode: 'rss_snippet',
                wordCount: textContent.split(' ').length
              };
              
              console.log(`✅ Snippet analysis successful for: ${article.title.substring(0, 50)}`);
            }
          }
        }

        return analysisResult;

      } catch (error) {
        console.warn(`⚠️ Complete analysis failed for: ${article.title.substring(0, 50)} - ${error.message}`);
        return null;
      }
    });

    // Wait for all analyses
    const analysisResults = await Promise.all(analysisPromises);
    const validAnalyses = analysisResults.filter(result => result !== null);

    console.log(`📊 Analysis complete: ${validAnalyses.length} successful analyses out of ${relevantArticles.length} relevant articles`);

    // Filter for trusted articles only
    const trustedArticles = validAnalyses
      .filter(article => 
        article.analysis.isTrusted && 
        article.analysis.confidence >= minConfidence
      )
      .sort((a, b) => b.analysis.confidence - a.analysis.confidence)
      .slice(0, maxResults);

    // Calculate stats
    const stats = {
      searchTopic: topic,
      totalRSSArticles: allArticles.length,
      topicRelevant: relevantArticles.length,
      totalAnalyzed: validAnalyses.length,
      trustedFound: trustedArticles.length,
      untrustedFiltered: validAnalyses.filter(art => !art.analysis.isTrusted).length,
      averageConfidence: trustedArticles.length > 0 ? 
        Math.round(trustedArticles.reduce((sum, art) => sum + art.analysis.confidence, 0) / trustedArticles.length) : 0,
      highConfidenceCount: trustedArticles.filter(art => art.analysis.confidence >= 80).length,
      mediumConfidenceCount: trustedArticles.filter(art => art.analysis.confidence >= 70 && art.analysis.confidence < 80).length,
      rssSources: Object.keys(TRUSTED_FEEDS).length,
      analysisFailures: relevantArticles.length - validAnalyses.length,
      analysisMethods: {
        fullContent: validAnalyses.filter(art => art.analysisMode === 'rss_full').length,
        snippetOnly: validAnalyses.filter(art => art.analysisMode === 'rss_snippet').length
      }
    };

    console.log(`✅ RSS AGGREGATOR complete: ${stats.trustedFound} trusted articles found from ${stats.totalRSSArticles} RSS articles`);
    console.log(`📊 Analysis breakdown: ${stats.analysisMethods.fullContent} full-content, ${stats.analysisMethods.snippetOnly} snippet-only`);

    res.json({
      success: true,
      searchType: 'rss_topic',
      topic: topic,
      articles: trustedArticles,
      stats: stats,
      filters: {
        minConfidence: minConfidence,
        maxResults: maxResults
      },
      timestamp: new Date().toISOString(),
      message: trustedArticles.length > 0 ? 
        `Found ${trustedArticles.length} trusted articles about "${topic}" from RSS feeds` :
        `No trusted articles found for "${topic}" with confidence >= ${minConfidence}% in RSS feeds. Try a different search term.`
    });

  } catch (error) {
    console.error('RSS topic aggregation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      service: 'RSS News Aggregator'
    });
  }
});

// Keep your existing analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { url, text, title } = req.body;
    let analysisData = {};

    if (url) {
      const extracted = await extractTextFromUrl(url);
      analysisData = {
        title: extracted.title,
        content: extracted.content,
        source: 'url',
        originalUrl: url,
        extractionInfo: {
          extractedLength: extracted.extractedLength,
          wordCount: extracted.wordCount,
          method: extracted.extractedWith
        }
      };
    } else if (text) {
      analysisData = {
        title: title || 'Direct text input',
        content: text.substring(0, 4000),
        source: 'direct',
        extractionInfo: {}
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either URL or text content is required'
      });
    }

    console.log(`🚀 ANALYSIS: "${analysisData.title}" (${analysisData.content.length} chars)`);

    // Call Python service
    const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze`, {
      title: analysisData.title,
      content: analysisData.content
    }, { timeout: 30000 });

    if (pythonResponse.data.success) {
      const analysis = pythonResponse.data.analysis;

      const result = {
        success: true,
        data: {
          title: analysisData.title,
          url: analysisData.originalUrl || null,
          label: analysis.label,
          confidence: analysis.confidence,
          summary: analysis.summary,
          reasoning: analysis.reasoning,
          probabilities: {
            fake: analysis.fake_probability || (100 - analysis.confidence),
            real: analysis.real_probability || analysis.confidence
          },
          model: analysis.model || 'Comprehensive-Ensemble',
          analyzedAt: new Date().toISOString(),
          source: analysisData.source,
          extractionInfo: analysisData.extractionInfo || null
        }
      };

      res.json(result);
    } else {
      throw new Error('Python analysis service failed');
    }

  } catch (error) {
    console.error('Analysis error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const pythonHealth = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 5000 });
    
    res.json({
      backend: 'healthy',
      python_service: pythonHealth.data,
      rss_sources: Object.keys(TRUSTED_FEEDS).length,
      capabilities: {
        url_analysis: true,
        text_analysis: true,
        rss_topic_search: true,
        trusted_sources: Object.keys(TRUSTED_FEEDS)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      backend: 'healthy',
      python_service: 'unavailable',
      rss_sources: Object.keys(TRUSTED_FEEDS).length,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 RSS-Enhanced Truthly backend running on port ${PORT}`);
  console.log(`🔗 Python service: ${PYTHON_SERVICE_URL}`);
  console.log(`📡 RSS Sources: ${Object.keys(TRUSTED_FEEDS).length} trusted feeds configured`);
  console.log(`✨ Features: URL Analysis + Text Analysis + RSS Topic Search`);
});
