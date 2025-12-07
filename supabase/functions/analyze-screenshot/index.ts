import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { screenshot_url, screenshot_id, team_id } = body;

    console.log("Request body:", { screenshot_url, screenshot_id, team_id });

    if (!screenshot_url || !screenshot_id || !team_id) {
      console.error("Missing parameters:", { screenshot_url, screenshot_id, team_id });
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing screenshot:", screenshot_url);

    // Call Lovable AI to analyze the screenshot with retries
    async function analyzeWithRetry(imageUrl: string, maxRetries = 3) {
      let attempt = 0;
      let lastError: any = null;
      while (attempt < maxRetries) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Analyze this PUBG match results screenshot and extract:

1. PLACEMENT (rank): Look for the placement number, usually shown as "#2" or "2nd place" or similar. This is typically displayed prominently at the top of the screen. The placement should be a number from 1 to 18.

2. TOTAL TEAM KILLS: This screenshot may show kills in different ways:
   - If you see a detailed stats table with an "Eliminations" column, sum up all the eliminations for all team members
   - If you see player cards at the bottom with individual elimination numbers, sum those up
   - If you see "Eliminations: X" anywhere, use that total
   - The kills could be labeled as "Eliminations", "Kills", or shown with a number

Important:
- For kills/eliminations, you need to add up ALL team members' kills to get the total
- Look carefully at the entire screenshot to find where the kill information is displayed
- The placement is usually shown with a large "#" symbol followed by the rank number

Return the total team placement and total team kills.`
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: imageUrl
                      }
                    }
                  ]
                }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_match_data",
                    description: "Extract placement rank and kills from PUBG match screenshot",
                    parameters: {
                      type: "object",
                      properties: {
                        placement: {
                          type: "integer",
                          description: "The team's placement/rank in the match (1-18)"
                        },
                        kills: {
                          type: "integer",
                          description: "Total number of kills in the match"
                        }
                      },
                      required: ["placement", "kills"],
                      additionalProperties: false
                    }
                  }
                }
              ],
              tool_choice: { type: "function", function: { name: "extract_match_data" } }
            }),
          });

          if (aiResponse.status === 429 || aiResponse.status === 402 || aiResponse.status >= 500) {
            const txt = await aiResponse.text();
            console.warn("AI temporary error, will retry:", aiResponse.status, txt);
            lastError = new Error(`AI error ${aiResponse.status}: ${txt}`);
          } else if (!aiResponse.ok) {
            const txt = await aiResponse.text();
            console.error("AI gateway error (non-retryable):", aiResponse.status, txt);
            throw new Error(`AI analysis failed: ${aiResponse.status} - ${txt}`);
          } else {
            const aiData = await aiResponse.json();
            console.log("AI Response:", JSON.stringify(aiData));

            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (!toolCall) {
              throw new Error("No tool call in AI response");
            }
            const matchData = JSON.parse(toolCall.function.arguments);
            return matchData as { placement: number; kills: number };
          }
        } catch (e) {
          lastError = e;
          console.warn(`AI analysis attempt ${attempt + 1} failed:`, e);
        }

        // Backoff before next retry
        attempt += 1;
        const delayMs = 500 * attempt; // exponential-ish backoff
        await new Promise((res) => setTimeout(res, delayMs));
      }

      throw lastError ?? new Error("AI analysis failed after retries");
    }

    const { placement, kills } = await analyzeWithRetry(screenshot_url);

    console.log("Extracted data:", { placement, kills });

    // Calculate points
    const PLACEMENT_POINTS: Record<number, number> = {
      1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
    };
    const placementPoints = PLACEMENT_POINTS[placement] || 0;
    const killPoints = kills;
    const totalPoints = placementPoints + killPoints;

    // Update the screenshot record
    const { error: updateError } = await supabaseClient
      .from("match_screenshots")
      .update({
        placement,
        kills,
        points: totalPoints
      })
      .eq("id", screenshot_id);

    if (updateError) {
      console.error("Error updating screenshot:", updateError);
      throw new Error("Failed to update screenshot data");
    }

    // Fetch all screenshots for this team
    const { data: teamScreenshots, error: fetchError } = await supabaseClient
      .from("match_screenshots")
      .select("*")
      .eq("team_id", team_id);

    if (fetchError) {
      console.error("Error fetching team screenshots:", fetchError);
      throw new Error("Failed to fetch team data");
    }

    // Calculate team stats
    const totalTeamPoints = teamScreenshots.reduce((sum, s) => sum + (s.points || 0), 0);
    const totalPlacementPoints = teamScreenshots.reduce((sum, s) => {
      const p = s.placement || 0;
      const pts = PLACEMENT_POINTS[p] || 0;
      return sum + pts;
    }, 0);
    const totalKills = teamScreenshots.reduce((sum, s) => sum + (s.kills || 0), 0);
    const totalKillPoints = totalKills;
    const matchesPlayed = teamScreenshots.length;
    const firstPlaceWins = teamScreenshots.filter(s => s.placement === 1).length;

    // Update team stats
    const { error: teamUpdateError } = await supabaseClient
      .from("teams")
      .update({
        total_points: totalTeamPoints,
        placement_points: totalPlacementPoints,
        kill_points: totalKillPoints,
        total_kills: totalKills,
        matches_played: matchesPlayed,
        first_place_wins: firstPlaceWins
      })
      .eq("id", team_id);

    if (teamUpdateError) {
      console.error("Error updating team stats:", teamUpdateError);
      throw new Error("Failed to update team stats");
    }

    console.log("Successfully analyzed screenshot and updated team stats");

    return new Response(
      JSON.stringify({
        success: true,
        placement,
        kills,
        points: totalPoints
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-screenshot function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
