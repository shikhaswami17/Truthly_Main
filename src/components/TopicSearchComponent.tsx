// filepath: /home/shikha17/Documents/Truthly/src/components/TopicSearchComponent.tsx
import React, { useState } from 'react';
import { Search, Globe, Shield, CheckCircle, XCircle, Clock, ExternalLink, Star, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  domain: string;
  snippet: string;
  publishedDate: string;
  analysis: {
    label: string;
    confidence: number;
    summary: string;
    reasoning: string;
    isTrusted: boolean;
    trustScore: number;
    modelUsed: string;
  };
  sourceCredibility: {
    domain: string;
    isTrustedDomain: boolean;
    credibilityScore: number;
  };
  analysisMode: string;
}

interface SearchStats {
  searchTopic: string;
  totalRSSArticles: number;
  topicRelevant: number;
  totalAnalyzed: number;
  trustedFound: number;
  untrustedFiltered: number;
  averageConfidence: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  rssSources: number;
  analysisFailures: number;
  analysisMethods: {
    fullContent: number;
    snippetOnly: number;
  };
}

// Hardcoded sample data for different topics
const HARDCODED_RESULTS: { [key: string]: { articles: Article[], stats: SearchStats } } = {
  "climate change": {
    articles: [
      {
        id: "climate_1",
        title: "UN Climate Report Warns of Accelerating Global Warming",
        url: "https://www.bbc.com/news/climate-123456",
        source: "BBC World",
        domain: "bbc.com",
        snippet: "The latest IPCC report indicates that global temperatures are rising faster than previously predicted, with significant implications for sea level rise and extreme weather events.",
        publishedDate: "2025-08-29T10:00:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 92,
          summary: "High confidence in content authenticity. Supporting factors: multiple authoritative source references, official source references, evidence-based reporting patterns, professional writing structure, comprehensive coverage.",
          reasoning: "Enhanced analysis: Trust indicators: 8, Quality indicators: 6, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 17",
          isTrusted: true,
          trustScore: 92,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "bbc.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_full"
      },
      {
        id: "climate_2",
        title: "Renewable Energy Investment Reaches Record High",
        url: "https://www.reuters.com/environment/energy-456789",
        source: "Reuters",
        domain: "reuters.com",
        snippet: "Global investment in renewable energy technologies reached $1.8 trillion in 2024, driven by government policies and declining costs of solar and wind power.",
        publishedDate: "2025-08-28T14:30:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 88,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators, comprehensive coverage.",
          reasoning: "Enhanced analysis: Trust indicators: 5, Quality indicators: 4, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 12",
          isTrusted: true,
          trustScore: 88,
          modelUsed: "RSS-Snippet-Analysis"
        },
        sourceCredibility: {
          domain: "reuters.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_snippet"
      },
      {
        id: "climate_3",
        title: "Arctic Ice Melting at Unprecedented Rate",
        url: "https://www.thehindu.com/environment/arctic-789012",
        source: "The Hindu",
        domain: "thehindu.com",
        snippet: "NASA satellite data shows Arctic sea ice is melting 40% faster than climate models predicted, with implications for global weather patterns.",
        publishedDate: "2025-08-27T09:15:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 85,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators.",
          reasoning: "Enhanced analysis: Trust indicators: 4, Quality indicators: 5, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 12",
          isTrusted: true,
          trustScore: 85,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "thehindu.com",
          isTrustedDomain: true,
          credibilityScore: 90
        },
        analysisMode: "rss_full"
      }
    ],
    stats: {
      searchTopic: "climate change",
      totalRSSArticles: 127,
      topicRelevant: 24,
      totalAnalyzed: 15,
      trustedFound: 3,
      untrustedFiltered: 0,
      averageConfidence: 88,
      highConfidenceCount: 2,
      mediumConfidenceCount: 1,
      rssSources: 10,
      analysisFailures: 9,
      analysisMethods: {
        fullContent: 2,
        snippetOnly: 1
      }
    }
  },
  
  "space mission": {
    articles: [
      {
        id: "space_1",
        title: "NASA Artemis Mission Prepares for Moon Landing",
        url: "https://www.bbc.com/news/science-345678",
        source: "BBC World",
        domain: "bbc.com",
        snippet: "NASA's Artemis III mission is on track for a 2025 lunar landing, marking humanity's return to the Moon after more than 50 years.",
        publishedDate: "2025-08-29T16:00:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 94,
          summary: "High confidence in content authenticity. Supporting factors: multiple authoritative source references, official source references, evidence-based reporting patterns, professional writing structure.",
          reasoning: "Enhanced analysis: Trust indicators: 7, Quality indicators: 5, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 15",
          isTrusted: true,
          trustScore: 94,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "bbc.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_full"
      },
      {
        id: "space_2",
        title: "SpaceX Starship Completes Successful Test Flight",
        url: "https://www.cnn.com/space/starship-567890",
        source: "CNN",
        domain: "cnn.com",
        snippet: "SpaceX's Starship vehicle completed its fifth orbital test flight, demonstrating key capabilities for future Mars missions and lunar operations.",
        publishedDate: "2025-08-28T11:45:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 89,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators, comprehensive coverage.",
          reasoning: "Enhanced analysis: Trust indicators: 4, Quality indicators: 4, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 11",
          isTrusted: true,
          trustScore: 89,
          modelUsed: "RSS-Snippet-Analysis"
        },
        sourceCredibility: {
          domain: "cnn.com",
          isTrustedDomain: true,
          credibilityScore: 90
        },
        analysisMode: "rss_snippet"
      }
    ],
    stats: {
      searchTopic: "space mission",
      totalRSSArticles: 89,
      topicRelevant: 18,
      totalAnalyzed: 12,
      trustedFound: 2,
      untrustedFiltered: 1,
      averageConfidence: 92,
      highConfidenceCount: 2,
      mediumConfidenceCount: 0,
      rssSources: 10,
      analysisFailures: 5,
      analysisMethods: {
        fullContent: 1,
        snippetOnly: 1
      }
    }
  },
  
  "technology": {
    articles: [
      {
        id: "tech_1",
        title: "AI Models Achieve Breakthrough in Medical Diagnosis",
        url: "https://www.reuters.com/technology/ai-medical-678901",
        source: "Reuters",
        domain: "reuters.com",
        snippet: "New artificial intelligence models have achieved 95% accuracy in early cancer detection, surpassing human radiologists in clinical trials.",
        publishedDate: "2025-08-29T13:20:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 91,
          summary: "High confidence in content authenticity. Supporting factors: multiple authoritative source references, evidence-based reporting patterns, factual reporting indicators, professional writing structure.",
          reasoning: "Enhanced analysis: Trust indicators: 6, Quality indicators: 7, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 16",
          isTrusted: true,
          trustScore: 91,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "reuters.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_full"
      },
      {
        id: "tech_2",
        title: "Quantum Computing Milestone Reached by IBM",
        url: "https://www.bbc.com/news/technology-789012",
        source: "BBC World",
        domain: "bbc.com",
        snippet: "IBM's latest quantum computer has achieved quantum advantage in solving complex optimization problems, marking a significant step toward practical quantum computing.",
        publishedDate: "2025-08-28T10:30:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 87,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators.",
          reasoning: "Enhanced analysis: Trust indicators: 5, Quality indicators: 6, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 14",
          isTrusted: true,
          trustScore: 87,
          modelUsed: "RSS-Snippet-Analysis"
        },
        sourceCredibility: {
          domain: "bbc.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_snippet"
      }
    ],
    stats: {
      searchTopic: "technology",
      totalRSSArticles: 156,
      topicRelevant: 32,
      totalAnalyzed: 20,
      trustedFound: 2,
      untrustedFiltered: 3,
      averageConfidence: 89,
      highConfidenceCount: 1,
      mediumConfidenceCount: 1,
      rssSources: 10,
      analysisFailures: 15,
      analysisMethods: {
        fullContent: 1,
        snippetOnly: 1
      }
    }
  },
  
  "economy": {
    articles: [
      {
        id: "econ_1",
        title: "Global GDP Growth Projected at 3.2% for 2025",
        url: "https://www.reuters.com/business/economy-890123",
        source: "Reuters",
        domain: "reuters.com",
        snippet: "The International Monetary Fund projects global economic growth of 3.2% for 2025, driven by recovery in emerging markets and sustained consumer spending.",
        publishedDate: "2025-08-29T08:45:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 93,
          summary: "High confidence in content authenticity. Supporting factors: multiple authoritative source references, official source references, evidence-based reporting patterns, comprehensive coverage.",
          reasoning: "Enhanced analysis: Trust indicators: 8, Quality indicators: 5, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 16",
          isTrusted: true,
          trustScore: 93,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "reuters.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_full"
      },
      {
        id: "econ_2",
        title: "Central Banks Signal Interest Rate Adjustments",
        url: "https://www.bbc.com/news/business-901234",
        source: "BBC World",
        domain: "bbc.com",
        snippet: "Major central banks are signaling potential interest rate cuts in response to cooling inflation and employment data across developed economies.",
        publishedDate: "2025-08-28T15:20:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 86,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators.",
          reasoning: "Enhanced analysis: Trust indicators: 5, Quality indicators: 4, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 12",
          isTrusted: true,
          trustScore: 86,
          modelUsed: "RSS-Snippet-Analysis"
        },
        sourceCredibility: {
          domain: "bbc.com",
          isTrustedDomain: true,
          credibilityScore: 95
        },
        analysisMode: "rss_snippet"
      }
    ],
    stats: {
      searchTopic: "economy",
      totalRSSArticles: 201,
      topicRelevant: 45,
      totalAnalyzed: 25,
      trustedFound: 2,
      untrustedFiltered: 2,
      averageConfidence: 90,
      highConfidenceCount: 2,
      mediumConfidenceCount: 0,
      rssSources: 10,
      analysisFailures: 21,
      analysisMethods: {
        fullContent: 1,
        snippetOnly: 1
      }
    }
  },
  
  "india": {
    articles: [
      {
        id: "india_1",
        title: "India's Digital Infrastructure Expansion Accelerates",
        url: "https://www.thehindu.com/news/national/digital-012345",
        source: "The Hindu",
        domain: "thehindu.com",
        snippet: "India's digital payment infrastructure has processed over 100 billion transactions this year, showcasing the country's rapid digital transformation and financial inclusion efforts.",
        publishedDate: "2025-08-29T12:00:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 89,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators, comprehensive coverage.",
          reasoning: "Enhanced analysis: Trust indicators: 6, Quality indicators: 5, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 14",
          isTrusted: true,
          trustScore: 89,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "thehindu.com",
          isTrustedDomain: true,
          credibilityScore: 90
        },
        analysisMode: "rss_full"
      },
      {
        id: "india_2",
        title: "Renewable Energy Capacity Crosses 100GW Milestone",
        url: "https://indianexpress.com/article/india/renewable-123456",
        source: "Indian Express",
        domain: "indianexpress.com",
        snippet: "India has achieved 100GW of renewable energy capacity, marking significant progress toward its 2030 clean energy targets and climate commitments.",
        publishedDate: "2025-08-28T16:45:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 84,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators.",
          reasoning: "Enhanced analysis: Trust indicators: 4, Quality indicators: 5, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 12",
          isTrusted: true,
          trustScore: 84,
          modelUsed: "RSS-Snippet-Analysis"
        },
        sourceCredibility: {
          domain: "indianexpress.com",
          isTrustedDomain: true,
          credibilityScore: 90
        },
        analysisMode: "rss_snippet"
      },
      {
        id: "india_3",
        title: "ISRO Announces Next Mars Mission Timeline",
        url: "https://www.ndtv.com/india-news/isro-mars-234567",
        source: "NDTV",
        domain: "ndtv.com",
        snippet: "The Indian Space Research Organisation has announced plans for its second Mars mission, scheduled for launch in 2028 with advanced scientific instruments.",
        publishedDate: "2025-08-27T14:30:00Z",
        analysis: {
          label: "Trustworthy",
          confidence: 87,
          summary: "Good confidence in content reliability. Supporting factors: official source references, evidence-based reporting patterns, factual reporting indicators, comprehensive coverage.",
          reasoning: "Enhanced analysis: Trust indicators: 5, Quality indicators: 4, Suspicion indicators: 0, Clickbait indicators: 0, Structure quality: true, Net score: 12",
          isTrusted: true,
          trustScore: 87,
          modelUsed: "Full-Content-Analysis"
        },
        sourceCredibility: {
          domain: "ndtv.com",
          isTrustedDomain: true,
          credibilityScore: 90
        },
        analysisMode: "rss_full"
      }
    ],
    stats: {
      searchTopic: "india",
      totalRSSArticles: 178,
      topicRelevant: 38,
      totalAnalyzed: 22,
      trustedFound: 3,
      untrustedFiltered: 1,
      averageConfidence: 87,
      highConfidenceCount: 1,
      mediumConfidenceCount: 2,
      rssSources: 10,
      analysisFailures: 18,
      analysisMethods: {
        fullContent: 2,
        snippetOnly: 1
      }
    }
  }
};

const TopicSearchComponent: React.FC = () => {
  const [searchTopic, setSearchTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchTopic.trim()) return;
    
    setLoading(true);
    setError(null);
    setArticles([]);
    setStats(null);
    
    // Simulate API delay
    setTimeout(() => {
      const searchKey = searchTopic.toLowerCase().trim();
      const result = HARDCODED_RESULTS[searchKey];
      
      if (result) {
        setArticles(result.articles);
        setStats(result.stats);
      } else {
        setError(`No hardcoded results found for "${searchTopic}". Try: climate change, space mission, technology, economy, or india`);
      }
      
      setLoading(false);
    }, 1500); // 1.5 second delay to simulate real API call
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Main
          </button>

          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trusted News Search</h1>
              <p className="text-gray-600">Search any topic and get only verified, trustworthy news articles</p>
            </div>
          </div>

          {/* Search Interface */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTopic}
                onChange={(e) => setSearchTopic(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search for news topics (e.g., climate change, space mission, technology, economy, india)"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !searchTopic.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Searching News Sources...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search News
                </>
              )}
            </button>
          </div>

          {/* Popular searches */}
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Available searches:</p>
            <div className="flex flex-wrap gap-2">
              {['climate change', 'space mission', 'technology', 'economy', 'india'].map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchTopic(term)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                  disabled={loading}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats Display */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Results for "{stats.searchTopic}"</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.trustedFound}</div>
                <div className="text-sm text-gray-600">Trusted Articles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.averageConfidence}%</div>
                <div className="text-sm text-gray-600">Avg. Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.rssSources}</div>
                <div className="text-sm text-gray-600">Sources</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.totalRSSArticles}</div>
                <div className="text-sm text-gray-600">Total Scanned</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t text-sm text-gray-600">
              <p>Found {stats.topicRelevant} relevant articles, analyzed {stats.totalAnalyzed}, filtered to {stats.trustedFound} trusted sources</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Articles Display */}
        {articles.length > 0 ? (
          <div className="space-y-6">
            {articles.map((article) => (
              <div key={article.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Article Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 leading-tight">
                        <a 
                          href={article.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 transition-colors"
                        >
                          {article.title}
                        </a>
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Shield className="h-4 w-4" />
                          {article.source}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(article.publishedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    {/* Trust Badge */}
                    <div className="flex flex-col items-end gap-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceBadge(article.analysis.confidence)}`}>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          {article.analysis.confidence}% Trusted
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Star className="h-3 w-3" />
                        {article.analysisMode === 'rss_full' ? 'Full Analysis' : 'Snippet Analysis'}
                      </div>
                    </div>
                  </div>

                  {/* Article Content */}
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    {article.snippet}
                  </p>

                  {/* AI Analysis Summary */}
                  {article.analysis.summary && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-blue-900 mb-2">AI Analysis:</h4>
                      <p className="text-blue-800 text-sm">{article.analysis.summary.substring(0, 200)}...</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Domain: {article.domain}</span>
                      <span>Model: {article.analysis.modelUsed}</span>
                    </div>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Read Full Article
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !loading && searchTopic && (
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trusted articles found</h3>
            <p className="text-gray-600">
              We couldn't find any hardcoded results for "{searchTopic}". 
              Try: climate change, space mission, technology, economy, or india
            </p>
          </div>
        )}

        {!loading && !searchTopic && (
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Search Trusted News</h3>
            <p className="text-gray-600">
              Enter a topic above to search through our curated news database. Available topics: climate change, space mission, technology, economy, india.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicSearchComponent;
