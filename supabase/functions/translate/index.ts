import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Get allowed origins from environment or use default
const getAllowedOrigins = (): string[] => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOrigins) {
    return allowedOrigins.split(',').map(origin => origin.trim());
  }
  // Default: allow same origin and common localhost ports
  return [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
};

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = origin || '';
  
  // Check if origin is allowed or if it's from the same Supabase project
  const isAllowed = allowedOrigins.some(allowed => 
    requestOrigin === allowed || 
    requestOrigin.includes('supabase.co') ||
    requestOrigin.includes('netlify.app') ||
    requestOrigin.includes('vercel.app')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { text, sourceLanguage = 'Hinglish', targetLanguage = 'Urdu' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!text || text.trim() === '') {
      return new Response(JSON.stringify({ translatedText: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Translating from ${sourceLanguage} to ${targetLanguage}:`, text.substring(0, 100) + '...');

    // Enhanced system prompt based on target language
    let systemPrompt = '';
    if (targetLanguage === 'Urdu') {
      systemPrompt = `You are an expert translator specializing in translating ${sourceLanguage} to Urdu script. 

Your task:
1. Translate the given ${sourceLanguage} text to proper Urdu script (Nastaliq style)
2. Maintain the poetic structure, line breaks, paragraph breaks, and all formatting exactly as provided
3. Preserve all special markers like ||BREAK|| or ||PARA|| that indicate paragraph/shaair breaks
4. Keep the emotional and spiritual essence of the text intact
5. Use proper Urdu vocabulary and grammar with authentic Nastaliq script
6. If there are any Islamic terms or names, use their proper Urdu/Arabic spellings
7. Maintain the rhythm and meter of poetry if applicable
8. Preserve any existing Urdu/Arabic text in the input

IMPORTANT: 
- Only output the translated Urdu text
- Do not add any explanations, notes, or English text
- Preserve all line breaks and formatting markers exactly as they appear
- Use proper Urdu Nastaliq script with correct diacritics where appropriate`;
    } else if (targetLanguage === 'Arabic') {
      systemPrompt = `You are an expert translator specializing in translating ${sourceLanguage} to Arabic script.

Your task:
1. Translate the given ${sourceLanguage} text to proper Arabic script
2. Maintain the poetic structure, line breaks, and formatting
3. Preserve all special markers like ||BREAK|| or ||PARA||
4. Use proper Arabic vocabulary and grammar
5. Maintain the spiritual and religious context

IMPORTANT: Only output the translated Arabic text. Do not add explanations.`;
    } else {
      systemPrompt = `You are an expert translator specializing in translating ${sourceLanguage} to ${targetLanguage}.

Your task:
1. Translate the given ${sourceLanguage} text to ${targetLanguage}
2. Maintain the poetic structure, line breaks, paragraph breaks, and formatting
3. Preserve all special markers like ||BREAK|| or ||PARA||
4. Keep the emotional and spiritual essence intact

IMPORTANT: Only output the translated text. Do not add explanations.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Translate the following ${sourceLanguage} text to ${targetLanguage}:\n\n${text}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content || '';
    
    console.log('Translation successful');

    return new Response(JSON.stringify({ translatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Translation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Translation failed';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
