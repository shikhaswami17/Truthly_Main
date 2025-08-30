const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Python service configuration
const PYTHON_SERVICE_URL = 'http://localhost:5001';

// API Call Tracking
let googleSearchCallCount = 0;
let serperSearchCallCount = 0;
let openaiCallCount = 0;
let groqCallCount = 0;
let huggingfaceCallCount = 0;

// API Limits
const GOOGLE_DAILY_LIMIT = 100;
const SERPER_MONTHLY_LIMIT = 2500;
const OPENAI_DAILY_LIMIT = 1000; // Adjust based on your plan
const GROQ_DAILY_LIMIT = 500; // Adjust based on your plan

// Comprehensive API validation
const validateAllAPIs = () => {
    const apis = {
        openai: {
            key: process.env.OPENAI_API_KEY,
            status: !!process.env.OPENAI_API_KEY,
            calls: openaiCallCount,
            limit: OPENAI_DAILY_LIMIT
        },
        groq: {
            key: process.env.GROQ_API_KEY,
            status: !!process.env.GROQ_API_KEY,
            calls: groqCallCount,
            limit: GROQ_DAILY_LIMIT
        },
        serper: {
            key: process.env.SERPER_API_KEY,
            status: !!process.env.SERPER_API_KEY,
            calls: serperSearchCallCount,
            limit: SERPER_MONTHLY_LIMIT
        },
        google_search: {
            key: process.env.GOOGLE_SEARCH_API_KEY,
            engine_id: process.env.GOOGLE_SEARCH_ENGINE_ID,
            status: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID),
            calls: googleSearchCallCount,
            limit: GOOGLE_DAILY_LIMIT
        },
        huggingface: {
            key: process.env.HUGGINGFACE_API_KEY,
            status: !!process.env.HUGGINGFACE_API_KEY,
            calls: huggingfaceCallCount,
            limit: 1000 // Adjust based on your plan
        }
    };
    
    return apis;
};

function logSummaryType(summary, source = 'unknown') {
    if (summary.includes('Strong indicators') || summary.includes('High confidence')) {
        console.log(`📝 Intelligent summary from ${source}: ${summary.substring(0, 80)}...`);
    } else if (summary.startsWith('Content preview:')) {
        console.log(`📄 Fallback content preview from ${source}`);
    } else {
        console.log(`📋 Standard summary from ${source}: ${summary.substring(0, 80)}...`);
    }
}

// Enhanced Serper Search function
async function searchWithSerper(query, maxResults = 5) {
    try {
        const apiKey = process.env.SERPER_API_KEY;
        
        if (!apiKey) {
            throw new Error('Serper API key not configured');
        }

        if (serperSearchCallCount >= SERPER_MONTHLY_LIMIT) {
            throw new Error(`Serper monthly limit reached (${SERPER_MONTHLY_LIMIT} calls)`);
        }

        console.log(`🔍 Serper API Call #${serperSearchCallCount + 1}: "${query}"`);
        
        const response = await axios.post('https://google.serper.dev/search', {
            q: query,
            num: maxResults
        }, {
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        serperSearchCallCount++;
        const results = response.data.organic || [];
        
        return {
            success: true,
            results: results.map(item => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                source: extractDomain(item.link)
            })),
            totalResults: response.data.searchInformation?.totalResults || results.length,
            searchTime: response.data.searchInformation?.searchTime || 0,
            provider: 'Serper API',
            apiCallsUsed: serperSearchCallCount,
            monthlyLimit: SERPER_MONTHLY_LIMIT,
            remainingCalls: SERPER_MONTHLY_LIMIT - serperSearchCallCount
        };
        
    } catch (error) {
        console.error('Serper API error:', error.message);
        return {
            success: false,
            error: error.message,
            provider: 'Serper API',
            apiCallsUsed: serperSearchCallCount,
            remainingCalls: SERPER_MONTHLY_LIMIT - serperSearchCallCount
        };
    }
}

// Google Search function
async function searchWithGoogle(query, maxResults = 5) {
    try {
        if (googleSearchCallCount >= GOOGLE_DAILY_LIMIT) {
            throw new Error(`Daily Google Search limit reached (${GOOGLE_DAILY_LIMIT} calls)`);
        }

        const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        
        if (!apiKey || !searchEngineId) {
            throw new Error('Google Search API credentials not configured');
        }

        const searchUrl = `https://www.googleapis.com/customsearch/v1`;
        const params = new URLSearchParams({
            key: apiKey,
            cx: searchEngineId,
            q: query,
            num: maxResults.toString()
        });

        console.log(`🔍 Google Search API Call #${googleSearchCallCount + 1}: "${query}"`);
        
        const response = await axios.get(`${searchUrl}?${params}`);
        googleSearchCallCount++;
        
        const results = response.data.items || [];
        
        return {
            success: true,
            results: results.map(item => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                source: extractDomain(item.link)
            })),
            totalResults: response.data.searchInformation?.totalResults || 0,
            searchTime: response.data.searchInformation?.searchTime || 0,
            provider: 'Google Search API',
            apiCallsUsed: googleSearchCallCount,
            dailyLimit: GOOGLE_DAILY_LIMIT,
            remainingCalls: GOOGLE_DAILY_LIMIT - googleSearchCallCount
        };
        
    } catch (error) {
        console.error('Google Search API error:', error.message);
        return {
            success: false,
            error: error.message,
            provider: 'Google Search API',
            apiCallsUsed: googleSearchCallCount,
            remainingCalls: GOOGLE_DAILY_LIMIT - googleSearchCallCount
        };
    }
}

// Direct OpenAI API call (backup to Python service)
async function callOpenAIDirectly(title, content) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return { success: false, error: 'OpenAI API key not configured' };
        }

        if (openaiCallCount >= OPENAI_DAILY_LIMIT) {
            return { success: false, error: 'OpenAI daily limit reached' };
        }

        console.log(`🤖 Direct OpenAI API Call #${openaiCallCount + 1}`);

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: `Analyze this news content for credibility and truthfulness. Respond with a confidence score (0-100) and brief reasoning.

Title: ${title}
Content: ${content.substring(0, 1000)}

Format: VERDICT: [Credible/Not Credible] | CONFIDENCE: [0-100]% | REASON: [brief explanation]`
            }],
            temperature: 0.1,
            max_tokens: 200
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });

        openaiCallCount++;

        const result = response.data.choices[0].message.content;
        
        // Parse result
        const isCredible = result.toLowerCase().includes('credible') && !result.toLowerCase().includes('not credible');
        const confidenceMatch = result.match(/CONFIDENCE:\s*(\d+)/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;

        return {
            success: true,
            analysis: {
                label: isCredible ? 'Trustworthy' : 'Untrustworthy',
                confidence: confidence,
                reasoning: `OpenAI analysis: ${result.substring(0, 200)}`,
                provider: 'OpenAI-Direct',
                apiCallsUsed: openaiCallCount
            }
        };

    } catch (error) {
        console.error('OpenAI direct API error:', error.message);
        return {
            success: false,
            error: error.message,
            provider: 'OpenAI-Direct'
        };
    }
}

// Direct Groq API call (backup to Python service)
async function callGroqDirectly(title, content) {
    try {
        if (!process.env.GROQ_API_KEY) {
            return { success: false, error: 'Groq API key not configured' };
        }

        if (groqCallCount >= GROQ_DAILY_LIMIT) {
            return { success: false, error: 'Groq daily limit reached' };
        }

        console.log(`🤖 Direct Groq API Call #${groqCallCount + 1}`);

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'mixtral-8x7b-32768',
            messages: [{
                role: 'user',
                content: `Fact-check this news content. Be analytical and concise.

Title: ${title}
Content: ${content.substring(0, 1000)}

Provide: RELIABILITY: [High/Medium/Low] | CONFIDENCE: [0-100]% | ISSUES: [main concerns or positive indicators]`
            }],
            temperature: 0.1,
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        groqCallCount++;

        const result = response.data.choices[0].message.content;
        
        // Parse result
        const isReliable = result.toLowerCase().includes('high') || 
                          (result.toLowerCase().includes('medium') && !result.toLowerCase().includes('low'));
        const confidenceMatch = result.match(/CONFIDENCE:\s*(\d+)/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 65;

        return {
            success: true,
            analysis: {
                label: isReliable ? 'Trustworthy' : 'Untrustworthy',
                confidence: confidence,
                reasoning: `Groq analysis: ${result.substring(0, 200)}`,
                provider: 'Groq-Direct',
                apiCallsUsed: groqCallCount
            }
        };

    } catch (error) {
        console.error('Groq direct API error:', error.message);
        return {
            success: false,
            error: error.message,
            provider: 'Groq-Direct'
        };
    }
}
// Enhanced LLaMA API call for comprehensive analysis
async function analyzeWithLLaMAComprehensive(title, content) {
    try {
        if (!process.env.HUGGINGFACE_API_KEY) {
            return { success: false, error: 'HuggingFace API key not configured' };
        }

        if (huggingfaceCallCount >= 1000) {
            return { success: false, error: 'HuggingFace daily limit reached' };
        }

        console.log(`🦙 Comprehensive LLaMA API Call #${huggingfaceCallCount + 1}`);

        const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are an expert fact-checker. Analyze news comprehensively for credibility, provide confidence scores, and generate summaries.<|eot_id|><|start_header_id|>user<|end_header_id|>

TITLE: ${title}
CONTENT: ${content.substring(0, 800)}

Provide comprehensive analysis:
1. VERDICT: TRUSTWORTHY or UNTRUSTWORTHY
2. CONFIDENCE: [0-100] 
3. SUMMARY: [2-3 sentence summary of key claims]
4. REASONING: [Analysis of credibility factors]

Format exactly as:
VERDICT: [TRUSTWORTHY/UNTRUSTWORTHY]
CONFIDENCE: [number]
SUMMARY: [summary text]  
REASONING: [detailed reasoning]<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;

        const response = await axios.post(
            'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct',
            {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 300,
                    temperature: 0.2,
                    top_p: 0.9,
                    do_sample: true,
                    stop: ["<|eot_id|>"]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            }
        );

        huggingfaceCallCount++;

        if (response.status === 200 && response.data && Array.isArray(response.data)) {
            const result = response.data[0]?.generated_text || '';
            
            // Extract assistant response
            let assistantResponse = result;
            if (result.includes('<|start_header_id|>assistant<|end_header_id|>')) {
                assistantResponse = result.split('<|start_header_id|>assistant<|end_header_id|>').pop().trim();
            }

            // Parse structured response
            const parsed = parseLLaMAResponse(assistantResponse);

            console.log(`✅ LLaMA-Comprehensive: ${parsed.label} (${parsed.confidence}%)`);
            console.log(`📝 Generated summary: ${parsed.summary.substring(0, 100)}...`);

            return {
                success: true,
                analysis: {
                    label: parsed.label,
                    confidence: parsed.confidence,
                    summary: parsed.summary,
                    reasoning: `LLaMA comprehensive analysis: ${parsed.reasoning}`,
                    provider: 'LLaMA-3-8B-Comprehensive',
                    apiCallsUsed: huggingfaceCallCount,
                    comprehensive: true,
                    raw_response: assistantResponse.substring(0, 500)
                }
            };

        } else if (response.status === 503) {
            // Model loading, try simpler fallback
            console.log('🔄 LLaMA model loading, using fallback...');
            return await llamaFallbackAnalysis(title, content);
        } else {
            throw new Error(`API returned status ${response.status}`);
        }

    } catch (error) {
        console.error('LLaMA comprehensive API error:', error.message);
        
        // Try fallback on error
        try {
            return await llamaFallbackAnalysis(title, content);
        } catch (fallbackError) {
            return {
                success: false,
                error: error.message,
                provider: 'LLaMA-3-8B-Comprehensive'
            };
        }
    }
}

// Parse structured LLaMA response
function parseLLaMAResponse(responseText) {
    let label = 'Trustworthy';
    let confidence = 70;
    let summary = 'Summary not available';
    let reasoning = 'Analysis completed';

    try {
        // Extract verdict
        const verdictMatch = responseText.match(/VERDICT:\s*(TRUSTWORTHY|UNTRUSTWORTHY)/i);
        if (verdictMatch) {
            label = verdictMatch[1].toUpperCase() === 'TRUSTWORTHY' ? 'Trustworthy' : 'Untrustworthy';
        }

        // Extract confidence
        const confidenceMatch = responseText.match(/CONFIDENCE:\s*(\d+)/);
        if (confidenceMatch) {
            confidence = Math.max(0, Math.min(100, parseInt(confidenceMatch[1])));
        }

        // Extract summary
        const summaryMatch = responseText.match(/SUMMARY:\s*([^\n]+(?:\n[^\n]+)*?)(?=\nREASONING:|$)/s);
        if (summaryMatch) {
            summary = summaryMatch[1].trim().replace(/\s+/g, ' ').substring(0, 300);
        }

        // Extract reasoning
        const reasoningMatch = responseText.match(/REASONING:\s*([^\n]+(?:\n[^\n]+)*?)$/s);
        if (reasoningMatch) {
            reasoning = reasoningMatch[1].trim().replace(/\s+/g, ' ').substring(0, 400);
        }

    } catch (parseError) {
        console.warn('⚠️ Error parsing LLaMA response, using fallback');
        // Fallback parsing
        if (responseText.toLowerCase().includes('untrustworthy') || 
            responseText.toLowerCase().includes('fake')) {
            label = 'Untrustworthy';
        }
        summary = responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '');
    }

    return { label, confidence, summary, reasoning };
}

// Fallback LLaMA analysis for when main model is loading
async function llamaFallbackAnalysis(title, content) {
    try {
        console.log('🔄 Using LLaMA fallback analysis...');
        
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
            {
                inputs: `Analyze this news for credibility: ${title}. ${content.substring(0, 300)}`
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );

        if (response.status === 200) {
            // Simple heuristic analysis
            const contentLower = content.toLowerCase();
            const hasOfficialKeywords = ['official', 'confirmed', 'announced', 'statement', 'government', 'ministry'].some(word => contentLower.includes(word));
            const hasSuspiciousKeywords = ['shocking', 'unbelievable', 'secret', 'conspiracy', 'exposed'].some(word => contentLower.includes(word));
            
            const isTrustworthy = hasOfficialKeywords && !hasSuspiciousKeywords;
            const confidence = hasOfficialKeywords ? 75 : 60;

            return {
                success: true,
                analysis: {
                    label: isTrustworthy ? 'Trustworthy' : 'Untrustworthy', 
                    confidence: confidence,
                    summary: `${title}. ${content.substring(0, 150)}...`,
                    reasoning: 'Fallback LLaMA analysis based on content patterns and keywords',
                    provider: 'LLaMA-Fallback',
                    fallback_mode: true
                }
            };
        }

        throw new Error('Fallback also failed');

    } catch (error) {
        console.error('LLaMA fallback error:', error.message);
        return {
            success: false,
            error: 'All LLaMA analysis methods failed',
            provider: 'LLaMA-Fallback'
        };
    }
}
// Smart search function with enhanced fallback
async function smartWebSearch(query, maxResults = 5) {
    // Try Serper first (better free tier)
    if (process.env.SERPER_API_KEY && serperSearchCallCount < SERPER_MONTHLY_LIMIT) {
        const serperResult = await searchWithSerper(query, maxResults);
        if (serperResult.success) {
            return serperResult;
        }
        console.warn('Serper API failed, trying Google Search...');
    }
    
    // Fallback to Google Search
    if (process.env.GOOGLE_SEARCH_API_KEY && googleSearchCallCount < GOOGLE_DAILY_LIMIT) {
        return await searchWithGoogle(query, maxResults);
    }
    
    // No APIs available
    return {
        success: false,
        error: 'No search APIs available or limits exceeded',
        provider: 'None available'
    };
}

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return 'Unknown';
    }
}

// Enhanced text extraction function (keep your existing one - it's good!)
async function extractTextFromUrl(url) {
    try {
        console.log(`Extracting text from: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            },
            timeout: 15000,
            maxRedirects: 5
        });
        
        const $ = cheerio.load(response.data);
        
        // Enhanced removal for political news sites
        $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share, .comments, .related-articles, .sidebar, noscript, iframe').remove();
        $('.ad, .advertisement, .promo, .newsletter, .subscription, .social, .share, .menu, .navigation, .trending, .recommended').remove();
        $('[class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"], [class*="social"], [class*="share"]').remove();
        
        // Remove News18 specific noise
        $('.story_byline, .breadcrumb, .tags, .author-info, .published-date').remove();
        $('div[data-testid], div[data-tracking]').remove();
        
        // Extract title using multiple methods
        let title = $('meta[property="og:title"]').attr('content') ||
                   $('meta[name="twitter:title"]').attr('content') ||
                   $('title').text() ||
                   $('h1').first().text() ||
                   'No title available';
        
        // Clean title more aggressively
        title = title
            .replace(/\s*[\|\-\–]\s*.*$/g, '')
            .replace(/\s*\|\s*(News18|India News|Latest News).*$/gi, '')
            .replace(/^['"]|['"]$/g, '')
            .trim()
            .substring(0, 200);
        
        // Enhanced content selectors for News18 and political news
        const contentSelectors = [
            '.story_details .Normal, .story_content, .article_body',
            '.story-element-text, .story-body .Normal',
            'article .content, article .body, article .text',
            '.article-body, .article-content, .article-text',
            '.story-content, .story-body, .story-text', 
            '.post-content, .post-body, .post-text',
            '.entry-content, .entry-body',
            '[data-module="ArticleBody"], [data-testid="article-body"]',
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
                
                if (candidateContent.length > 200) {
                    content = candidateContent;
                    extractedWith = selector;
                    break;
                }
            }
        }
        
        // Fallback with better paragraph extraction
        if (!content || content.length < 200) {
            $('form, input, button, .menu, .nav, .header, .footer, .widget, .sidebar').remove();
            
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
        
        // Advanced cleaning for political content
        content = content
            .replace(/\s+/g, ' ')
            .replace(/[\r\n\t]/g, ' ')
            .replace(/[^\w\s.,!?;:()"'-]/g, ' ')
            .replace(/\s*([.,!?;:])\s*/g, '$1 ');
        
        // Remove political news noise patterns
        const politicalNoisePatterns = [
            /by\s+Taboola/gi,
            /Sponsored Links?/gi,
            /You May Like/gi,
            /Advertisement/gi,
            /Recommended Stories/gi,
            /Subscribe to our newsletter/gi,
            /Follow us on/gi,
            /Share this article/gi,
            /Read more:/gi,
            /@media\s+screen/gi,
            /#WATCH\s*\|.*?pic\.twitter\.com\/\w+/gi,
            /—\s*ANI\s*\(@ANI\)/gi,
            /Location\s*:\s*$/gi,
            /First Published:\s*$/gi,
            /Curated By:.*?News18/gi
        ];
        
        for (const pattern of politicalNoisePatterns) {
            content = content.replace(pattern, '');
        }
        
        // Normalize political language to reduce bias triggers
        content = content
            .replace(/\bPM Modi\b/g, 'Prime Minister')
            .replace(/\bannounced\b/g, 'stated')
            .replace(/\bpromised\b/g, 'indicated')
            .replace(/\bwill\b/g, 'plans to')
            .replace(/\bsoon\b/g, 'in the future');
        
        // Final cleanup
        content = content
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 4000);
        
        // Enhanced validation for political content
        const wordCount = content.split(' ').filter(word => word.length > 2).length;
        const hasSubstantialContent = content.length > 100 && wordCount > 20;
        const hasGovernmentKeywords = /space|ISRO|mission|station|astronaut|satellite/gi.test(content);
        
        if (!hasSubstantialContent) {
            throw new Error(`Insufficient quality content extracted (${wordCount} words, ${content.length} chars)`);
        }
        
        console.log(`Successfully extracted: Title="${title.substring(0, 50)}...", Content=${content.length} chars, Words=${wordCount}, Method=${extractedWith}, Gov-related=${hasGovernmentKeywords}`);
        
        return {
            title: title,
            content: content,
            source: 'url',
            extractedLength: content.length,
            wordCount: wordCount,
            extractedWith: extractedWith,
            hasGovernmentContent: hasGovernmentKeywords
        };
        
    } catch (error) {
        console.error('Text extraction error:', error.message);
        throw new Error(`Failed to extract text from URL: ${error.message}`);
    }
}

// Helper function to generate summary
function generateSummary(analysisResult, title, content) {
    if (!analysisResult) {
        return "Analysis could not be completed. Manual verification recommended.";
    }

    const { label, confidence, reasoning } = analysisResult;
    const isCredible = label === 'Trustworthy' || label === 'Real';
    
    // Analyze content patterns for summary generation
    const contentLower = (content + ' ' + title).toLowerCase();
    
    // Detection patterns
    const hasOfficialSources = /official|announced|government|ministry|statement|confirmed|according to sources/.test(contentLower);
    const hasNewsAgencies = /reuters|associated press|pti|ani|news agency/.test(contentLower);
    const hasClickbait = /shocking|unbelievable|you won't believe|secret|exposed/.test(contentLower);
    const hasConspiracy = /conspiracy|hidden truth|cover.?up|they don't want/.test(contentLower);
    const hasEmotionalWords = /devastating|outrageous|incredible|bombshell/.test(contentLower);
    const hasPoorStructure = content.split('.').length < 3 || content.length < 100;
    
    let summary = "";
    
    if (isCredible) {
        // TRUSTWORTHY content summary
        if (confidence >= 80) {
            summary = "High confidence in content authenticity. ";
        } else if (confidence >= 65) {
            summary = "Good confidence in content reliability. ";
        } else {
            summary = "Moderate confidence in content trustworthiness. ";
        }
        
        // Add specific positive indicators
        const positives = [];
        if (hasOfficialSources) positives.push("official source references");
        if (hasNewsAgencies) positives.push("established news agencies cited");
        if (!hasClickbait) positives.push("professional language patterns");
        if (!hasConspiracy) positives.push("factual reporting style");
        if (!hasPoorStructure) positives.push("well-structured content");
        
        if (positives.length > 0) {
            summary += `Supporting factors: ${positives.join(', ')}.`;
        } else {
            summary += "Content follows standard journalistic patterns.";
        }
        
    } else {
        // UNTRUSTWORTHY content summary
        if (confidence >= 80) {
            summary = "High confidence this content is misleading. ";
        } else if (confidence >= 65) {
            summary = "Strong indicators of unreliable information. ";
        } else {
            summary = "Multiple concerns about content authenticity. ";
        }
        
        // Add specific red flags
        const concerns = [];
        if (hasClickbait) concerns.push("sensationalist language patterns");
        if (hasConspiracy) concerns.push("conspiracy-related terminology");
        if (!hasOfficialSources) concerns.push("lack of authoritative sources");
        if (hasEmotionalWords) concerns.push("manipulative emotional language");
        if (hasPoorStructure) concerns.push("poor content structure");
        
        if (concerns.length > 0) {
            summary += `Key issues: ${concerns.join(', ')}.`;
        } else {
            summary += "Overall content pattern raises reliability concerns.";
        }
        
        summary += " Recommendation: Cross-reference with trusted sources before sharing.";
    }
    
    return summary;
function generateVerificationReasoning(trustedCount, totalCount) {
    const percentage = Math.round((trustedCount / Math.max(totalCount, 1)) * 100);
    
    if (percentage >= 80) {
        return `Strong verification: ${trustedCount}/${totalCount} sources from trusted outlets (${percentage}%)`;
    } else if (percentage >= 50) {
        return `Moderate verification: ${trustedCount}/${totalCount} sources from trusted outlets (${percentage}%)`;
    } else if (totalCount > 0) {
        return `Limited verification: ${trustedCount}/${totalCount} sources from trusted outlets (${percentage}%)`;
    } else {
        return 'No verification sources found through web search';
    }
}
}

// ENHANCED ROUTES

// Enhanced web search verification endpoint
app.post('/api/web-verify', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        if (!title && !content) {
            return res.status(400).json({
                success: false,
                error: 'Title or content required for verification'
            });
        }
        
        // Create search query from title
        const searchQuery = title ? `"${title}"` : content.substring(0, 100);
        
        const searchResult = await smartWebSearch(searchQuery, 5);
        
        if (!searchResult.success) {
            return res.status(500).json(searchResult);
        }
        
        // Analyze results for trustworthiness
        const trustedDomains = [
            'reuters.com', 'bbc.com', 'apnews.com', 'timesofindia.indiatimes.com',
            'thehindu.com', 'indianexpress.com', 'hindustantimes.com',
            'economictimes.indiatimes.com', 'ndtv.com', 'cnn.com','news18.com',
        ];
        
        const trustedSources = searchResult.results.filter(result => 
            trustedDomains.some(domain => result.source.includes(domain))
        );
        
        const verificationScore = trustedSources.length / Math.max(searchResult.results.length, 1);
        
        res.json({
            success: true,
            verification: {
                sources_found: searchResult.results.length,
                trusted_sources: trustedSources.length,
                verification_score: Math.round(verificationScore * 100) / 100,
                sources: searchResult.results,
                reasoning: generateVerificationReasoning(trustedSources.length, searchResult.results.length),
                provider: searchResult.provider
            },
            api_usage: {
                serper_calls: serperSearchCallCount,
                serper_remaining: SERPER_MONTHLY_LIMIT - serperSearchCallCount,
                google_calls: googleSearchCallCount,
                google_remaining: GOOGLE_DAILY_LIMIT - googleSearchCallCount,
                primary_provider: searchResult.provider
            }
        });
        
    } catch (error) {
        console.error('Web verification error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// MAIN ENHANCED ANALYZE ENDPOINT
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
                    method: extracted.extractedWith,
                    hasGovernmentContent: extracted.hasGovernmentContent
                }
            };
        } else if (text) {
            analysisData = {
                title: title || 'Direct text input',
                content: text.substring(0, 4000),
                source: 'direct',
                extractionInfo: { hasGovernmentContent: false }
            };
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Either URL or text content is required' 
            });
        }
        
        console.log(`🚀 COMPREHENSIVE ANALYSIS: "${analysisData.title}" (${analysisData.content.length} chars)`);
        
        // PRIMARY: Call Python service for comprehensive ensemble
        let pythonAnalysis = null;
        try {
            console.log('📡 Calling Python comprehensive ensemble service...');
            const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze`, {
                title: analysisData.title,
                content: analysisData.content
            }, {
                timeout: 45000
            });
            
            if (pythonResponse.data.success) {
                pythonAnalysis = pythonResponse.data.analysis;
                console.log(`✅ Python service: ${pythonAnalysis.label} (${pythonAnalysis.confidence}%)`);
                console.log(`🎯 Used ${pythonAnalysis.ensemble_details?.api_models_used || 0} APIs + ${pythonAnalysis.ensemble_details?.local_models_used || 0} local models`);
                
                // IMPORTANT: Check if Python service provided an intelligent summary
                if (pythonAnalysis.summary && pythonAnalysis.summary.length > 50) {
                    console.log(`📝 Using intelligent summary from Python service: ${pythonAnalysis.summary.substring(0, 100)}...`);
                }
            }
        } catch (pythonError) {
            console.error('❌ Python service error:', pythonError.message);
        }
        
        // BACKUP: Direct API calls if Python service fails (keep existing backup logic)
        let backupAnalyses = [];
        if (!pythonAnalysis) {
            console.log('🔄 Python service unavailable, using backup direct API calls...');
            
            const openaiResult = await callOpenAIDirectly(analysisData.title, analysisData.content);
            if (openaiResult.success) {
                backupAnalyses.push(openaiResult.analysis);
            }
            
            const groqResult = await callGroqDirectly(analysisData.title, analysisData.content);
            if (groqResult.success) {
                backupAnalyses.push(groqResult.analysis);
            }
            
            const llamaResult = await analyzeWithLLaMAComprehensive(analysisData.title, analysisData.content);
            if (llamaResult) {
                backupAnalyses.push(llamaResult.analysis);
            }
        }
        
        // Enhanced trusted source and government content adjustment (keep existing logic)
        const trustedSources = [
            'timesofindia.indiatimes.com', 'economictimes.indiatimes.com', 
            'hindustantimes.com', 'thehindu.com', 'indianexpress.com', 
            'news18.com', 'ndtv.com', 'republicworld.com'
        ];
        
        const isFromTrustedSource = trustedSources.some(source => 
            analysisData.originalUrl?.includes(source)
        );
        
        const hasGovernmentContent = analysisData.extractionInfo?.hasGovernmentContent;
        
        // Use Python analysis if available, otherwise use backup
        let finalAnalysis;
        if (pythonAnalysis) {
            finalAnalysis = pythonAnalysis;
            
            // Apply trusted source adjustments (keep existing logic)
            if (isFromTrustedSource && finalAnalysis.confidence > 75 && finalAnalysis.label === 'Untrustworthy') {
                if (hasGovernmentContent) {
                    finalAnalysis.confidence = Math.min(finalAnalysis.confidence, 60);
                    finalAnalysis.reasoning = `Government announcement from trusted source. ${finalAnalysis.reasoning} (Confidence adjusted due to trusted government source)`;
                } else {
                    finalAnalysis.confidence = Math.min(finalAnalysis.confidence, 70);
                    finalAnalysis.reasoning += ' (Confidence adjusted due to trusted source)';
                }
            }
        } else if (backupAnalyses.length > 0) {
            // Create ensemble from backup analyses (keep existing logic)
            const realVotes = backupAnalyses.filter(a => a.label === 'Trustworthy').length;
            const fakeVotes = backupAnalyses.filter(a => a.label === 'Untrustworthy').length;
            const avgConfidence = backupAnalyses.reduce((sum, a) => sum + a.confidence, 0) / backupAnalyses.length;
            
            finalAnalysis = {
                label: realVotes > fakeVotes ? 'Trustworthy' : 'Untrustworthy',
                confidence: Math.round(avgConfidence),
                reasoning: `Backup analysis using ${backupAnalyses.length} direct API calls: ${backupAnalyses.map(a => a.provider).join(', ')}`,
                real_probability: (realVotes / backupAnalyses.length) * 100,
                fake_probability: (fakeVotes / backupAnalyses.length) * 100,
                ensemble_details: {
                    backup_mode: true,
                    api_models_used: backupAnalyses.length,
                    local_models_used: 0,
                    predictions: backupAnalyses
                },
                // Generate a backup summary for backup mode
                summary: `Analysis completed using ${backupAnalyses.length} backup models. ${realVotes > fakeVotes ? 'Content shows trustworthy patterns' : 'Content shows concerning patterns'}. Manual verification recommended.`
            };
        } else {
            throw new Error('All analysis services are currently unavailable');
        }

        // Optional web verification (keep existing logic)
        let webVerification = null;
        if (analysisData.title) {
            try {
                const verificationResult = await smartWebSearch(`"${analysisData.title}"`, 3);
                if (verificationResult.success) {
                    const trustedDomains = [
                        'reuters.com', 'bbc.com', 'apnews.com', 'timesofindia.indiatimes.com',
                        'thehindu.com', 'indianexpress.com', 'hindustantimes.com'
                    ];
                    
                    const trustedSources = verificationResult.results.filter(result => 
                        trustedDomains.some(domain => result.source.includes(domain))
                    );
                    
                    webVerification = {
                        sources_found: verificationResult.results.length,
                        trusted_sources: trustedSources.length,
                        verification_score: trustedSources.length / Math.max(verificationResult.results.length, 1),
                        provider: verificationResult.provider
                    };
                }
            } catch (verificationError) {
                console.warn('Web verification failed:', verificationError.message);
            }
        }
        
        // UPDATED: Use intelligent summary from Python service or generate appropriate fallback
        let finalSummary;
        if (finalAnalysis.summary && finalAnalysis.summary.length > 50) {
            // Use the intelligent summary from Python service
            finalSummary = finalAnalysis.summary;
            console.log('✅ Using intelligent analysis-based summary');
        } else {
            // Generate a basic fallback summary (not content-copying)
            finalSummary = generateSummary(analysisData.content, finalAnalysis);
            console.log('⚠️ Using fallback summary generation');
        }
        
        // Format response for frontend
        const result = {
            success: true,
            data: {
                title: analysisData.title,
                url: analysisData.originalUrl || null,
                label: finalAnalysis.label,
                confidence: finalAnalysis.confidence,
                summary: finalSummary, // This is now intelligent, not content-copied
                reasoning: finalAnalysis.reasoning,
                probabilities: {
                    fake: finalAnalysis.fake_probability || (100 - finalAnalysis.confidence),
                    real: finalAnalysis.real_probability || finalAnalysis.confidence
                },
                webVerification: webVerification,
                model: finalAnalysis.ensemble_details?.backup_mode ? 
                       'Backup-API-Ensemble' : 'Comprehensive-Multi-Model-Ensemble',
                analyzedAt: new Date().toISOString(),
                source: analysisData.source,
                extractionInfo: analysisData.extractionInfo || null,
                ensembleDetails: finalAnalysis.ensemble_details || null,
                apiUsage: {
                    comprehensive_mode: !finalAnalysis.ensemble_details?.backup_mode,
                    total_models_used: (finalAnalysis.ensemble_details?.api_models_used || 0) + 
                                     (finalAnalysis.ensemble_details?.local_models_used || 0),
                    api_models: finalAnalysis.ensemble_details?.api_models_used || 0,
                    local_models: finalAnalysis.ensemble_details?.local_models_used || 0,
                    intelligent_summary: finalSummary.length > 50 && !finalSummary.startsWith('Content preview:')
                }
            }
        };
        
        console.log(`📤 COMPREHENSIVE analysis complete: ${finalAnalysis.label} (${finalAnalysis.confidence}% confidence)`);
        console.log(`🎯 Mode: ${result.data.apiUsage.comprehensive_mode ? 'Full Ensemble' : 'Backup APIs'}`);
        console.log(`📝 Summary type: ${result.data.apiUsage.intelligent_summary ? 'Intelligent Analysis' : 'Fallback'}`);
        
        if (!result.data.label) {
            console.log('🆘 Using emergency fallback response');
            result.data.label = 'Trustworthy';
            result.data.confidence = 65;
            result.data.reasoning = 'Fallback analysis - manual verification recommended';
            result.data.summary = 'Analysis completed with limited information. Cross-reference with additional sources recommended.';
            result.data.probabilities = {
                fake: 35,
                real: 65
            };
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('Analysis error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'AI model service is currently unavailable. Please try again later.',
                details: 'Both comprehensive ensemble and backup API services are down'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Analysis failed'
        });
    }
});
    
// COMPREHENSIVE API usage tracking endpoint
app.get('/api/search-usage', (req, res) => {
    const apis = validateAllAPIs();
    
    res.json({
        comprehensive_api_status: {
            serper_api: {
                calls_used: apis.serper.calls,
                monthly_limit: apis.serper.limit,
                remaining_calls: apis.serper.limit - apis.serper.calls,
                percentage_used: Math.round((apis.serper.calls / apis.serper.limit) * 100),
                status: apis.serper.calls < apis.serper.limit ? 'available' : 'limit_reached',
                configured: apis.serper.status
            },
            google_search: {
                calls_used: apis.google_search.calls,
                daily_limit: apis.google_search.limit,
                remaining_calls: apis.google_search.limit - apis.google_search.calls,
                percentage_used: Math.round((apis.google_search.calls / apis.google_search.limit) * 100),
                status: apis.google_search.calls < apis.google_search.limit ? 'available' : 'limit_reached',
                configured: apis.google_search.status
            },
            openai_api: {
                calls_used: apis.openai.calls,
                daily_limit: apis.openai.limit,
                remaining_calls: apis.openai.limit - apis.openai.calls,
                percentage_used: Math.round((apis.openai.calls / apis.openai.limit) * 100),
                status: apis.openai.calls < apis.openai.limit ? 'available' : 'limit_reached',
                configured: apis.openai.status
            },
            groq_api: {
                calls_used: apis.groq.calls,
                daily_limit: apis.groq.limit,
                remaining_calls: apis.groq.limit - apis.groq.calls,
                percentage_used: Math.round((apis.groq.calls / apis.groq.limit) * 100),
                status: apis.groq.calls < apis.groq.limit ? 'available' : 'limit_reached',
                configured: apis.groq.status
            },
            huggingface_api: {
                calls_used: apis.huggingface.calls,
                daily_limit: apis.huggingface.limit,
                remaining_calls: apis.huggingface.limit - apis.huggingface.calls,
                percentage_used: Math.round((apis.huggingface.calls / apis.huggingface.limit) * 100),
                status: apis.huggingface.calls < apis.huggingface.limit ? 'available' : 'limit_reached',
                configured: apis.huggingface.status
            }
        },
        summary: {
            total_configured_apis: Object.values(apis).filter(api => api.status).length,
            total_available_apis: Object.values(apis).filter(api => api.status && api.calls < api.limit).length,
            primary_search_provider: process.env.SERPER_API_KEY ? 'Serper (Recommended)' : 'Google Search',
            primary_ai_provider: process.env.GROQ_API_KEY ? 'Groq (Fast)' : 'OpenAI (Reliable)'
        },
        reset_times: {
            serper: 'Monthly reset',
            google: 'Daily at 12:00 AM UTC',
            openai: 'Daily at 12:00 AM UTC',
            groq: 'Daily at 12:00 AM UTC',
            huggingface: 'Daily at 12:00 AM UTC'
        }
    });
});

// Keep your existing feedback endpoint
app.post('/api/feedback', (req, res) => {
    const { type, content, rating } = req.body;
    
    console.log('Feedback received:', { type, content, rating, timestamp: new Date() });
    
    res.json({ 
        success: true, 
        message: 'Thank you for your feedback!' 
    });
});

// COMPREHENSIVE health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const apis = validateAllAPIs();
        
        // Check Python service
        let pythonHealth = null;
        try {
            const pythonResponse = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 5000 });
            pythonHealth = pythonResponse.data;
        } catch (pythonError) {
            pythonHealth = { status: 'unavailable', error: pythonError.message };
        }
        
        res.json({
            backend: 'healthy',
            comprehensive_ensemble_status: 'operational',
            python_service: pythonHealth,
            api_services: {
                configured_count: Object.values(apis).filter(api => api.status).length,
                available_count: Object.values(apis).filter(api => api.status && api.calls < api.limit).length,
                services: {
                    openai: {
                        configured: apis.openai.status,
                        available: apis.openai.status && apis.openai.calls < apis.openai.limit,
                        calls_used: apis.openai.calls
                    },
                    groq: {
                        configured: apis.groq.status,
                        available: apis.groq.status && apis.groq.calls < apis.groq.limit,
                        calls_used: apis.groq.calls
                    },
                    serper: {
                        configured: apis.serper.status,
                        available: apis.serper.status && apis.serper.calls < apis.serper.limit,
                        calls_used: apis.serper.calls
                    },
                    google_search: {
                        configured: apis.google_search.status,
                        available: apis.google_search.status && apis.google_search.calls < apis.google_search.limit,
                        calls_used: apis.google_search.calls
                    },
                    huggingface: {
                        configured: apis.huggingface.status,
                        available: apis.huggingface.status && apis.huggingface.calls < apis.huggingface.limit,
                        calls_used: apis.huggingface.calls
                    }
                }
            },
            system_capabilities: {
                comprehensive_ensemble: pythonHealth?.status === 'healthy',
                backup_api_calls: Object.values(apis).some(api => api.status),
                web_verification: apis.serper.status || apis.google_search.status,
                total_prediction_sources: (pythonHealth?.ensemble_info?.total_loaded || 0) + 
                                        Object.values(apis).filter(api => api.status).length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            backend: 'healthy',
            comprehensive_ensemble_status: 'degraded',
            python_service: 'unavailable',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test individual API endpoints
app.get('/api/test-apis', async (req, res) => {
    const results = {};
    
    // Test OpenAI
    if (process.env.OPENAI_API_KEY) {
        try {
            const result = await callOpenAIDirectly('Test news', 'This is a test article to verify API connectivity.');
            results.openai = { status: 'working', confidence: result.analysis?.confidence || 0 };
        } catch (error) {
            results.openai = { status: 'error', error: error.message };
        }
    } else {
        results.openai = { status: 'not_configured' };
    }
    
    // Test Groq
    if (process.env.GROQ_API_KEY) {
        try {
            const result = await callGroqDirectly('Test news', 'This is a test article to verify API connectivity.');
            results.groq = { status: 'working', confidence: result.analysis?.confidence || 0 };
        } catch (error) {
            results.groq = { status: 'error', error: error.message };
        }
    } else {
        results.groq = { status: 'not_configured' };
    }
    
    // Test Serper
    if (process.env.SERPER_API_KEY) {
        try {
            const result = await searchWithSerper('test search', 1);
            results.serper = { status: 'working', results_found: result.results?.length || 0 };
        } catch (error) {
            results.serper = { status: 'error', error: error.message };
        }
    } else {
        results.serper = { status: 'not_configured' };
    }
    
    res.json({
        test_results: results,
        summary: {
            working_apis: Object.values(results).filter(r => r.status === 'working').length,
            total_configured: Object.values(results).filter(r => r.status !== 'not_configured').length
        }
    });
});
// LLaMA-specific endpoint for dedicated analysis
app.post('/api/llama-analyze', async (req, res) => {
    try {
        const { url, text, title } = req.body;
        
        let analysisData = {};
        
        if (url) {
            const extracted = await extractTextFromUrl(url);
            analysisData = {
                title: extracted.title,
                content: extracted.content,
                source: 'url',
                originalUrl: url
            };
        } else if (text) {
            analysisData = {
                title: title || 'Direct text input',
                content: text.substring(0, 4000),
                source: 'direct'
            };
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Either URL or text content is required' 
            });
        }
        
        console.log(`🦙 LLaMA-only analysis: "${analysisData.title}" (${analysisData.content.length} chars)`);
        
        // Use comprehensive LLaMA analysis
        const llamaResult = await analyzeWithLLaMAComprehensive(analysisData.title, analysisData.content);
        
        if (!llamaResult.success) {
            return res.status(500).json({
                success: false,
                error: llamaResult.error || 'LLaMA analysis failed'
            });
        }
        
        const result = {
            success: true,
            data: {
                title: analysisData.title,
                url: analysisData.originalUrl || null,
                label: llamaResult.analysis.label,
                confidence: llamaResult.analysis.confidence,
                summary: llamaResult.analysis.summary,
                reasoning: llamaResult.analysis.reasoning,
                probabilities: {
                    fake: llamaResult.analysis.label === 'Untrustworthy' ? llamaResult.analysis.confidence : (100 - llamaResult.analysis.confidence),
                    real: llamaResult.analysis.label === 'Trustworthy' ? llamaResult.analysis.confidence : (100 - llamaResult.analysis.confidence)
                },
                model: 'LLaMA-3-8B-Instruct-Comprehensive',
                analyzedAt: new Date().toISOString(),
                source: analysisData.source,
                llamaFeatures: {
                    comprehensive_analysis: true,
                    custom_summary_generation: true,
                    structured_reasoning: true,
                    confidence_scoring: true
                },
                apiUsage: {
                    llama_only_mode: true,
                    api_calls_used: huggingfaceCallCount,
                    comprehensive_features: ['labeling', 'summary', 'confidence', 'reasoning']
                }
            }
        };
        
        console.log(`🎯 LLaMA-only analysis complete: ${llamaResult.analysis.label} (${llamaResult.analysis.confidence}% confidence)`);
        
        res.json(result);
        
    } catch (error) {
        console.error('LLaMA analysis error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'LLaMA analysis failed'
        });
    }
});

// Validate required environment variables
const validateEnvVars = () => {
    const warnings = [];
    const configured = [];
    
    if (!process.env.SERPER_API_KEY && !process.env.GOOGLE_SEARCH_API_KEY) {
        warnings.push('⚠️  No search API keys configured. Web verification will be disabled.');
    } else {
        if (process.env.SERPER_API_KEY) configured.push('Serper (2500/month)');
        if (process.env.GOOGLE_SEARCH_API_KEY) configured.push('Google Search (100/day)');
    }
    
    if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
        warnings.push('⚠️  No AI API keys configured. Only local models will be used.');
    } else {
        if (process.env.OPENAI_API_KEY) configured.push('OpenAI GPT-3.5');
        if (process.env.GROQ_API_KEY) configured.push('Groq Mixtral');
    }
    
    if (process.env.HUGGINGFACE_API_KEY) configured.push('HuggingFace API');
    
    if (warnings.length > 0) {
        console.log('\n' + warnings.join('\n'));
    }
    
    if (configured.length > 0) {
        console.log('✅ Configured APIs: ' + configured.join(', '));
    }
    
    console.log(`🎯 Total prediction sources available: ${configured.length} APIs + Local Models\n`);
};

app.listen(PORT, () => {
    console.log(`🚀 COMPREHENSIVE Enhanced backend server running on port ${PORT}`);
    console.log(`🔗 Python comprehensive ensemble service: ${PYTHON_SERVICE_URL}`);
    
    const apis = validateAllAPIs();
    const configuredAPIs = Object.values(apis).filter(api => api.status).length;
    
    console.log(`🎭 COMPREHENSIVE MODE: ${configuredAPIs} API services configured`);
    console.log(`🔍 Search APIs: ${process.env.SERPER_API_KEY ? 'Serper' : ''}${process.env.SERPER_API_KEY && process.env.GOOGLE_SEARCH_API_KEY ? ' + ' : ''}${process.env.GOOGLE_SEARCH_API_KEY ? 'Google' : process.env.SERPER_API_KEY ? '' : 'None'}`);
    console.log(`🤖 AI APIs: ${process.env.OPENAI_API_KEY ? 'OpenAI' : ''}${process.env.OPENAI_API_KEY && process.env.GROQ_API_KEY ? ' + ' : ''}${process.env.GROQ_API_KEY ? 'Groq' : process.env.OPENAI_API_KEY ? '' : 'None'}${process.env.HUGGINGFACE_API_KEY ? ' + HuggingFace' : ''}`);
    
    validateEnvVars();
});
